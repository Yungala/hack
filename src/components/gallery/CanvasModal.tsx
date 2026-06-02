import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Eraser, Trash2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { PALETTE, THICKNESSES, type Thickness } from '@/stores/drawing-store';
import { uploadDrawingImage, insertDrawing } from '@/lib/api/drawings';
import type { Drawing } from '@/lib/supabase';

const THICKNESS_LABELS: Record<Thickness, string> = { 2: '얇게', 6: '보통', 14: '굵게' };

interface CanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDrawingAdded: (drawing: Drawing) => void;
}

export function CanvasModal({ isOpen, onClose, onDrawingAdded }: CanvasModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const [color, setColor] = useState('#111111');
  const [thickness, setThickness] = useState<Thickness>(6);
  const [isEraser, setIsEraser] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const CANVAS_SIZE = typeof window !== 'undefined' && window.innerWidth < 768
    ? window.innerWidth
    : 600;

  const getCtx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);

  // 모달 열릴 때 캔버스 초기화
  useEffect(() => {
    if (!isOpen) return;
    const id = requestAnimationFrame(() => {
      const c = getCtx();
      if (!c) return;
      c.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      c.fillStyle = '#ffffff';
      c.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    });
    return () => cancelAnimationFrame(id);
  }, [isOpen, getCtx, CANVAS_SIZE]);

  const handleClose = useCallback(() => {
    const c = getCtx();
    if (c) {
      c.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
    }
    onClose();
  }, [getCtx, onClose, CANVAS_SIZE]);

  // ESC 키
  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  function getPos(e: React.PointerEvent): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * CANVAS_SIZE,
      y: ((e.clientY - rect.top) / rect.height) * CANVAS_SIZE,
    };
  }

  function handlePointerDown(e: React.PointerEvent) {
    isDrawing.current = true;
    lastPoint.current = getPos(e);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!isDrawing.current || !lastPoint.current) return;
    const c = getCtx();
    if (!c) return;
    const pt = getPos(e);
    c.save();
    c.strokeStyle = isEraser ? '#ffffff' : color;
    c.lineWidth = isEraser ? thickness * 3 : thickness;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.beginPath();
    c.moveTo(lastPoint.current.x, lastPoint.current.y);
    c.lineTo(pt.x, pt.y);
    c.stroke();
    c.restore();
    lastPoint.current = pt;
  }

  function handlePointerUp() {
    isDrawing.current = false;
    lastPoint.current = null;
  }

  function handleClear() {
    const c = getCtx();
    if (!c) return;
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  }

  async function handleConfirm() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    setIsSubmitting(true);
    try {
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => {
          if (b) resolve(b);
          else reject(new Error('캔버스 export 실패'));
        }, 'image/png');
      });

      const imageUrl = await uploadDrawingImage(blob);

      const cx = Math.round(window.innerWidth / 2);
      const cy = Math.round(window.innerHeight / 2);
      const drawing = await insertDrawing({ image_url: imageUrl, x: cx, y: cy });

      onDrawingAdded(drawing);
      onClose();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      toast.error(`저장 실패: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!isOpen) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-background rounded-2xl shadow-2xl border border-border flex flex-col"
        style={
          isMobile
            ? { width: window.innerWidth, borderRadius: 0 }
            : { maxWidth: 1280, width: '90vw', maxHeight: '90vh' }
        }
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <span className="font-medium text-foreground">그림 그리기</span>
          <button
            aria-label="닫기"
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 캔버스 영역 */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <canvas
            ref={canvasRef}
            width={CANVAS_SIZE}
            height={CANVAS_SIZE}
            style={{
              width: isMobile ? window.innerWidth : CANVAS_SIZE,
              height: isMobile ? window.innerWidth : CANVAS_SIZE,
              cursor: isEraser ? 'cell' : 'crosshair',
              touchAction: 'none',
              backgroundColor: '#ffffff',
              border: '1px solid hsl(var(--border))',
              borderRadius: 8,
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
          />
        </div>

        {/* 도구 바 */}
        <div className="px-5 py-3 border-t border-border flex flex-col gap-2">
          {/* 색상 팔레트 */}
          <div className="flex items-center gap-1 flex-wrap">
            {PALETTE.map((c) => (
              <button
                key={c}
                aria-label={c}
                onClick={() => { setColor(c); setIsEraser(false); }}
                className="w-5 h-5 rounded-full border border-border transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c && !isEraser ? '2px solid hsl(var(--primary))' : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>

          {/* 두께 + 지우개 + 초기화 + 완료 */}
          <div className="flex items-center gap-1.5">
            {THICKNESSES.map((t) => (
              <button
                key={t}
                aria-label={THICKNESS_LABELS[t]}
                title={THICKNESS_LABELS[t]}
                onClick={() => setThickness(t)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                  thickness === t && !isEraser
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground hover:bg-accent'
                }`}
              >
                <span
                  className="rounded-full bg-current"
                  style={{ width: t + 3, height: t + 3 }}
                />
              </button>
            ))}

            <div className="w-px h-5 bg-border mx-1" />

            <button
              onClick={() => setIsEraser((v) => !v)}
              title="지우개"
              className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                isEraser ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent'
              }`}
            >
              <Eraser size={14} />
            </button>

            <button
              onClick={handleClear}
              title="초기화"
              className="w-7 h-7 rounded-lg flex items-center justify-center text-foreground hover:bg-accent transition-colors"
            >
              <Trash2 size={14} />
            </button>

            <div className="flex-1" />

            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check size={14} />
              {isSubmitting ? '저장 중...' : '완료'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
