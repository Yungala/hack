import { render, screen, fireEvent } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GalleryCard } from './GalleryCard';
import type { Drawing } from '@/lib/supabase';

// updateDrawingPosition mock
vi.mock('@/lib/api/drawings', () => ({
  updateDrawingPosition: vi.fn().mockResolvedValue(undefined),
}));

// jsdom은 setPointerCapture를 지원하지 않으므로 전역 mock 설정
beforeEach(() => {
  Element.prototype.setPointerCapture = vi.fn();
  Element.prototype.releasePointerCapture = vi.fn();
});

const mockDrawing: Drawing = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  image_url: 'https://example.com/image.png',
  x: 100,
  y: 200,
  likes: 0,
  created_at: '2026-06-02T00:00:00Z',
};

const defaultCardProps = {
  isRemotelyDragged: false,
  onDragStart: vi.fn(),
  onDragEnd: vi.fn(),
};

// AC1: 카드가 저장된 x, y 좌표에 배치됨
describe('GalleryCard', () => {
  it('저장된 x, y 좌표로 카드가 렌더링된다', () => {
    const onClick = vi.fn();
    const { container } = render(<GalleryCard drawing={mockDrawing} onClick={onClick} {...defaultCardProps} />);
    const card = container.firstChild as HTMLElement;
    expect(card.style.left).toBe('100px');
    expect(card.style.top).toBe('200px');
  });

  it('카드 이미지가 표시된다', () => {
    const onClick = vi.fn();
    render(<GalleryCard drawing={mockDrawing} onClick={onClick} {...defaultCardProps} />);
    const img = screen.getByRole('img', { name: '그림 카드' });
    expect(img).toHaveAttribute('src', mockDrawing.image_url);
  });

  // AC12: 카드 단순 클릭 시 onClick 호출 (드래그 아님)
  it('드래그 없이 클릭하면 onClick이 호출된다', () => {
    const onClick = vi.fn();
    const { container } = render(<GalleryCard drawing={mockDrawing} onClick={onClick} {...defaultCardProps} />);
    const card = container.firstChild as HTMLElement;

    // pointerdown → pointerup (이동 없음 = 클릭)
    fireEvent.pointerDown(card, { clientX: 100, clientY: 200, pointerId: 1 });
    fireEvent.pointerUp(card, { clientX: 100, clientY: 200, pointerId: 1 });

    expect(onClick).toHaveBeenCalledWith(mockDrawing);
  });

  // AC10: Realtime UPDATE 이벤트로 drawing.x/y가 변경되면 pos 상태가 갱신된다
  it('drawing.x/y 변경 시 pos 상태가 갱신된다 (AC10)', () => {
    const onClick = vi.fn();
    const updatedDrawing: Drawing = { ...mockDrawing, x: 300, y: 400 };

    const { container, rerender } = render(
      <GalleryCard drawing={mockDrawing} onClick={onClick} {...defaultCardProps} />
    );
    const card = container.firstChild as HTMLElement;
    expect(card.style.left).toBe('100px');
    expect(card.style.top).toBe('200px');

    // Realtime UPDATE로 drawing prop이 새 좌표로 변경됨
    rerender(<GalleryCard drawing={updatedDrawing} onClick={onClick} {...defaultCardProps} />);
    expect(card.style.left).toBe('300px');
    expect(card.style.top).toBe('400px');
  });

  // AC9: 드래그 종료 시 updateDrawingPosition 호출
  // 참고: jsdom에서 fireEvent.pointerMove의 clientX가 컴포넌트 핸들러에 전달되지 않는 한계가 있어
  // 드래그 임계값(4px)을 초과하는 이동 시뮬레이션이 불가능하다.
  // → 이 시나리오는 E2E2 (E2E 테스트)로 위임한다.
  it.skip('드래그 종료 시 updateDrawingPosition이 호출된다 (E2E로 위임)', () => {
    // E2E2 시나리오 참조
  });
});

afterEach(() => {
  vi.clearAllMocks();
});
