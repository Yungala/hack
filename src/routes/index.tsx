import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { Plus, Heart } from 'lucide-react';
import { GalleryBoard } from '@/components/gallery/GalleryBoard';
import { CanvasModal } from '@/components/gallery/CanvasModal';
import { LikesDrawer } from '@/components/gallery/LikesDrawer';
import { CardViewer } from '@/components/gallery/CardViewer';
import SpotlightCard from '@/components/ui/SpotlightCard';
import type { Drawing } from '@/lib/supabase';

export const Route = createFileRoute('/')({
  component: GalleryBoardPage,
});

function GalleryBoardPage() {
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [extraDrawings, setExtraDrawings] = useState<Drawing[]>([]);
  const [isLikesOpen, setIsLikesOpen] = useState(false);
  const [viewerDrawing, setViewerDrawing] = useState<Drawing | null>(null);
  const [presenceCount, setPresenceCount] = useState(1);
  const [drawingCount, setDrawingCount] = useState(0);

  function handleDrawingAdded(drawing: Drawing) {
    setExtraDrawings((prev) => {
      if (prev.some((d) => d.id === drawing.id)) return prev;
      return [...prev, drawing];
    });
    setDrawingCount((n) => n + 1);
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
      {/* 가장자리 그라디언트 */}
      <div
        className="fixed inset-0 pointer-events-none z-10"
        style={{
          background: `
            linear-gradient(to right, rgba(210,205,195,0.55) 0%, transparent 7%),
            linear-gradient(to left,  rgba(210,205,195,0.55) 0%, transparent 7%),
            linear-gradient(to bottom, rgba(210,205,195,0.55) 0%, transparent 7%),
            linear-gradient(to top,   rgba(210,205,195,0.55) 0%, transparent 7%)
          `,
        }}
      />

      {/* 중앙 가이드 텍스트 */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 select-none">
        <p style={{ color: 'rgba(0,0,0,0.18)', fontSize: 15, fontWeight: 400, letterSpacing: '0.01em', fontFamily: 'Pretendard, sans-serif' }}>
          그림을 추가해서 캔버스를 꾸며주세요
        </p>
      </div>

      <GalleryBoard
        extraDrawings={extraDrawings}
        onPresenceChange={setPresenceCount}
        onDrawingCountChange={setDrawingCount}
      />

      {/* 좋아요 버튼 (우측 상단) */}
      <button
        aria-label="인기 그림 보기"
        onClick={() => setIsLikesOpen(true)}
        className="fixed top-3 right-28 z-40 flex items-center gap-1.5 bg-black/50 backdrop-blur rounded-full px-3 py-1.5 text-white text-xs select-none hover:bg-black/70 transition-colors"
      >
        <Heart size={13} fill="currentColor" className="text-red-400" />
        인기 그림
      </button>

      {/* + 그림 추가 버튼 */}
      <div className="fixed bottom-[62px] left-1/2 -translate-x-1/2 z-40">
        <SpotlightCard
          className="!bg-black !border-transparent !p-0 !rounded-full shadow-lg"
          spotlightColor="rgba(255, 255, 255, 0.2)"
        >
          <button
            aria-label="그림 추가"
            onClick={() => setIsCanvasOpen(true)}
            className="flex items-center gap-2 px-6 py-3 rounded-full text-white font-medium text-base transition-all duration-200 hover:scale-105 active:scale-95"
          >
            <Plus size={19} />
            그림 추가
          </button>
        </SpotlightCard>
      </div>

      {/* 통계 */}
      <div className="fixed bottom-[26px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 text-sm select-none pointer-events-none"
        style={{ color: 'rgba(0,0,0,0.55)', fontFamily: 'Pretendard, sans-serif' }}
      >
        <span>접속한 사람 : {presenceCount}명</span>
        <span style={{ opacity: 0.4 }}>·</span>
        <span>등록된 그림 : {drawingCount}개</span>
      </div>

      <LikesDrawer
        isOpen={isLikesOpen}
        onClose={() => setIsLikesOpen(false)}
        onSelect={(drawing) => { setIsLikesOpen(false); setViewerDrawing(drawing); }}
      />

      {viewerDrawing && (
        <CardViewer
          drawing={viewerDrawing}
          onClose={() => setViewerDrawing(null)}
          onLiked={(newLikes) => setViewerDrawing(prev => prev ? { ...prev, likes: newLikes } : prev)}
        />
      )}

      <CanvasModal
        isOpen={isCanvasOpen}
        onClose={() => setIsCanvasOpen(false)}
        onDrawingAdded={handleDrawingAdded}
      />

      <Toaster position="top-center" richColors />
    </div>
  );
}
