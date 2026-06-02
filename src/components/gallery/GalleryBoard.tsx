import { useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase, type Drawing } from '@/lib/supabase';
import { fetchDrawings } from '@/lib/api/drawings';
import { DrawingSchema } from '@/lib/schemas/drawing';
import { GalleryCard } from './GalleryCard';
import { CardViewer } from './CardViewer';

interface GalleryBoardProps {
  extraDrawings?: Drawing[];
  onPresenceChange?: (count: number) => void;
  onDrawingCountChange?: (count: number) => void;
}

interface RemoteCursor {
  x: number;
  y: number;
  color: string;
  draggingCardId: string | null;
}

const CURSOR_COLORS = ['#FF6B6B', '#4ECDC4', '#A78BFA', '#F59E0B', '#34D399', '#F472B6', '#60A5FA'];

// 고정 캔버스(월드) 크기
const BOARD_W = 1800;
const BOARD_H = 1000;
// 화면이 월드보다 클 때 허용하는 여유 pan
const EDGE_MARGIN = 80;

export function GalleryBoard({ extraDrawings = [], onPresenceChange, onDrawingCountChange }: GalleryBoardProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [viewerDrawing, setViewerDrawing] = useState<Drawing | null>(null);
  const [remoteCursors, setRemoteCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const [remoteCardPositions, setRemoteCardPositions] = useState<Map<string, { x: number; y: number }>>(new Map());
  const [remoteViewing, setRemoteViewing] = useState<Map<string, string>>(new Map());
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [scale, setScale] = useState(1);

  const userId = useRef(crypto.randomUUID());
  const userColor = useRef(CURSOR_COLORS[Math.floor(Math.random() * CURSOR_COLORS.length)]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastTrackTime = useRef(0);
  const currentDraggingId = useRef<string | null>(null);
  const draggingCardPos = useRef<{ x: number; y: number } | null>(null);
  const localDrawingIds = useRef<Set<string>>(new Set());
  const panStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  // 로컬에서 추가한 그림 ID 추적
  useEffect(() => {
    extraDrawings.forEach((d) => localDrawingIds.current.add(d.id));
  }, [extraDrawings]);

  // 뷰포트 크기 추적
  useEffect(() => {
    const onResize = () => setViewport({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // 초기 로드
  useEffect(() => {
    fetchDrawings()
      .then((data) => {
        setDrawings(data);
        onDrawingCountChange?.(data.length);
      })
      .catch((err: unknown) => console.error('drawings 로드 실패:', err));
  }, [onDrawingCountChange]);

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
            if (localDrawingIds.current.has(result.data.id)) return [...prev, result.data];
            toast('🎨 새 그림이 추가됐어요!', { duration: 3000 });
            const next = [...prev, result.data];
            onDrawingCountChange?.(next.length);
            return next;
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
          // 실제 위치가 도착하면 원격 추종 위치 해제 (띠용 방지)
          setRemoteCardPositions((prev) => {
            if (!prev.has(result.data.id)) return prev;
            const next = new Map(prev);
            next.delete(result.data.id);
            return next;
          });
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
        const count = Object.keys(channel.presenceState()).length;
        onPresenceChange?.(count);
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
        const { uid, x, y, color, draggingCardId, cardX, cardY } = payload as RemoteCursor & { uid: string; cardX: number | null; cardY: number | null };
        setRemoteCursors((prev) => {
          const next = new Map(prev);
          next.set(uid, { x, y, color, draggingCardId });
          return next;
        });
        if (draggingCardId && cardX != null && cardY != null) {
          setRemoteCardPositions((prev) => {
            const next = new Map(prev);
            next.set(draggingCardId, { x: cardX, y: cardY });
            return next;
          });
        }
      })
      .on('broadcast', { event: 'viewing' }, ({ payload }) => {
        const { uid, cardId } = payload as { uid: string; cardId: string | null };
        setRemoteViewing((prev) => {
          const next = new Map(prev);
          if (cardId) next.set(uid, cardId);
          else next.delete(uid);
          return next;
        });
      })
      .on('broadcast', { event: 'leave' }, ({ payload }) => {
        const { uid } = payload as { uid: string };
        setRemoteCursors((prev) => { const next = new Map(prev); next.delete(uid); return next; });
        setRemoteViewing((prev) => { const next = new Map(prev); next.delete(uid); return next; });
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
      payload: {
        uid: userId.current, x, y, color: userColor.current, draggingCardId,
        cardX: draggingCardId ? draggingCardPos.current?.x ?? null : null,
        cardY: draggingCardId ? draggingCardPos.current?.y ?? null : null,
      },
    });
  }

  function broadcastViewing(cardId: string | null) {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'viewing',
      payload: { uid: userId.current, cardId },
    });
  }

  function handleOpenViewer(drawing: Drawing) {
    setViewerDrawing(drawing);
    broadcastViewing(drawing.id);
  }

  function handleCloseViewer() {
    setViewerDrawing(null);
    broadcastViewing(null);
  }

  function handleDragStart(cardId: string) {
    currentDraggingId.current = cardId;
  }

  function handleDragMove(x: number, y: number) {
    draggingCardPos.current = { x, y };
  }

  function handleDragEnd() {
    currentDraggingId.current = null;
    draggingCardPos.current = null;
    broadcastCursor(0, 0, null);
  }

  // 월드 중앙 정렬 오프셋 + pan 허용 범위
  const offsetX = (viewport.w - BOARD_W) / 2;
  const offsetY = (viewport.h - BOARD_H) / 2;
  const panLimitX = BOARD_W > viewport.w ? (BOARD_W - viewport.w) / 2 : EDGE_MARGIN;
  const panLimitY = BOARD_H > viewport.h ? (BOARD_H - viewport.h) / 2 : EDGE_MARGIN;

  // 전체보기: 월드 전체가 화면에 들어오도록 축소
  const fitScale = Math.min(
    viewport.w / (BOARD_W + EDGE_MARGIN * 2),
    viewport.h / (BOARD_H + EDGE_MARGIN * 2),
    1
  );
  function toggleFit() {
    setPan({ x: 0, y: 0 });
    setScale((s) => (s === 1 ? fitScale : 1));
  }

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
    setPan({ x: rubberBand(nx, panLimitX), y: rubberBand(ny, panLimitY) });
  }

  function handleBoardPointerUp() {
    panStart.current = null;
    setIsPanning(false);
    setPan((prev) => ({
      x: Math.max(-panLimitX, Math.min(panLimitX, prev.x)),
      y: Math.max(-panLimitY, Math.min(panLimitY, prev.y)),
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

  // 다른 유저가 상세를 보고 있는 카드 ID 집합
  const remotelyViewedIds = useMemo(() => {
    return new Set(remoteViewing.values());
  }, [remoteViewing]);

  return (
    <div
      className="relative w-full h-full"
      style={{ cursor: 'grab', touchAction: 'none' }}
      onPointerDown={handleBoardPointerDown}
      onPointerMove={handleBoardPointerMove}
      onPointerUp={handleBoardPointerUp}
    >
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

      {/* 월드 레이어: 고정 캔버스 영역, 카드 자유 배치 */}
      <div
        className="absolute"
        style={{
          left: offsetX,
          top: offsetY,
          width: BOARD_W,
          height: BOARD_H,
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transition: isPanning ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        {merged.map((drawing) => (
          <GalleryCard
            key={drawing.id}
            drawing={drawing}
            isRemotelyDragged={remotelyDraggedIds.has(drawing.id)}
            isRemotelyViewed={remotelyViewedIds.has(drawing.id)}
            remotePos={remoteCardPositions.get(drawing.id)}
            onDragStart={() => handleDragStart(drawing.id)}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
            onClick={handleOpenViewer}
          />
        ))}
      </div>

      {/* 커서 레이어: pan 만 따라감 (월드 오프셋 제외) */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transition: isPanning ? 'none' : 'transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        }}
      >
        {Array.from(remoteCursors.entries()).map(([id, cursor]) => (
          cursor.x === 0 && cursor.y === 0 ? null : (
            <RemoteCursorEl key={id} cursor={cursor} />
          )
        ))}
      </div>

      {/* 전체보기 토글 (그림 추가 버튼과 같은 높이, 우측) */}
      <button
        onClick={toggleFit}
        onPointerDown={(e) => e.stopPropagation()}
        aria-label={scale === 1 ? '전체보기' : '원래대로'}
        title={scale === 1 ? '전체보기' : '원래대로'}
        className="fixed bottom-[62px] right-4 z-40 w-12 h-12 rounded-full bg-white flex items-center justify-center text-[#1a1a1a] select-none shadow-sm border border-black/8 hover:bg-gray-50 transition-colors"
      >
        {scale === 1 ? <Maximize2 size={18} /> : <Minimize2 size={18} />}
      </button>

      {/* 카드 뷰어 모달 */}
      {viewerDrawing && (
        <CardViewer
          drawing={viewerDrawing}
          onClose={handleCloseViewer}
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
