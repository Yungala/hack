import { useEffect, useRef, useState } from 'react';
import type { Drawing } from '@/lib/supabase';
import { updateDrawingPosition } from '@/lib/api/drawings';

interface GalleryCardProps {
  drawing: Drawing;
  onClick: (drawing: Drawing) => void;
}

const CARD_W = 200;
const CARD_H = 200;

export function GalleryCard({ drawing, onClick }: GalleryCardProps) {
  const [pos, setPos] = useState({ x: drawing.x, y: drawing.y });
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
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="rounded-xl overflow-hidden shadow-lg border border-border bg-background hover:shadow-xl transition-shadow"
    >
      <img
        src={drawing.image_url}
        alt="그림 카드"
        className="w-full h-full object-cover pointer-events-none"
        draggable={false}
      />
    </div>
  );
}
