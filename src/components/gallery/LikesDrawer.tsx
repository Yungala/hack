import { useEffect, useState } from 'react';
import { Heart, X } from 'lucide-react';
import type { Drawing } from '@/lib/supabase';
import { fetchDrawings } from '@/lib/api/drawings';

interface LikesDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (drawing: Drawing) => void;
}

export function LikesDrawer({ isOpen, onClose, onSelect }: LikesDrawerProps) {
  const [drawings, setDrawings] = useState<Drawing[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    fetchDrawings()
      .then((data) => {
        const sorted = [...data].sort((a, b) => b.likes - a.likes);
        setDrawings(sorted);
      })
      .catch(() => {});
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  return (
    <>
      {/* 오버레이 */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* 드로어 */}
      <div
        className="fixed top-0 left-0 h-full z-50 bg-white shadow-2xl flex flex-col"
        style={{
          width: 300,
          transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-black/8 shrink-0">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-red-500" fill="currentColor" />
            <span className="font-semibold text-[#34485b] text-sm">인기 그림</span>
          </div>
          <button
            aria-label="닫기"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/80 backdrop-blur-sm text-[#34485b]/60 hover:text-[#34485b] hover:bg-white transition-colors shadow-sm"
          >
            <X size={14} />
          </button>
        </div>

        {/* 리스트 */}
        <div className="flex-1 overflow-y-auto py-3">
          {drawings.length === 0 && (
            <p className="text-center text-sm text-[#34485b]/30 mt-8">아직 그림이 없어요</p>
          )}
          {drawings.map((drawing, i) => (
            <button
              key={drawing.id}
              onClick={() => { onSelect(drawing); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#f5f7f9] transition-colors text-left"
            >
              {/* 순위 */}
              <span
                className="shrink-0 w-6 text-center text-xs font-bold"
                style={{ color: i === 0 ? '#F59E0B' : i === 1 ? '#9CA3AF' : i === 2 ? '#CD7C2F' : '#34485b80' }}
              >
                {i + 1}
              </span>
              {/* 썸네일 */}
              <img
                src={drawing.image_url}
                alt=""
                className="w-12 h-12 rounded-lg object-cover border border-black/8 shrink-0"
              />
              {/* 좋아요 */}
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <Heart size={13} className="text-red-400" fill="currentColor" />
                <span className="text-sm font-medium text-[#34485b]">{drawing.likes}</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
