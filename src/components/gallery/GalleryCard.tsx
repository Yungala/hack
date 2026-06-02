import { useEffect, useRef, useState } from 'react';
import type { Drawing } from '@/lib/supabase';
import { updateDrawingPosition } from '@/lib/api/drawings';
import { cn } from '@/lib/utils';

interface GalleryCardProps {
  drawing: Drawing;
  isRemotelyDragged: boolean;
  isRemotelyViewed?: boolean;
  remotePos?: { x: number; y: number };
  onDragStart: () => void;
  onDragMove?: (x: number, y: number) => void;
  onDragEnd: () => void;
  onClick: (drawing: Drawing) => void;
}

const CARD_MAX = 100;

export function GalleryCard({ drawing, isRemotelyDragged, isRemotelyViewed, remotePos, onDragStart, onDragMove, onDragEnd, onClick }: GalleryCardProps) {
  const [pos, setPos] = useState({ x: drawing.x, y: drawing.y });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [size, setSize] = useState({ w: CARD_MAX, h: CARD_MAX });
  const [isCardDragging, setIsCardDragging] = useState(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; cardX: number; cardY: number } | null>(null);
  const hasDragged = useRef(false);
  const isDragging = useRef(false);

  // 월드(고정 캔버스) 경계
  const BOARD_W = 1800;
  const BOARD_H = 1000;
  const CARD_HALF = 60;
  const minX = CARD_HALF;
  const minY = CARD_HALF;
  function maxX() { return BOARD_W - CARD_HALF; }
  function maxY() { return BOARD_H - CARD_HALF; }

  useEffect(() => {
    if (!isDragging.current) {
      setPos({ x: drawing.x, y: drawing.y });
    }
  }, [drawing.x, drawing.y]);

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    isDragging.current = true;
    setIsCardDragging(true);
    onDragStart();
    dragStart.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      cardX: pos.x,
      cardY: pos.y,
    };
    hasDragged.current = false;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!dragStart.current) return;
    const dx = e.clientX - dragStart.current.mouseX;
    const dy = e.clientY - dragStart.current.mouseY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      hasDragged.current = true;
    }
    if (hasDragged.current) {
      const nx = dragStart.current.cardX + dx;
      const ny = dragStart.current.cardY + dy;
      setPos({ x: nx, y: ny });
      onDragMove?.(nx, ny);
    }
  }

  function handlePointerUp() {
    if (!dragStart.current) return;
    const wasDrag = hasDragged.current;
    dragStart.current = null;
    hasDragged.current = false;
    isDragging.current = false;
    setIsCardDragging(false);
    onDragEnd();

    if (wasDrag) {
      const clampedX = Math.max(minX, Math.min(maxX(), pos.x));
      const clampedY = Math.max(minY, Math.min(maxY(), pos.y));
      setPos({ x: clampedX, y: clampedY });
      updateDrawingPosition(drawing.id, clampedX, clampedY).catch((err: unknown) => {
        console.error('위치 저장 실패:', err);
      });
    } else {
      onClick(drawing);
    }
  }

  const effectivePos = remotePos ?? pos;
  const isFollowing = remotePos != null;
  const showOutline = isRemotelyDragged || isRemotelyViewed;

  return (
    <div
      style={{
        position: 'absolute',
        left: effectivePos.x,
        top: effectivePos.y,
        width: size.w,
        height: size.h,
        transform: 'translate(-50%, -50%)',
        transition: isCardDragging
          ? 'none'
          : isFollowing
            ? 'left 0.08s linear, top 0.08s linear'
            : 'left 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275), top 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none',
        outline: showOutline ? '2.5px solid #60A5FA' : 'none',
        outlineOffset: '3px',
        borderRadius: 4,
      }}
      data-card="true"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="overflow-hidden"
    >
      {!imageLoaded && (
        <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 animate-pulse opacity-50" />
      )}
      <img
        src={drawing.image_url}
        alt="그림 카드"
        className={cn('w-full h-full object-contain pointer-events-none transition-opacity duration-300', imageLoaded ? 'opacity-100' : 'opacity-0')}
        draggable={false}
        onLoad={(e) => {
          const img = e.currentTarget;
          const ratio = img.naturalWidth / img.naturalHeight;
          setSize({ w: Math.round(CARD_MAX * ratio), h: CARD_MAX });
          setImageLoaded(true);
        }}
      />
    </div>
  );
}
