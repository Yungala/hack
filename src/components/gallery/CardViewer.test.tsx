import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CardViewer } from './CardViewer';
import type { Drawing } from '@/lib/supabase';

const mockDrawing: Drawing = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  image_url: 'https://example.com/image.png',
  x: 100,
  y: 200,
  likes: 0,
  created_at: '2026-06-02T00:00:00Z',
};

// AC12: 카드 뷰어 모달
describe('CardViewer', () => {
  it('카드 이미지가 확대 표시된다', () => {
    const onClose = vi.fn();
    render(<CardViewer drawing={mockDrawing} onClose={onClose} />);
    const img = screen.getByRole('img', { name: '갤러리 그림' });
    expect(img).toHaveAttribute('src', mockDrawing.image_url);
  });

  it('닫기 버튼 클릭 시 onClose가 호출된다', () => {
    const onClose = vi.fn();
    render(<CardViewer drawing={mockDrawing} onClose={onClose} />);
    const closeBtn = screen.getByRole('button', { name: '닫기' });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('모달 외부(배경) 클릭 시 onClose가 호출된다', () => {
    const onClose = vi.fn();
    const { container } = render(<CardViewer drawing={mockDrawing} onClose={onClose} />);
    // 최상위 overlay div 클릭
    const overlay = container.firstChild as HTMLElement;
    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('내부 이미지 클릭 시 onClose가 호출되지 않는다 (stopPropagation)', () => {
    const onClose = vi.fn();
    render(<CardViewer drawing={mockDrawing} onClose={onClose} />);
    const img = screen.getByRole('img', { name: '갤러리 그림' });
    fireEvent.click(img);
    expect(onClose).not.toHaveBeenCalled();
  });

  // AC8 관련: ESC 키로 닫기
  it('ESC 키 누르면 onClose가 호출된다', () => {
    const onClose = vi.fn();
    render(<CardViewer drawing={mockDrawing} onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
