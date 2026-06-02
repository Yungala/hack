import { useEffect, useRef, useState } from 'react';
import { X, Heart, Send } from 'lucide-react';
import type { Drawing, Comment } from '@/lib/supabase';
import { fetchComments, insertComment, incrementLike } from '@/lib/api/comments';

interface CardViewerProps {
  drawing: Drawing;
  onClose: () => void;
  onLiked?: (newLikes: number) => void;
}

function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function CardViewer({ drawing, onClose, onLiked }: CardViewerProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState('');
  const [likes, setLikes] = useState(drawing.likes ?? 0);
  const [liked, setLiked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchComments(drawing.id).then(setComments).catch(() => {});
  }, [drawing.id]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  async function handleLike() {
    if (liked) return;
    setLiked(true);
    try {
      const newLikes = await incrementLike(drawing.id);
      setLikes(newLikes);
      onLiked?.(newLikes);
    } catch {
      setLiked(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const content = input.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    try {
      const comment = await insertComment(drawing.id, content);
      setComments(prev => [...prev, comment]);
      setInput('');
      setTimeout(() => listRef.current?.scrollTo({ top: 99999, behavior: 'smooth' }), 50);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      data-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-[#34485b]/20 overflow-hidden flex flex-col"
        style={{ maxWidth: 900, width: '92vw', maxHeight: '90vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 모바일 상단 헤더 — 날짜 + 닫기 */}
        <div className="flex md:hidden items-center justify-between px-4 py-3 border-b border-[#34485b]/10 shrink-0">
          <span className="text-sm text-[#34485b]/60">{formatTime(drawing.created_at)}</span>
          <button
            aria-label="닫기"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/80 backdrop-blur-sm text-[#34485b]/60 hover:text-[#34485b] hover:bg-white transition-colors shadow-sm"
          >
            <X size={14} />
          </button>
        </div>

        {/* 닫기 버튼 — 데스크톱 우상단 고정 */}
        <button
          aria-label="닫기"
          onClick={onClose}
          className="hidden md:flex absolute top-3 right-3 z-10 w-7 h-7 rounded-lg items-center justify-center bg-white/80 backdrop-blur-sm text-[#34485b]/60 hover:text-[#34485b] hover:bg-white transition-colors shadow-sm"
        >
          <X size={14} />
        </button>

        <div className="flex flex-col md:flex-row overflow-hidden min-h-0 flex-1">
        {/* 이미지 */}
        <div className="flex-1 bg-[#f0f2f5] flex items-center justify-center min-w-0 min-h-0" style={{ minHeight: '40vw' }}>
          <img
            src={drawing.image_url}
            alt="갤러리 그림"
            className="block max-w-full max-h-full object-contain"
            style={{ maxHeight: '50vh' }}
          />
        </div>

        {/* 사이드 패널 */}
        <div className="md:w-72 shrink-0 flex flex-col border-t md:border-t-0 md:border-l border-[#34485b]/10 min-h-0 md:h-auto">
          {/* 헤더 — 데스크톱 전용 (모바일은 상단 헤더로 이동) */}
          <div className="hidden md:block px-4 py-3 border-b border-[#34485b]/10">
            <span className="text-sm text-[#34485b]/60">{formatTime(drawing.created_at)}</span>
          </div>

          {/* 추천 */}
          <div className="px-4 py-3 border-b border-[#34485b]/10">
            <button
              onClick={handleLike}
              disabled={liked}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                liked
                  ? 'bg-red-50 text-red-500 cursor-default'
                  : 'text-[#34485b] hover:bg-red-50 hover:text-red-500'
              }`}
            >
              <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
              <span>{likes}</span>
            </button>
          </div>

          {/* 댓글 목록 */}
          <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3 min-h-0">
            {comments.length === 0 && (
              <p className="text-sm text-[#34485b]/30 text-center mt-4">첫 댓글을 남겨보세요</p>
            )}
            {comments.map(c => (
              <div key={c.id}>
                <p className="text-sm text-[#34485b] leading-relaxed break-words">{c.content}</p>
                <p className="text-xs text-[#34485b]/30 mt-0.5">{formatTime(c.created_at)}</p>
              </div>
            ))}
          </div>

          {/* 댓글 입력 */}
          <form onSubmit={handleSubmit} className="px-3 py-3 border-t border-[#34485b]/10 flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              maxLength={300}
              placeholder="댓글 추가..."
              className="flex-1 text-sm text-[#34485b] bg-[#f5f7f9] rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-[#34485b]/30 placeholder:text-[#34485b]/30"
            />
            <button
              type="submit"
              disabled={!input.trim() || submitting}
              className="self-stretch px-2.5 rounded-lg flex items-center justify-center bg-[#34485b] text-white disabled:opacity-30 transition-opacity shrink-0"
            >
              <Send size={14} />
            </button>
          </form>
        </div>
        </div>
      </div>
    </div>
  );
}
