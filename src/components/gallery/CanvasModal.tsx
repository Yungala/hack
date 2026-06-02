import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadDrawingImage, insertDrawing } from '@/lib/api/drawings';
import type { Drawing } from '@/lib/supabase';
import { LocalCanvas, type LocalCanvasHandle } from './LocalCanvas';
import { DrawingToolbar } from '@/components/graffiti/DrawingToolbar';
import { env } from '@/env';

interface CanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDrawingAdded: (drawing: Drawing) => void;
}

type EvalState =
  | { status: 'idle' }
  | { status: 'evaluating' }
  | { status: 'approved'; comment: string }
  | { status: 'rejected'; comment: string };

export function CanvasModal({ isOpen, onClose, onDrawingAdded }: CanvasModalProps) {
  const canvasRef = useRef<LocalCanvasHandle>(null);
  const [evalState, setEvalState] = useState<EvalState>({ status: 'idle' });

  const handleClose = useCallback(() => {
    canvasRef.current?.clear();
    setEvalState({ status: 'idle' });
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  useEffect(() => {
    if (isOpen) {
      canvasRef.current?.clear();
      setEvalState({ status: 'idle' });
    }
  }, [isOpen]);

  async function handleConfirm() {
    if (!canvasRef.current) return;
    setEvalState({ status: 'evaluating' });

    try {
      const blob = await canvasRef.current.getBlob();

      // base64 변환
      const arrayBuffer = await blob.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
      const imageBase64 = btoa(binary);

      // AI 평가
      const fnUrl = `${env.VITE_SUPABASE_URL}/functions/v1/evaluate-drawing`;
      const evalRes = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64, mediaType: 'image/png' }),
      });
      if (!evalRes.ok) throw new Error(`평가 서비스 오류 (${evalRes.status})`);
      const evalResult = await evalRes.json() as { approved: boolean; comment: string };

      if (!evalResult.approved) {
        setEvalState({ status: 'rejected', comment: evalResult.comment });
        return;
      }

      // 승인 → 업로드 + insert
      const imageUrl = await uploadDrawingImage(blob);
      const cx = Math.round(window.innerWidth / 2);
      const cy = Math.round(window.innerHeight / 2);
      const drawing = await insertDrawing({ image_url: imageUrl, x: cx, y: cy });
      onDrawingAdded(drawing);

      setEvalState({ status: 'approved', comment: evalResult.comment });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.';
      toast.error(`저장 실패: ${message}`);
      setEvalState({ status: 'idle' });
    }
  }

  if (!isOpen) return null;

  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const isSubmitting = evalState.status === 'evaluating';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white flex flex-col overflow-hidden rounded-2xl shadow-2xl border border-[#34485b]/20"
        style={
          isMobile
            ? { width: 'calc(100vw - 32px)' }
            : { maxWidth: 960, width: '88vw', maxHeight: '85vh' }
        }
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#34485b]/20 shrink-0">
          <span className="font-medium text-[#34485b]">그림 그리기</span>
          <button
            aria-label="닫기"
            onClick={handleClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* 캔버스 영역 */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0 bg-[#f0f2f5] relative">
          <LocalCanvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain border border-[#34485b]/30 rounded-lg shadow-sm"
            style={
              isMobile
                ? { width: window.innerWidth - 64, height: window.innerWidth - 64 }
                : { width: '100%', aspectRatio: '16/9' }
            }
          />

          {/* 평가 오버레이 */}
          {evalState.status === 'evaluating' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg gap-3">
              <div className="w-8 h-8 border-3 border-[#34485b]/30 border-t-[#34485b] rounded-full animate-spin" />
              <p className="text-[#34485b] text-sm font-medium">그림을 감상하는 중...</p>
            </div>
          )}

          {/* 승인 결과 오버레이 */}
          {evalState.status === 'approved' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg gap-4 px-6">
              <div className="text-4xl">🎨</div>
              <p className="text-[#34485b] text-base font-medium text-center">{evalState.comment}</p>
              <button
                onClick={handleClose}
                className="px-5 py-2 rounded-lg bg-[#34485b] text-white text-sm font-medium hover:bg-[#34485b]/80 transition-colors"
              >
                갤러리로 이동
              </button>
            </div>
          )}

          {/* 반려 결과 오버레이 */}
          {evalState.status === 'rejected' && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 backdrop-blur-sm rounded-lg gap-4 px-6">
              <div className="text-4xl">🚫</div>
              <p className="text-[#34485b] text-base font-medium text-center">{evalState.comment}</p>
              <button
                onClick={() => setEvalState({ status: 'idle' })}
                className="px-5 py-2 rounded-lg bg-[#34485b] text-white text-sm font-medium hover:bg-[#34485b]/80 transition-colors"
              >
                다시 그리기
              </button>
            </div>
          )}
        </div>

        {/* 푸터 */}
        {isMobile ? (
          <div className="shrink-0 flex flex-col border-t border-[#34485b]/20">
            <div className="flex items-center justify-center px-5 py-2">
              <DrawingToolbar
                variant="modal"
                onImageSelected={(file) => canvasRef.current?.handleImageFile(file)}
              />
            </div>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="mx-4 mb-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-base hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              갤러리에 추가
            </button>
          </div>
        ) : (
          <div className="shrink-0 relative flex items-center justify-center px-5 py-3 border-t border-[#34485b]/20">
            <DrawingToolbar
              variant="modal"
              onImageSelected={(file) => canvasRef.current?.handleImageFile(file)}
            />
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="absolute right-5 flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              완료
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
