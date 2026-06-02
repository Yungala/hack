import { useEffect, useMemo, useState } from 'react';
import { supabase, type Drawing } from '@/lib/supabase';
import { fetchDrawings } from '@/lib/api/drawings';
import { DrawingSchema } from '@/lib/schemas/drawing';
import { GalleryCard } from './GalleryCard';
import { CardViewer } from './CardViewer';

interface GalleryBoardProps {
  extraDrawings?: Drawing[];
}

export function GalleryBoard({ extraDrawings = [] }: GalleryBoardProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [viewerDrawing, setViewerDrawing] = useState<Drawing | null>(null);

  // 초기 로드
  useEffect(() => {
    fetchDrawings()
      .then((data) => setDrawings(data))
      .catch((err: unknown) => console.error('drawings 로드 실패:', err));
  }, []);

  // Realtime 구독
  useEffect(() => {
    const channel = supabase
      .channel('gallery')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'drawings' },
        (payload) => {
          const result = DrawingSchema.safeParse(payload.new);
          if (!result.success) return;
          setDrawings((prev) => {
            if (prev.some((d) => d.id === result.data.id)) return prev;
            return [...prev, result.data];
          });
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'drawings' },
        (payload) => {
          const result = DrawingSchema.safeParse(payload.new);
          if (!result.success) return;
          setDrawings((prev) =>
            prev.map((d) => (d.id === result.data.id ? result.data : d))
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // extraDrawings에서 아직 drawings에 없는 항목만 병합 (낙관적 업데이트)
  const merged = useMemo(() => {
    const ids = new Set(drawings.map((d) => d.id));
    const optimistic = extraDrawings.filter((d) => !ids.has(d.id));
    return [...drawings, ...optimistic];
  }, [drawings, extraDrawings]);

  return (
    <>
      {/* 플레이스홀더 텍스트 */}
      {merged.length === 0 && (
        <div
          className="fixed inset-0 flex items-center justify-center pointer-events-none z-0"
          style={{ opacity: 0.15 }}
        >
          <p className="text-foreground text-2xl font-medium select-none">
            당신의 그림을 추가하세요
          </p>
        </div>
      )}

      {/* 카드 자유 배치 */}
      <div className="relative w-full h-full">
        {merged.map((drawing) => (
          <GalleryCard
            key={drawing.id}
            drawing={drawing}
            onClick={setViewerDrawing}
          />
        ))}
      </div>

      {/* 카드 뷰어 모달 */}
      {viewerDrawing && (
        <CardViewer
          drawing={viewerDrawing}
          onClose={() => setViewerDrawing(null)}
        />
      )}
    </>
  );
}
