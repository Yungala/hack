import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/drawings', () => ({
  uploadDrawingImage: vi.fn(),
  insertDrawing: vi.fn(),
  clearCanvasData: vi.fn(),
}));

// sonner toast mock
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

import { uploadDrawingImage, insertDrawing, clearCanvasData } from '@/lib/api/drawings';
import { toast } from 'sonner';
import { CanvasModal } from './CanvasModal';

const mockUpload = uploadDrawingImage as ReturnType<typeof vi.fn>;
const mockInsert = insertDrawing as ReturnType<typeof vi.fn>;
const mockClear = clearCanvasData as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

// canvas.toBlob mock
beforeEach(() => {
  HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => {
    cb(new Blob(['fake'], { type: 'image/png' }));
  });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: '',
    lineJoin: '',
  })) as unknown as typeof HTMLCanvasElement.prototype.getContext;
});

// AC3: CanvasModal 열림 및 캔버스/도구 표시
describe('CanvasModal', () => {
  it('isOpen=false 이면 아무것도 렌더링하지 않는다', () => {
    const { container } = render(
      <CanvasModal isOpen={false} onClose={vi.fn()} onDrawingAdded={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('isOpen=true 이면 캔버스와 완료 버튼이 표시된다 (AC3)', () => {
    render(
      <CanvasModal isOpen={true} onClose={vi.fn()} onDrawingAdded={vi.fn()} />
    );
    expect(screen.getByRole('button', { name: /완료/ })).toBeDefined();
    expect(document.querySelector('canvas')).toBeDefined();
  });

  // AC7: X 버튼으로 닫기
  it('닫기(X) 버튼 클릭 시 onClose가 호출된다 (AC7)', () => {
    const onClose = vi.fn();
    render(
      <CanvasModal isOpen={true} onClose={onClose} onDrawingAdded={vi.fn()} />
    );
    const closeBtn = screen.getByRole('button', { name: '닫기' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // AC8: ESC 키로 닫기
  it('ESC 키를 누르면 onClose가 호출된다 (AC8)', () => {
    const onClose = vi.fn();
    render(
      <CanvasModal isOpen={true} onClose={onClose} onDrawingAdded={vi.fn()} />
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // AC6: 완료 버튼 → Storage 업로드 → insert → 모달 닫기
  it('완료 버튼 클릭 시 upload → insert → clearCanvasData → onClose 순서로 호출된다 (AC6)', async () => {
    const callOrder: string[] = [];
    mockUpload.mockImplementation(async () => {
      callOrder.push('upload');
      return 'https://storage.example.com/img.png';
    });
    mockInsert.mockImplementation(async () => {
      callOrder.push('insert');
      return { id: 'id', image_url: 'https://storage.example.com/img.png', x: 0, y: 0, created_at: '' };
    });
    mockClear.mockImplementation(async () => {
      callOrder.push('clear');
    });

    const onClose = vi.fn();
    const onDrawingAdded = vi.fn();

    render(
      <CanvasModal isOpen={true} onClose={onClose} onDrawingAdded={onDrawingAdded} />
    );

    const confirmBtn = screen.getByRole('button', { name: /완료/ });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    expect(callOrder).toEqual(['upload', 'insert', 'clear']);
    expect(onDrawingAdded).toHaveBeenCalledTimes(1);
  });

  // AC13: Storage 업로드 실패 시 토스트 표시, 모달 유지
  it('Storage 업로드 실패 시 toast.error가 호출되고 모달이 닫히지 않는다 (AC13)', async () => {
    mockUpload.mockRejectedValue(new Error('Upload failed'));
    const onClose = vi.fn();

    render(
      <CanvasModal isOpen={true} onClose={onClose} onDrawingAdded={vi.fn()} />
    );

    const confirmBtn = screen.getByRole('button', { name: /완료/ });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(expect.stringContaining('Upload failed'));
    });

    expect(onClose).not.toHaveBeenCalled();
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
