import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadDrawingImage, insertDrawing } from '@/lib/api/drawings';
import type { Drawing } from '@/lib/supabase';
import { LocalCanvas, type LocalCanvasHandle } from './LocalCanvas';
import { DrawingToolbar } from '@/components/graffiti/DrawingToolbar';
import { CatCharacter } from '@/components/graffiti/CatCharacter';

interface CanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDrawingAdded: (drawing: Drawing) => void;
}

export function CanvasModal({ isOpen, onClose, onDrawingAdded }: CanvasModalProps) {
  const canvasRef = useRef<LocalCanvasHandle>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleClose = useCallback(() => {
    canvasRef.current?.clear();
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
    if (isOpen) canvasRef.current?.clear();
  }, [isOpen]);

  async function handleConfirm() {
    if (!canvasRef.current) return;
    setIsSubmitting(true);
    try {
      const blob = await canvasRef.current.getBlob();
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
    <>
    {/* 화면 하단 중앙 고양이 */}
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[60] pointer-events-none">
      <CatCharacter comment="그림 그려봐" />
    </div>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div
        className="bg-white flex flex-col overflow-hidden rounded-2xl shadow-2xl border border-[#34485b]/20"
        style={
          isMobile
            ? { width: window.innerWidth, height: window.innerHeight, borderRadius: 0 }
            : { maxWidth: 1280, width: '90vw', maxHeight: '90vh' }
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
        <div className="flex-1 overflow-auto flex items-center justify-center p-4 min-h-0 bg-[#f0f2f5]">
          <LocalCanvas
            ref={canvasRef}
            className="max-w-full max-h-full object-contain border border-[#34485b]/30 rounded-lg shadow-sm"
            style={
              isMobile
                ? { width: window.innerWidth - 32, height: window.innerWidth - 32 }
                : { width: '100%', aspectRatio: '16/9' }
            }
          />
        </div>

        {/* 푸터: 고양이(좌 절대) + 툴바(중앙) + 완료(우 절대) */}
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
            {isSubmitting ? '저장 중...' : '완료'}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
