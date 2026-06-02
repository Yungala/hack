import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
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
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);

  const userId = useRef(crypto.randomUUID());
  const userColor = useRef(CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTrackTime = useRef(0);
  const currentDraggingId = useRef<string | null>(null);
  const panStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

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
            toast('🎨 새 그림이 추가됐어요!', { duration: 3000 });
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

  // Presence — 접속자 수 전용
  useEffect(() => {
    const channel = supabase.channel('gallery-presence', {
      config: { presence: { key: userId.current } },
    });
    channel
      .on('presence', { event: 'sync' }, () => {
        setPresenceCount(Object.keys(channel.presenceState()).length);
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ online: true });
      });
    return () => { supabase.removeChannel(channel); };
  }, []);

  // Broadcast — 커서 위치 실시간 공유
  useEffect(() => {
    const channel = supabase.channel('gallery-cursors', {
      config: { broadcast: { self: false } },
    });
    channel
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const { uid, x, y, color, draggingCardId } = payload as RemoteCursor & { uid: string };
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.set(uid, { x, y, color, draggingCardId });
          return next;
        });
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        const { uid } = payload as { uid: string };
        setRemoteCursors((prev) => { const next = new Map(prev); next.delete(uid); return next; });
      })
      .subscribe();
    channelRef.current = channel;

    // 탭 닫힐 때 leave 브로드캐스트
    const handleUnload = () => {
      channel.send({ type: 'broadcast', event: 'leave', payload: { uid: userId.current } });
    };
    window.addEventListener('beforeunload', handleUnload);
    return () => {
      window.removeEventListener('beforeunload', handleUnload);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, []);

  function broadcastCursor(x: number, y: number, draggingCardId: string | null) {
    const now = Date.now();
    if (now - lastTrackTime.current < 40) return;
    lastTrackTime.current = now;
    channelRef.current?.send({
      type: 'broadcast',
      event: 'cursor',
      payload: { uid: userId.current, x, y, color: userColor.current, draggingCardId },
    });
  }

  function handleDragStart(cardId: string) {
    currentDraggingId.current = cardId;
  }

  function handleDragEnd() {
    currentDraggingId.current = null;
    broadcastCursor(0, 0, null);
  }

  const PAN_LIMIT = 100;

  function rubberBand(value: number, limit: number) {
    if (Math.abs(value) <= limit) return value;
    const excess = Math.abs(value) - limit;
    const sign = value > 0 ? 1 : -1;
    return sign * (limit + excess * 0.3);
  }

  function handleBoardPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-card]')) return;
    if ((e.target as HTMLElement).closest('[data-modal]')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsPanning(true);
    panStart.current = { px: e.clientX, py: e.clientY, ox: pan.x, oy: pan.y };
  }

  function handleBoardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    broadcastCursor(e.clientX, e.clientY, currentDraggingId.current);
    if (!panStart.current) return;
    const nx = panStart.current.ox + (e.clientX - panStart.current.px);
    const ny = panStart.current.oy + (e.clientY - panStart.current.py);
    setPan({ x: rubberBand(nx, PAN_LIMIT), y: rubberBand(ny, PAN_LIMIT) });
  }

  function handleBoardPointerUp() {
    panStart.current = null;
    setIsPanning(false);
    setPan((prev) => ({
      x: Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, prev.x)),
      y: Math.max(-PAN_LIMIT, Math.min(PAN_LIMIT, prev.y)),
    }));
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
    <div
      className="relative w-full h-full"
      style={{ cursor: 'grab' }}
      onPointerDown={handleBoardPointerDown}
      onPointerMove={handleBoardPointerMove}
      onPointerUp={handleBoardPointerUp}
    >
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

      {/* pan 레이어: 카드 + 커서 */}
      <div
        className="absolute inset-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          transition: isPanning ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
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
      </div>

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
