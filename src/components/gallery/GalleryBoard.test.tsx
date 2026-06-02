import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

// Supabase mock (Realtime 포함)
vi.mock('@/lib/supabase', () => {
  const mockChannel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };
  return {
    supabase: {
      channel: vi.fn(() => mockChannel),
      removeChannel: vi.fn(),
    },
  };
});

vi.mock('@/lib/api/drawings', () => ({
  fetchDrawings: vi.fn(),
}));

import { fetchDrawings } from '@/lib/api/drawings';
import { GalleryBoard } from './GalleryBoard';

const mockFetchDrawings = fetchDrawings as ReturnType<typeof vi.fn>;

const drawing1 = {
  id: '123e4567-e89b-12d3-a456-426614174001',
  image_url: 'https://example.com/image1.png',
  x: 100,
  y: 200,
  created_at: '2026-06-02T00:00:00Z',
};

const drawing2 = {
  id: '123e4567-e89b-12d3-a456-426614174002',
  image_url: 'https://example.com/image2.png',
  x: 300,
  y: 400,
  created_at: '2026-06-02T01:00:00Z',
};

// AC1: 갤러리 보드 초기 카드 표시
describe('GalleryBoard', () => {
  it('drawings 테이블에서 로드한 카드를 모두 표시한다 (AC1)', async () => {
    mockFetchDrawings.mockResolvedValue([drawing1, drawing2]);
    render(<GalleryBoard />);
    await waitFor(() => {
      const imgs = screen.getAllByRole('img', { name: '그림 카드' });
      expect(imgs).toHaveLength(2);
    });
  });

  // AC2: 카드가 없을 때 플레이스홀더 표시
  it('카드가 없을 때 "당신의 그림을 추가하세요" 텍스트가 표시된다 (AC2)', async () => {
    mockFetchDrawings.mockResolvedValue([]);
    render(<GalleryBoard />);
    await waitFor(() => {
      expect(screen.getByText('당신의 그림을 추가하세요')).toBeDefined();
    });
  });

  it('카드가 있을 때 플레이스홀더 텍스트가 표시되지 않는다 (AC2 반전)', async () => {
    mockFetchDrawings.mockResolvedValue([drawing1]);
    render(<GalleryBoard />);
    await waitFor(() => {
      expect(screen.queryByText('당신의 그림을 추가하세요')).toBeNull();
    });
  });

  // AC10, AC11: Realtime 구독 설정 확인
  it('컴포넌트 마운트 시 Realtime gallery 채널을 구독한다 (AC10, AC11)', async () => {
    const { supabase } = await import('@/lib/supabase');
    mockFetchDrawings.mockResolvedValue([]);
    render(<GalleryBoard />);
    await waitFor(() => {
      expect(supabase.channel).toHaveBeenCalledWith('gallery');
    });
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
