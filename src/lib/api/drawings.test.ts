import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Supabase 클라이언트 mock
vi.mock('@/lib/supabase', () => {
  const mockStorageUpload = vi.fn();
  const mockStorageGetPublicUrl = vi.fn();
  const mockFrom = vi.fn();

  return {
    supabase: {
      from: mockFrom,
      storage: {
        from: vi.fn(() => ({
          upload: mockStorageUpload,
          getPublicUrl: mockStorageGetPublicUrl,
        })),
      },
    },
  };
});

import { supabase } from '@/lib/supabase';
import {
  fetchDrawings,
  insertDrawing,
  updateDrawingPosition,
  uploadDrawingImage,
  clearCanvasData,
} from './drawings';

const mockFrom = supabase.from as ReturnType<typeof vi.fn>;
const mockStorageFrom = supabase.storage.from as ReturnType<typeof vi.fn>;

function makeMockChain(overrides: Record<string, unknown> = {}) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return chain;
}

const validDrawing = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  image_url: 'https://example.com/image.png',
  x: 100,
  y: 200,
  created_at: '2026-06-02T00:00:00Z',
};

// AC1: drawings 테이블에서 카드 로드
describe('fetchDrawings', () => {
  it('drawings 목록을 반환한다', async () => {
    const chain = makeMockChain({
      order: vi.fn().mockResolvedValue({ data: [validDrawing], error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const result = await fetchDrawings();
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe(validDrawing.id);
  });

  it('에러 시 throw한다', async () => {
    const chain = makeMockChain({
      order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
    });
    mockFrom.mockReturnValue(chain);

    await expect(fetchDrawings()).rejects.toThrow('DB error');
  });

  it('Zod 검증 실패 시 throw한다', async () => {
    const chain = makeMockChain({
      order: vi.fn().mockResolvedValue({ data: [{ id: 'bad', image_url: 'not-url', x: 0, y: 0, created_at: '' }], error: null }),
    });
    mockFrom.mockReturnValue(chain);

    await expect(fetchDrawings()).rejects.toThrow();
  });
});

// AC6: drawings 테이블에 insert
describe('insertDrawing', () => {
  it('insert 후 Drawing을 반환한다', async () => {
    const chain = makeMockChain({
      single: vi.fn().mockResolvedValue({ data: validDrawing, error: null }),
    });
    mockFrom.mockReturnValue(chain);

    const result = await insertDrawing({
      image_url: 'https://example.com/image.png',
      x: 100,
      y: 200,
    });
    expect(result.id).toBe(validDrawing.id);
  });

  it('잘못된 insert 데이터는 Zod 검증에서 throw한다', async () => {
    await expect(
      insertDrawing({ image_url: 'not-a-url', x: 0, y: 0 })
    ).rejects.toThrow();
  });
});

// AC9: 드래그 종료 후 위치 업데이트
describe('updateDrawingPosition', () => {
  it('x, y 좌표를 업데이트한다', async () => {
    const chain = makeMockChain({
      eq: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue(chain);

    await expect(
      updateDrawingPosition('123e4567-e89b-12d3-a456-426614174000', 50, 75)
    ).resolves.toBeUndefined();
  });

  it('잘못된 좌표는 Zod 검증에서 throw한다', async () => {
    await expect(
      // @ts-expect-error 의도적 타입 오류
      updateDrawingPosition('some-id', 'not-number', 0)
    ).rejects.toThrow();
  });
});

// AC6: Storage 업로드
describe('uploadDrawingImage', () => {
  beforeEach(() => {
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: null }),
      getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://storage.example.com/file.png' } }),
    });
  });

  it('Storage 업로드 성공 시 publicUrl을 반환한다', async () => {
    const blob = new Blob(['fake image'], { type: 'image/png' });
    const url = await uploadDrawingImage(blob);
    expect(url).toBe('https://storage.example.com/file.png');
  });

  it('Storage 업로드 실패 시 throw한다', async () => {
    mockStorageFrom.mockReturnValue({
      upload: vi.fn().mockResolvedValue({ error: { message: 'Upload failed' } }),
      getPublicUrl: vi.fn(),
    });

    const blob = new Blob(['fake image'], { type: 'image/png' });
    await expect(uploadDrawingImage(blob)).rejects.toThrow('Upload failed');
  });
});

// AC6: 완료 후 캔버스 데이터 초기화
describe('clearCanvasData', () => {
  it('strokes, graffiti_images, graffiti_text 테이블을 모두 삭제한다', async () => {
    const chain = makeMockChain({
      gt: vi.fn().mockResolvedValue({ error: null }),
    });
    mockFrom.mockReturnValue(chain);

    await expect(clearCanvasData()).resolves.toBeUndefined();
    // 3개 테이블 삭제 호출 (변경된 테이블명 검증)
    expect(mockFrom).toHaveBeenCalledWith('strokes');
    expect(mockFrom).toHaveBeenCalledWith('graffiti_images');
    expect(mockFrom).toHaveBeenCalledWith('graffiti_text');
  });

  it('삭제 중 에러 발생 시 throw한다', async () => {
    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const shouldFail = callCount === 2; // graffiti_images 삭제에서 에러
      return makeMockChain({
        gt: vi.fn().mockResolvedValue({ error: shouldFail ? { message: 'Delete failed' } : null }),
      });
    });

    await expect(clearCanvasData()).rejects.toThrow('Delete failed');
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
