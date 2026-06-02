import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import { useDrawingStore, type Thickness } from '@/stores/drawing-store';
import { TransformOverlay, type TransformItem } from '@/components/graffiti/TransformOverlay';

// 로컬 캔버스 논리 해상도
const LOGICAL_W = 1280;
const LOGICAL_H = 720;

const FONT_SIZES: Record<Thickness, number> = { 2: 28, 6: 52, 14: 100 };

interface Point {
  x: number;
  y: number;
}

interface LocalStroke {
  points: Point[];
  color: string;
  thickness: number;
  eraser: boolean;
}

interface PlacedImage {
  id: string;
  dataUrl: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LocalCanvasHandle {
  getBlob: (includeBackground: boolean) => Promise<Blob>;
  clear: () => void;
  handleImageFile: (file: File) => void;
  isEmpty: () => boolean;
  getState: () => { strokes: LocalStroke[]; images: PlacedImage[] };
}

export interface LiveDrawApi {
  emit: (event: string, payload: Record<string, unknown>) => void;
}

export interface LocalCanvasProps {
  className?: string;
  style?: React.CSSProperties;
  live?: LiveDrawApi;
  includeBackground?: boolean;
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: LocalStroke) {
  if (stroke.points.length < 2) return;
  ctx.save();
  if (stroke.eraser) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.strokeStyle = 'rgba(0,0,0,1)';
    ctx.lineWidth = stroke.thickness * 4;
  } else {
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.thickness;
  }
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
  for (let i = 1; i < stroke.points.length; i++) {
    ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

async function preloadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(img);
    img.src = src;
  });
}

function paintBg(ctx: CanvasRenderingContext2D, includeBackground: boolean) {
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  if (includeBackground) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
  } else {
    ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  }
  ctx.restore();
}

function redraw(
  ctx: CanvasRenderingContext2D,
  strokes: LocalStroke[],
  images: PlacedImage[],
  imageEls: Map<string, HTMLImageElement>,
  includeBackground: boolean,
) {
  paintBg(ctx, includeBackground);

  // Draw all placed images first
  for (const img of images) {
    const el = imageEls.get(img.id);
    if (el && el.naturalWidth) {
      ctx.drawImage(el, img.x - img.width / 2, img.y - img.height / 2, img.width, img.height);
    }
  }

  // Draw strokes on top
  for (const stroke of strokes) {
    drawStroke(ctx, stroke);
  }
}

export const LocalCanvas = forwardRef<LocalCanvasHandle, LocalCanvasProps>(
  function LocalCanvas({ className, style, live, includeBackground = true }, ref) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const bgRef = useRef(includeBackground);
    bgRef.current = includeBackground;
    const { color, thickness, tool, fontFamily, clearTool } = useDrawingStore();

    const strokesRef = useRef<LocalStroke[]>([]);
    const currentStrokeRef = useRef<LocalStroke | null>(null);
    const imagesRef = useRef<PlacedImage[]>([]);
    const imageElsRef = useRef<Map<string, HTMLImageElement>>(new Map());
    const lastLiveMove = useRef(0);
    const liveRef = useRef(live);
    liveRef.current = live;

    const [transformPending, setTransformPending] = useState<{
      item: TransformItem;
      initialCX?: number;
      initialCY?: number;
    } | null>(null);

    // 색상 변경 시 text item에 반영
    useEffect(() => {
      setTransformPending(prev => {
        if (!prev || prev.item.kind !== 'text') return prev;
        return { ...prev, item: { ...prev.item, color } };
      });
    }, [color]);

    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);

    // [ ] 키로 두께 자유 조절 (최소 1, 상한 없음)
    useEffect(() => {
      function handleKeyDown(e: KeyboardEvent) {
        if (e.key === '[') useDrawingStore.setState(s => ({ thickness: Math.max(1, s.thickness - 4) }));
        if (e.key === ']') useDrawingStore.setState(s => ({ thickness: s.thickness + 4 }));
      }
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // Initial background
    useEffect(() => {
      const c = getCtx();
      if (!c) return;
      paintBg(c, bgRef.current);
    }, [getCtx]);

    // 배경 포함 토글 시 캔버스 즉시 갱신 (편집 중 시각 피드백)
    useEffect(() => {
      const c = getCtx();
      if (!c) return;
      redraw(c, strokesRef.current, imagesRef.current, imageElsRef.current, includeBackground);
    }, [includeBackground, getCtx]);

    function cssToLogical(cssX: number, cssY: number): Point {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { x: cssX, y: cssY };
      return {
        x: ((cssX - rect.left) / rect.width) * LOGICAL_W,
        y: ((cssY - rect.top) / rect.height) * LOGICAL_H,
      };
    }

    function cssToLogicalSize(cssW: number, cssH: number): { w: number; h: number } {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return { w: cssW, h: cssH };
      return {
        w: (cssW / rect.width) * LOGICAL_W,
        h: (cssH / rect.height) * LOGICAL_H,
      };
    }

    function handlePointerDown(e: React.PointerEvent) {
      if (tool === 'text') {
        e.preventDefault();
        setTransformPending({
          item: { kind: 'text', content: '', color, fontSize: FONT_SIZES[thickness], fontFamily },
          initialCX: e.clientX,
          initialCY: e.clientY,
        });
        return;
      }

      // brush or eraser only
      if (tool !== 'brush' && tool !== 'eraser') return;
      const pt = cssToLogical(e.clientX, e.clientY);
      const isEraser = tool === 'eraser';
      currentStrokeRef.current = {
        points: [pt],
        color,
        thickness,
        eraser: isEraser,
      };
      liveRef.current?.emit('stroke-start', { color, thickness, eraser: isEraser, point: pt });
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }

    function handlePointerMove(e: React.PointerEvent) {
      if (!currentStrokeRef.current) return;
      const pt = cssToLogical(e.clientX, e.clientY);
      currentStrokeRef.current.points.push(pt);

      const now = Date.now();
      if (liveRef.current && now - lastLiveMove.current > 30) {
        lastLiveMove.current = now;
        liveRef.current.emit('stroke-move', { point: pt });
      }

      // Incremental draw for current stroke
      const c = getCtx();
      if (!c) return;
      const pts = currentStrokeRef.current.points;
      if (pts.length < 2) return;
      const stroke = currentStrokeRef.current;
      const last = pts[pts.length - 2];
      const cur = pts[pts.length - 1];

      c.save();
      if (stroke.eraser) {
        c.globalCompositeOperation = 'destination-out';
        c.strokeStyle = 'rgba(0,0,0,1)';
        c.lineWidth = stroke.thickness * 4;
      } else {
        c.globalCompositeOperation = 'source-over';
        c.strokeStyle = stroke.color;
        c.lineWidth = stroke.thickness;
      }
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      c.moveTo(last.x, last.y);
      c.lineTo(cur.x, cur.y);
      c.stroke();
      c.restore();
    }

    function handlePointerUp() {
      if (!currentStrokeRef.current) return;
      liveRef.current?.emit('stroke-end', { points: currentStrokeRef.current.points });
      if (currentStrokeRef.current.points.length >= 2) {
        strokesRef.current.push(currentStrokeRef.current);
      }
      currentStrokeRef.current = null;
    }

    // TransformOverlay confirm: image or text rendered to a PNG, then placed on canvas
    async function handleTransformConfirm(
      file: File,
      cssX: number,
      cssY: number,
      cssW: number,
      cssH: number,
    ) {
      setTransformPending(null);
      const rect = canvasRef.current?.getBoundingClientRect();
      const logX = rect ? ((cssX - rect.left) / rect.width) * LOGICAL_W : cssX;
      const logY = rect ? ((cssY - rect.top) / rect.height) * LOGICAL_H : cssY;
      const { w: logW, h: logH } = cssToLogicalSize(cssW, cssH);

      const dataUrl = URL.createObjectURL(file);
      const el = await preloadImage(dataUrl);
      URL.revokeObjectURL(dataUrl);

      if (!el.naturalWidth) return;

      const id = crypto.randomUUID();
      // Store as data URL for stable reference
      const canvas2 = document.createElement('canvas');
      canvas2.width = el.naturalWidth;
      canvas2.height = el.naturalHeight;
      const c2 = canvas2.getContext('2d')!;
      c2.drawImage(el, 0, 0);
      const stableDataUrl = canvas2.toDataURL('image/png');
      const stableEl = await preloadImage(stableDataUrl);

      imageElsRef.current.set(id, stableEl);
      imagesRef.current.push({ id, dataUrl: stableDataUrl, x: logX, y: logY, width: logW, height: logH });
      liveRef.current?.emit('image', { id, dataUrl: stableDataUrl, x: logX, y: logY, width: logW, height: logH });

      const c = getCtx();
      if (c) {
        redraw(c, strokesRef.current, imagesRef.current, imageElsRef.current, bgRef.current);
      }
    }

    useImperativeHandle(ref, () => ({
      getBlob(includeBackground: boolean): Promise<Blob> {
        return new Promise((resolve, reject) => {
          // 콘텐츠를 오프스크린 캔버스에 다시 렌더 (배경 옵션에 따라 흰색 채움)
          const off = document.createElement('canvas');
          off.width = LOGICAL_W;
          off.height = LOGICAL_H;
          const ctx = off.getContext('2d');
          if (!ctx) { reject(new Error('컨텍스트 없음')); return; }

          if (includeBackground) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);
          }
          for (const img of imagesRef.current) {
            const el = imageElsRef.current.get(img.id);
            if (el && el.naturalWidth) {
              ctx.drawImage(el, img.x - img.width / 2, img.y - img.height / 2, img.width, img.height);
            }
          }
          for (const stroke of strokesRef.current) {
            drawStroke(ctx, stroke);
          }

          // 콘텐츠 bounding box 계산 (배경 포함 시 흰색 제외, 미포함 시 투명 제외)
          const d = ctx.getImageData(0, 0, LOGICAL_W, LOGICAL_H).data;
          let minX = LOGICAL_W, minY = LOGICAL_H, maxX = 0, maxY = 0;
          for (let y = 0; y < LOGICAL_H; y++) {
            for (let x = 0; x < LOGICAL_W; x++) {
              const i = (y * LOGICAL_W + x) * 4;
              const isContent = includeBackground
                ? (d[i] !== 255 || d[i + 1] !== 255 || d[i + 2] !== 255)
                : d[i + 3] !== 0;
              if (isContent) {
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
              }
            }
          }

          // 아무것도 안 그렸으면 전체 저장
          if (minX > maxX || minY > maxY) {
            off.toBlob((blob) => {
              if (blob) resolve(blob);
              else reject(new Error('캔버스 export 실패'));
            }, 'image/png');
            return;
          }

          // 그린 영역만 크롭
          const cropX = minX;
          const cropY = minY;
          const cropW = maxX - minX;
          const cropH = maxY - minY;

          const cropped = document.createElement('canvas');
          cropped.width = cropW;
          cropped.height = cropH;
          const cc = cropped.getContext('2d')!;
          cc.drawImage(off, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          cropped.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('캔버스 export 실패'));
          }, 'image/png');
        });
      },
      clear() {
        strokesRef.current = [];
        imagesRef.current = [];
        imageElsRef.current.clear();
        const c = getCtx();
        if (c) paintBg(c, bgRef.current);
        liveRef.current?.emit('clear', {});
      },
      isEmpty() {
        return strokesRef.current.length === 0 && imagesRef.current.length === 0;
      },
      getState() {
        const strokes = [...strokesRef.current];
        if (currentStrokeRef.current) strokes.push(currentStrokeRef.current);
        return { strokes, images: imagesRef.current.map((i) => ({ ...i })) };
      },
      handleImageFile(file: File) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const dataUrl = e.target?.result as string;
          const img = new Image();
          img.onload = () => {
            setTransformPending({
              item: { kind: 'image', dataUrl, file, naturalW: img.width, naturalH: img.height },
            });
          };
          img.src = dataUrl;
        };
        reader.readAsDataURL(file);
      },
    }), [getCtx]);

    const showCircleCursor = tool === 'brush' || tool === 'eraser';
    const cursorStyle = showCircleCursor ? 'none' : tool === 'text' ? 'text' : tool === null ? 'default' : 'crosshair';

    // 화면상 실제 선 굵기 (logical → css px)
    const cssThickness = (() => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return thickness;
      const scale = rect.width / LOGICAL_W;
      return tool === 'eraser' ? thickness * 4 * scale : thickness * scale;
    })();

    return (
      <>
        <canvas
          ref={canvasRef}
          width={LOGICAL_W}
          height={LOGICAL_H}
          className={className}
          style={{
            cursor: cursorStyle,
            touchAction: 'none',
            ...(includeBackground
              ? { backgroundColor: '#ffffff' }
              : {
                  backgroundColor: '#ffffff',
                  backgroundImage:
                    'linear-gradient(45deg,#d4d4d4 25%,transparent 25%),linear-gradient(-45deg,#d4d4d4 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#d4d4d4 75%),linear-gradient(-45deg,transparent 75%,#d4d4d4 75%)',
                  backgroundSize: '16px 16px',
                  backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
                }),
            ...style,
          }}
          onPointerDown={handlePointerDown}
          onPointerMove={(e) => {
            handlePointerMove(e);
            setCursorPos({ x: e.clientX, y: e.clientY });
          }}
          onPointerLeave={() => setCursorPos(null)}
          onPointerUp={handlePointerUp}
        />

        {/* 커서 원 */}
        {showCircleCursor && cursorPos && (
          <div
            style={{
              position: 'fixed',
              left: cursorPos.x,
              top: cursorPos.y,
              width: cssThickness,
              height: cssThickness,
              borderRadius: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              border: tool === 'eraser' ? '1.5px solid #888' : `1.5px solid ${color === '#FFFFFF' ? '#aaa' : color}`,
              background: tool === 'eraser' ? 'rgba(150,150,150,0.15)' : `${color}33`,
              zIndex: 9999,
            }}
          />
        )}

        {transformPending && canvasRef.current && (
          <TransformOverlay
            item={transformPending.item}
            canvasRect={canvasRef.current.getBoundingClientRect()}
            initialCX={transformPending.initialCX}
            initialCY={transformPending.initialCY}
            onConfirm={handleTransformConfirm}
            onCancel={() => { setTransformPending(null); clearTool(); }}
          />
        )}
      </>
    );
  },
);
