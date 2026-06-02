import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { Plus } from 'lucide-react';
import { GalleryBoard } from '@/components/gallery/GalleryBoard';
import { CanvasModal } from '@/components/gallery/CanvasModal';
import SpotlightCard from '@/components/ui/SpotlightCard';
import type { Drawing } from '@/lib/supabase';

export const Route = createFileRoute('/')({
  component: GalleryBoardPage,
});

function GalleryBoardPage() {
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [extraDrawings, setExtraDrawings] = useState<Drawing[]>([]);

  function handleDrawingAdded(drawing: Drawing) {
    setExtraDrawings((prev) => {
      if (prev.some((d) => d.id === drawing.id)) return prev;
      return [...prev, drawing];
    });
  }

  return (
    <div
      className="w-screen h-screen overflow-hidden relative"
      style={{
        backgroundColor: '#f4f1ea',
        backgroundImage: `
          linear-gradient(rgba(0,0,0,0.045) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,0,0,0.045) 1px, transparent 1px)
        `,
        backgroundSize: '80px 80px',
      }}
    >
      {/* 중앙 가이드 텍스트 */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 select-none">
        <p style={{ color: 'rgba(0,0,0,0.18)', fontSize: 15, fontWeight: 500, letterSpacing: '0.01em' }}>
          그림을 추가해서 캔버스를 꾸며주세요
        </p>
      </div>

      <GalleryBoard extraDrawings={extraDrawings} />

      {/* + 그림 추가 버튼 */}
      <SpotlightCard
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 !bg-primary !border-primary/20 !p-0 !rounded-full shadow-lg"
        spotlightColor="rgba(255, 255, 255, 0.2)"
      >
        <button
          aria-label="그림 추가"
          onClick={() => setIsCanvasOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-full text-primary-foreground font-medium"
        >
          <Plus size={16} />
          그림 추가
        </button>
      </SpotlightCard>

      <CanvasModal
        isOpen={isCanvasOpen}
        onClose={() => setIsCanvasOpen(false)}
        onDrawingAdded={handleDrawingAdded}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}
