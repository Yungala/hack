import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadDrawingImage, insertDrawing } from '@/lib/api/drawings';
import { supabase, type Drawing } from '@/lib/supabase';
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
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [includeBackground, setIncludeBackground] = useState(true);

  const sessionId = useRef('');
  const liveChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  // 실시간 관전용 broadcast 채널
  useEffect(() => {
    if (!isOpen) return;
    const sid = crypto.randomUUID();
    sessionId.current = sid;
    const channel = supabase.channel('gallery-live-draw', {
      config: { broadcast: { self: false } },
    });
    channel
      .on('broadcast', { event: 'sync-req' }, () => {
        const state = canvasRef.current?.getState();
        channel.send({
          type: 'broadcast',
          event: 'sync-state',
          payload: { sid, strokes: state?.strokes ?? [], images: state?.images ?? [] },
        });
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({ type: 'broadcast', event: 'begin', payload: { sid } });
        }
      });
    liveChannelRef.current = channel;
    return () => {
      channel.send({ type: 'broadcast', event: 'end', payload: { sid } });
      supabase.removeChannel(channel);
      liveChannelRef.current = null;
    };
  }, [isOpen]);

  const live = useMemo(
    () => ({
      emit: (event: string, payload: Record<string, unknown>) => {
        liveChannelRef.current?.send({
          type: 'broadcast',
          event,
          payload: { ...payload, sid: sessionId.current },
        });
      },
    }),
    []
  );

  const handleClose = useCallback(() => {
    canvasRef.current?.clear();
    setEvalState({ status: 'idle' });
    setShowExitConfirm(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (canvasRef.current?.isEmpty() === false) {
      setShowExitConfirm(true);
    } else {
      handleClose();
    }
  }, [handleClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') requestClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, requestClose]);

  useEffect(() => {
    if (isOpen) {
      canvasRef.current?.clear();
      setEvalState({ status: 'idle' });
      setIncludeBackground(true);
    }
  }, [isOpen]);

  async function handleConfirm() {
    if (!canvasRef.current) return;
    setEvalState({ status: 'evaluating' });

    try {
      const blob = await canvasRef.current.getBlob(includeBackground);

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
      // 월드(1800x1000) 중앙 부근에 약간의 랜덤 오프셋으로 배치
      const cx = Math.round(900 + (Math.random() - 0.5) * 400);
      const cy = Math.round(500 + (Math.random() - 0.5) * 300);
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

  const backgroundToggle = (
    <button
      type="button"
      role="checkbox"
      aria-checked={includeBackground}
      onClick={() => setIncludeBackground((v) => !v)}
      className="flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap text-sm text-[#34485b]/70 hover:text-[#34485b] transition-colors"
    >
      <span
        className={`w-4 h-4 rounded-[4px] border flex items-center justify-center transition-colors ${
          includeBackground ? 'bg-[#34485b] border-[#34485b]' : 'bg-white border-[#34485b]/40'
        }`}
      >
        {includeBackground && <Check size={12} className="text-white" strokeWidth={3} />}
      </span>
      배경 포함
    </button>
  );

  const confirmButton = (
    <button
      onClick={handleConfirm}
      disabled={isSubmitting}
      className="flex items-center gap-1.5 h-[40px] px-5 rounded-lg bg-black text-white font-medium text-sm hover:bg-black/80 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      완료
    </button>
  );

  if (evalState.status === 'approved') {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl border border-[#34485b]/20 flex flex-col items-center gap-5 px-10 py-10 max-w-sm text-center">
          <div className="text-5xl">🎨</div>
          <p className="text-[#34485b] text-base font-medium">{evalState.comment}</p>
          <button
            onClick={handleClose}
            className="px-6 py-2 rounded-lg bg-[#34485b] text-white text-sm font-medium hover:bg-[#34485b]/80 transition-colors"
          >
            갤러리로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
      <div
        className="relative bg-white flex flex-col overflow-hidden rounded-2xl shadow-2xl border border-[#34485b]/20"
        style={
          isMobile
            ? { width: 'calc(100vw - 32px)' }
            : { maxWidth: 960, width: '88vw', maxHeight: '85vh' }
        }
      >
        {/* 닫기 확인 다이얼로그 */}
        {showExitConfirm && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
            <div className="bg-white rounded-2xl shadow-2xl px-8 py-7 flex flex-col items-center gap-4 max-w-xs w-full mx-4">
              <p className="text-base font-semibold text-black text-center">그림을 포기할까요?</p>
              <p className="text-sm text-black/50 text-center -mt-2">지금까지 그린 내용이 모두 사라져요.</p>
              <div className="flex gap-2 w-full mt-1">
                <button
                  onClick={() => setShowExitConfirm(false)}
                  className="flex-1 py-2.5 rounded-full border border-black/10 text-sm font-medium text-black hover:bg-black/5 transition-colors"
                >
                  계속 그리기
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-2.5 rounded-full bg-black text-white text-sm font-medium hover:bg-black/80 transition-colors"
                >
                  포기하기
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 평가 중 오버레이 */}
        {evalState.status === 'evaluating' && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/40 backdrop-blur-md rounded-2xl">
            <div className="w-10 h-10 border-[3px] border-white/30 border-t-white rounded-full animate-spin" />
            <p className="text-white text-sm font-medium">그림을 감상하는 중...</p>
          </div>
        )}

        {/* 반려 오버레이 */}
        {evalState.status === 'rejected' && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-2xl">
            <div className="bg-white rounded-2xl shadow-2xl px-10 py-10 flex flex-col items-center gap-3 max-w-sm text-center mx-4">
              <div className="text-5xl">🚫</div>
              <p className="text-[#34485b] text-base font-medium">{evalState.comment}</p>
              <p className="text-[#34485b]/50 text-sm -mt-1">부적절한 그림이나 사진, 텍스트가 포함되어 있는 것 같아요</p>
              <button
                onClick={() => setEvalState({ status: 'idle' })}
                className="mt-2 px-6 py-2 rounded-lg bg-[#34485b] text-white text-sm font-medium hover:bg-[#34485b]/80 transition-colors"
              >
                다시 그리기
              </button>
            </div>
          </div>
        )}

        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#34485b]/20 shrink-0">
          <span className="font-medium text-[#34485b]">그림 그리기</span>
          <button
            aria-label="닫기"
            onClick={requestClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/80 backdrop-blur-sm text-[#34485b]/60 hover:text-[#34485b] hover:bg-white transition-colors shadow-sm"
          >
            <X size={14} />
          </button>
        </div>

        {/* 캔버스 영역 */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0 bg-[#f0f2f5]">
          <LocalCanvas
            ref={canvasRef}
            live={live}
            includeBackground={includeBackground}
            className="max-w-full max-h-full object-contain border border-[#34485b]/30 rounded-lg shadow-sm"
            style={
              isMobile
                ? { width: window.innerWidth - 64, height: window.innerWidth - 64 }
                : { width: '100%', aspectRatio: '16/9' }
            }
          />
        </div>

        {/* 푸터 */}
        {isMobile ? (
          <div className="shrink-0 flex flex-col items-center gap-3 px-5 py-3 border-t border-[#34485b]/20">
            <DrawingToolbar
              variant="modal"
              onImageSelected={(file) => canvasRef.current?.handleImageFile(file)}
            />
            <div className="flex items-center justify-between w-full">
              {backgroundToggle}
              {confirmButton}
            </div>
          </div>
        ) : (
          <div className="shrink-0 relative flex items-center justify-center px-5 py-3 border-t border-[#34485b]/20">
            <div className="absolute left-5 z-10">{backgroundToggle}</div>
            <DrawingToolbar
              variant="modal"
              onImageSelected={(file) => canvasRef.current?.handleImageFile(file)}
            />
            <div className="absolute right-5 z-10">{confirmButton}</div>
          </div>
        )}
      </div>

      {/* 모달 하단 경고 문구 */}
      <p className="text-xs text-white/50 select-none pointer-events-none text-center px-4">
        부적절한 그림이나 사진, 텍스트를 추가하면 삭제될 수 있습니다.
      </p>
    </div>
  );
}
