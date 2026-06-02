import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

const LOGICAL_W = 1280;
const LOGICAL_H = 720;

interface Point { x: number; y: number; }
interface Stroke { points: Point[]; color: string; thickness: number; eraser: boolean; }
interface SpImage { id: string; dataUrl: string; x: number; y: number; width: number; height: number; el?: HTMLImageElement; }
interface Session {
  strokes: Stroke[];
  current: Stroke | null;
  images: SpImage[];
}

interface LiveSpectatorProps {
  isOpen: boolean;
  onClose: () => void;
}

function strokeStyle(ctx: CanvasRenderingContext2D, s: Stroke) {
  if (s.eraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = s.thickness * 4;
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.thickness;
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
}

function drawSegment(ctx: CanvasRenderingContext2D, s: Stroke, from: Point, to: Point) {
  ctx.save();
  strokeStyle(ctx, s);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

function fullRedraw(ctx: CanvasRenderingContext2D, session: Session) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  ctx.restore();

  for (const img of session.images) {
    if (img.el && img.el.naturalWidth) {
      ctx.drawImage(img.el, img.x - img.width / 2, img.y - img.height / 2, img.width, img.height);
    }
  }
  const all = session.current ? [...session.strokes, session.current] : session.strokes;
  for (const s of all) {
    if (s.points.length < 2) continue;
    ctx.save();
    strokeStyle(ctx, s);
    ctx.beginPath();
    ctx.moveTo(s.points[0].x, s.points[0].y);
    for (let i = 1; i < s.points.length; i++) ctx.lineTo(s.points[i].x, s.points[i].y);
    ctx.stroke();
    ctx.restore();
  }
}

export function LiveSpectator({ isOpen, onClose }: LiveSpectatorProps) {
  const sessionsRef = useRef<Map<string, Session>>(new Map());
  const canvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [sids, setSids] = useState<string[]>([]);

  const ctxFor = useCallback((sid: string) => {
    return canvasesRef.current.get(sid)?.getContext('2d') ?? null;
  }, []);

  const ensure = useCallback((sid: string) => {
    if (!sessionsRef.current.has(sid)) {
      sessionsRef.current.set(sid, { strokes: [], current: null, images: [] });
      setSids(Array.from(sessionsRef.current.keys()));
    }
    return sessionsRef.current.get(sid)!;
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    // 열릴 때마다 초기화
    sessionsRef.current = new Map();
    canvasesRef.current = new Map();
    setSids([]);

    const channel = supabase.channel('gallery-live-draw', {
      config: { broadcast: { self: false } },
    });

    channel
      .on('broadcast', { event: 'begin' }, ({ payload }) => {
        ensure(payload.sid as string);
      })
      .on('broadcast', { event: 'sync-state' }, ({ payload }) => {
        const sid = payload.sid as string;
        const session = ensure(sid);
        session.strokes = (payload.strokes as Stroke[]) ?? [];
        session.current = null;
        session.images = ((payload.images as SpImage[]) ?? []).map((i) => ({ ...i }));
        for (const img of session.images) {
          const el = new Image();
          el.onload = () => { const ctx = ctxFor(sid); if (ctx) fullRedraw(ctx, session); };
          el.src = img.dataUrl;
          img.el = el;
        }
        const ctx = ctxFor(sid);
        if (ctx) fullRedraw(ctx, session);
      })
      .on('broadcast', { event: 'stroke-start' }, ({ payload }) => {
        const session = ensure(payload.sid as string);
        session.current = {
          points: [payload.point as Point],
          color: payload.color as string,
          thickness: payload.thickness as number,
          eraser: payload.eraser as boolean,
        };
      })
      .on('broadcast', { event: 'stroke-move' }, ({ payload }) => {
        const sid = payload.sid as string;
        const session = ensure(sid);
        if (!session.current) return;
        const pts = session.current.points;
        const prev = pts[pts.length - 1];
        const next = payload.point as Point;
        pts.push(next);
        const ctx = ctxFor(sid);
        if (ctx && prev) drawSegment(ctx, session.current, prev, next);
      })
      .on('broadcast', { event: 'stroke-end' }, ({ payload }) => {
        const sid = payload.sid as string;
        const session = ensure(sid);
        const points = payload.points as Point[] | undefined;
        if (points && points.length >= 2 && session.current) {
          session.current.points = points;
        }
        if (session.current) {
          session.strokes.push(session.current);
          session.current = null;
          const ctx = ctxFor(sid);
          if (ctx) fullRedraw(ctx, session);
        }
      })
      .on('broadcast', { event: 'image' }, ({ payload }) => {
        const sid = payload.sid as string;
        const session = ensure(sid);
        const img: SpImage = {
          id: payload.id as string,
          dataUrl: payload.dataUrl as string,
          x: payload.x as number,
          y: payload.y as number,
          width: payload.width as number,
          height: payload.height as number,
        };
        const el = new Image();
        el.onload = () => { const ctx = ctxFor(sid); if (ctx) fullRedraw(ctx, session); };
        el.src = img.dataUrl;
        img.el = el;
        session.images.push(img);
      })
      .on('broadcast', { event: 'clear' }, ({ payload }) => {
        const sid = payload.sid as string;
        const session = ensure(sid);
        session.strokes = [];
        session.current = null;
        session.images = [];
        const ctx = ctxFor(sid);
        if (ctx) fullRedraw(ctx, session);
      })
      .on('broadcast', { event: 'end' }, ({ payload }) => {
        const sid = payload.sid as string;
        setTimeout(() => {
          sessionsRef.current.delete(sid);
          canvasesRef.current.delete(sid);
          setSids(Array.from(sessionsRef.current.keys()));
        }, 400);
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'sync-req', payload: {} });
        }
      });

    return () => { supabase.removeChannel(channel); };
  }, [isOpen, ensure, ctxFor]);

  if (!isOpen) return null;

  return (
    <div
      data-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-[#34485b]/20 overflow-hidden flex flex-col"
        style={{ maxWidth: 1000, width: '92vw', maxHeight: '90vh' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#34485b]/10 shrink-0">
          <div className="flex items-center gap-2">
            <span className="relative flex w-2 h-2">
              <span className="absolute inline-flex w-full h-full rounded-full bg-green-500 opacity-60 animate-ping" />
              <span className="relative inline-flex w-2 h-2 rounded-full bg-green-500" />
            </span>
            <span className="font-medium text-[#34485b]">실시간 관전</span>
            {sids.length > 0 && (
              <span className="text-sm text-[#34485b]/50">{sids.length}명이 그리는 중</span>
            )}
          </div>
          <button
            aria-label="닫기"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/80 text-[#34485b]/60 hover:text-[#34485b] hover:bg-white transition-colors shadow-sm"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 bg-[#f0f2f5] min-h-0">
          {sids.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
              <div className="text-4xl">🎨</div>
              <p className="text-[#34485b]/50 text-sm">지금 그림을 그리는 사람이 없어요</p>
            </div>
          ) : (
            <div className={`grid gap-3 ${sids.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
              {sids.map((sid) => (
                <div key={sid} className="bg-white rounded-xl border border-[#34485b]/10 overflow-hidden shadow-sm">
                  <canvas
                    ref={(el) => {
                      if (el) {
                        canvasesRef.current.set(sid, el);
                        const ctx = el.getContext('2d');
                        const session = sessionsRef.current.get(sid);
                        if (ctx && session) fullRedraw(ctx, session);
                      } else {
                        canvasesRef.current.delete(sid);
                      }
                    }}
                    width={LOGICAL_W}
                    height={LOGICAL_H}
                    className="block w-full bg-white"
                    style={{ aspectRatio: `${LOGICAL_W}/${LOGICAL_H}` }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
