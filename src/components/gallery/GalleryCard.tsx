import { useEffect, useRef, useState } from 'react';
import type { Drawing } from '@/lib/supabase';
import { updateDrawingPosition } from '@/lib/api/drawings';
import { cn } from '@/lib/utils';

interface GalleryCardProps {
  drawing: Drawing;
  isRemotelyDragged: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: (drawing: Drawing) => void;
}

const CARD_W = 100;
const CARD_H = 100;

export function GalleryCard({ drawing, isRemotelyDragged, onDragStart, onDragEnd, onClick }: GalleryCardProps) {
  const [pos, setPos] = useState({ x: drawing.x, y: drawing.y });
  const [imageLoaded, setImageLoaded] = useState(false);
  const dragStart = useRef<{ mouseX: number; mouseY: number; cardX: number; cardY: number } | null>(null);
  const hasDragged = useRef(false);
  const isDragging = useRef(false);

  useEffect(() => {
    if (!isDragging.current) {
      setPos({ x: drawing.x, y: drawing.y });
    }
  }, [drawing.x, drawing.y]);

  function handlePointerDown(e: React.PointerEvent) {
    e.preventDefault();
    isDragging.current = true;
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
      setPos({
        x: dragStart.current.cardX + dx,
        y: dragStart.current.cardY + dy,
      });
    }
  }

  function handlePointerUp() {
    if (!dragStart.current) return;
    const wasDrag = hasDragged.current;
    dragStart.current = null;
    hasDragged.current = false;
    isDragging.current = false;
    onDragEnd();

    if (wasDrag) {
      updateDrawingPosition(drawing.id, pos.x, pos.y).catch((err: unknown) => {
        console.error('위치 저장 실패:', err);
      });
    } else {
      onClick(drawing);
    }
  }

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: CARD_W,
        height: CARD_H,
        transform: 'translate(-50%, -50%)',
        cursor: 'grab',
        userSelect: 'none',
        backgroundColor: '#f4f1ea',
        outline: isRemotelyDragged ? '2.5px solid #60A5FA' : 'none',
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
        className={cn('w-full h-full object-cover pointer-events-none transition-opacity duration-300', imageLoaded ? 'opacity-100' : 'opacity-0')}
        draggable={false}
        onLoad={() => setImageLoaded(true)}
      />
    </div>
  );
}
