import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { Plus } from 'lucide-react';
import { GalleryBoard } from '@/components/gallery/GalleryBoard';
import { CanvasModal } from '@/components/gallery/CanvasModal';
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
    <div className="w-screen h-screen overflow-hidden bg-white relative">
      <GalleryBoard extraDrawings={extraDrawings} />

      {/* + 그림 추가 버튼 */}
      <button
        aria-label="그림 추가"
        onClick={() => setIsCanvasOpen(true)}
        className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-medium shadow-lg hover:bg-primary/90 transition-colors"
      >
        <Plus size={16} />
        그림 추가
      </button>

      <CanvasModal
        isOpen={isCanvasOpen}
        onClose={() => setIsCanvasOpen(false)}
        onDrawingAdded={handleDrawingAdded}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}
