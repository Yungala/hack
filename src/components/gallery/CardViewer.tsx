import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { Drawing } from '@/lib/supabase';

interface CardViewerProps {
  drawing: Drawing;
  onClose: () => void;
}

export function CardViewer({ drawing, onClose }: CardViewerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative max-w-3xl max-h-[90vh] rounded-2xl overflow-hidden shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          aria-label="닫기"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 transition-colors"
        >
          <X size={16} />
        </button>
        <img
          src={drawing.image_url}
          alt="갤러리 그림"
          className="block max-w-full max-h-[90vh] object-contain"
        />
      </div>
    </div>
  );
}
