import { useEffect, useRef, useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { Plus, Heart } from 'lucide-react';
import { GalleryBoard } from '@/components/gallery/GalleryBoard';
import { CanvasModal } from '@/components/gallery/CanvasModal';
import { LikesDrawer } from '@/components/gallery/LikesDrawer';
import { CardViewer } from '@/components/gallery/CardViewer';
import SpotlightCard from '@/components/ui/SpotlightCard';
import { supabase, type Drawing } from '@/lib/supabase';

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
  const [drawingNowCount, setDrawingNowCount] = useState(0);

  const drawingUserId = useRef(crypto.randomUUID());
  const drawingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 그림 그리는 중 presence 채널 (관전 + 본인 track)
  useEffect(() => {
    const channel = supabase.channel('gallery-drawing', {
      config: { presence: { key: drawingUserId.current } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        const others = Object.keys(channel.presenceState()).filter(
          (k) => k !== drawingUserId.current
        );
        setDrawingNowCount(others.length);
      })
      .subscribe();
    drawingChannelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      drawingChannelRef.current = null;
    };
  }, []);

  // 캔버스 열림 상태를 presence로 track/untrack
  useEffect(() => {
    const channel = drawingChannelRef.current;
    if (!channel) return;
    if (isCanvasOpen) channel.track({ drawing: true });
    else channel.untrack();
  }, [isCanvasOpen]);

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

      {/* ART GALLERY 배경 텍스트 */}
      <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-0 select-none">
        <p style={{ color: 'rgba(0,0,0,0.06)', fontSize: 48, fontWeight: 700, letterSpacing: '0.12em', fontFamily: 'Pretendard, sans-serif' }}>
          ART GALLERY
        </p>
      </div>

      <GalleryBoard
        extraDrawings={extraDrawings}
        onPresenceChange={setPresenceCount}
        onDrawingCountChange={setDrawingCount}
      />

      {/* 인기 그림 버튼 (좌측 상단) */}
      <button
        aria-label="인기 그림 보기"
        onClick={() => setIsLikesOpen(true)}
        className="fixed top-4 left-4 z-40 flex items-center gap-1.5 bg-white rounded-full px-4 py-2 text-[#1a1a1a] text-sm font-medium select-none shadow-sm border border-black/8 hover:bg-gray-50 transition-colors"
      >
        <Heart size={14} fill="currentColor" className="text-[#1a1a1a] opacity-50" />
        인기 그림
      </button>

      {/* 그림 그리는 중 표시 */}
      {drawingNowCount > 0 && (
        <div className="fixed top-16 md:top-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#1a1a1a] select-none pointer-events-none">
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-60 animate-ping" />
            <span className="relative inline-flex w-2 h-2 rounded-full bg-green-500" />
          </span>
          {drawingNowCount}명이 그림을 그리는 중...
        </div>
      )}

      {/* + 그림 추가 버튼 */}
      <div className="fixed bottom-[62px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
        <div className="relative pointer-events-none select-none">
          <div className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-medium shadow-md whitespace-nowrap">
            그림을 추가해서 캔버스를 꾸며주세요
          </div>
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2.5 h-2.5 bg-black rotate-45 rounded-[2px]"
          />
        </div>
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
      <div className="fixed bottom-[26px] left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 select-none pointer-events-none whitespace-nowrap text-sm"
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
