import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase, type Drawing } from '@/lib/supabase';
import { fetchDrawings } from '@/lib/api/drawings';
import { DrawingSchema } from '@/lib/schemas/drawing';
import { GalleryCard } from './GalleryCard';
import { CardViewer } from './CardViewer';

interface GalleryBoardProps {
  extraDrawings?: Drawing[];
}

interface RemoteCursor {
  x: number;
  y: number;
  color: string;
  draggingCardId: string | null;
}

const CURSOR_COLORS = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#F59E0B', '#34D399', '#F472B6', '#60A5FA'];

export function GalleryBoard({ extraDrawings = [] }: GalleryBoardProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [viewerDrawing, setViewerDrawing] = useState<Drawing | null>(null);
  const [presenceCount, setPresenceCount] = useState(1);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());

  const userId = useRef(crypto.randomUUID());
  const userColor = useRef(CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTrackTime = useRef(0);
  const currentDraggingId = useRef<string | null>(null);

  // 초기 로드
  useEffect(() => {
    fetchDrawings()
      .then((data) => setDrawings(data))
      .catch((err: unknown) => console.error('drawings 로드 실패:', err));
  }, []);

  // Realtime 구독 (drawings)
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

  // Presence 채널 — 커서 위치 + 드래그 중인 카드 공유
  useEffect(() => {
    const channel = supabase.channel('gallery-presence', {
      config: { presence: { key: userId.current } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<RemoteCursor>();
        const cursors = new Map<string, RemoteCursor>();
        let count = 0;
        for (const [key, presences] of Object.entries(state)) {
          count++;
          if (key !== userId.current) {
            const p = presences[0] as RemoteCursor;
            cursors.set(key, p);
          }
        }
        setPresenceCount(count);
        setRemoteCursors(new Map(cursors));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            x: 0, y: 0,
            color: userColor.current,
            draggingCardId: null,
          });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  function trackPresence(x: number, y: number, draggingCardId: string | null) {
    const now = Date.now();
    if (now - lastTrackTime.current < 40) return; // 40ms 쓰로틀
    lastTrackTime.current = now;
    channelRef.current?.track({ x, y, color: userColor.current, draggingCardId });
  }

  function handleMouseMove(e: React.MouseEvent) {
    trackPresence(e.clientX, e.clientY, currentDraggingId.current);
  }

  function handleDragStart(cardId: string) {
    currentDraggingId.current = cardId;
  }

  function handleDragEnd() {
    currentDraggingId.current = null;
    channelRef.current?.track({
      x: 0, y: 0,
      color: userColor.current,
      draggingCardId: null,
    });
  }

  const merged = useMemo(() => {
    const ids = new Set(drawings.map((d) => d.id));
    const optimistic = extraDrawings.filter((d) => !ids.has(d.id));
    return [...drawings, ...optimistic];
  }, [drawings, extraDrawings]);

  // 다른 유저가 드래그 중인 카드 ID 집합
  const remotelyDraggedIds = useMemo(() => {
    const ids = new Set<string>();
    for (const cursor of remoteCursors.values()) {
      if (cursor.draggingCardId) ids.add(cursor.draggingCardId);
    }
    return ids;
  }, [remoteCursors]);

  return (
    <div className="relative w-full h-full" onMouseMove={handleMouseMove}>
      {/* 접속자 수 */}
      <div className="fixed top-3 right-4 z-40 flex items-center gap-1.5 bg-black/50 backdrop-blur rounded-full px-3 py-1.5 text-white text-xs select-none">
        <span className="inline-block w-2 h-2 rounded-full bg-green-400" />
        {presenceCount}명 접속 중
      </div>

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
      {merged.map((drawing) => (
        <GalleryCard
          key={drawing.id}
          drawing={drawing}
          isRemotelyDragged={remotelyDraggedIds.has(drawing.id)}
          onDragStart={() => handleDragStart(drawing.id)}
          onDragEnd={handleDragEnd}
          onClick={setViewerDrawing}
        />
      ))}

      {/* 다른 유저 커서 */}
      {Array.from(remoteCursors.entries()).map(([id, cursor]) => (
        cursor.x === 0 && cursor.y === 0 ? null : (
          <RemoteCursorEl key={id} cursor={cursor} />
        )
      ))}

      {/* 카드 뷰어 모달 */}
      {viewerDrawing && (
        <CardViewer
          drawing={viewerDrawing}
          onClose={() => setViewerDrawing(null)}
          onLiked={(newLikes) => setViewerDrawing(prev => prev ? { ...prev, likes: newLikes } : prev)}
        />
      )}
    </div>
  );
}

function RemoteCursorEl({ cursor }: { cursor: RemoteCursor }) {
  return (
    <div
      className="fixed pointer-events-none z-50"
      style={{ left: cursor.x, top: cursor.y, transform: 'translate(-2px, -2px)' }}
    >
      {/* 화살표 커서 SVG */}
      <svg width="20" height="24" viewBox="0 0 20 24" fill="none">
        <path
          d="M3 2 L3 18 L7.5 13.5 L10.5 20 L13 19 L10 12.5 L16 12.5 Z"
          fill={cursor.color}
          stroke="white"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
