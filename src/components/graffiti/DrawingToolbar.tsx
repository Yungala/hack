import { useRef, useState } from 'react';
import { ImageIcon, Type, Pencil } from 'lucide-react';
import { PALETTE, THICKNESSES, FONT_FAMILIES, type Thickness, useDrawingStore } from '@/stores/drawing-store';
import { DrawingModal } from './DrawingModal';

const COLOR_NAMES: Record<string, string> = {
  '#FFFFFF': '흰색', '#111111': '검정', '#EF4444': '빨강', '#F97316': '주황',
  '#EAB308': '노랑', '#22C55E': '초록', '#38BDF8': '하늘', '#3B82F6': '파랑',
  '#A855F7': '보라', '#EC4899': '분홍', '#6B7280': '회색', '#D4B896': '베이지',
};

const SIZE_LABELS: Record<Thickness, string> = { 2: 'S', 6: 'M', 14: 'L' };

interface DrawingToolbarProps {
  onImageSelected?: (file: File) => void;
  variant?: 'floating' | 'modal';
}

export function DrawingToolbar({ onImageSelected, variant = 'floating' }: DrawingToolbarProps) {
  const { tool, color, thickness, fontFamily, isUploadMode, setTool, setColor, setThickness, setFontFamily } = useDrawingStore();
  const isModal = variant === 'modal';
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDrawModalOpen, setIsDrawModalOpen] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      alert('파일 크기는 5MB 이하만 가능합니다.');
      return;
    }
    onImageSelected?.(file);
    e.target.value = '';
  }

  return (
    <>
      {/* 텍스트 모드 옵션 패널 */}
      {tool === 'text' && (
        <div className={isModal
          ? "flex flex-col gap-2 bg-black/70 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl"
          : "fixed bottom-[4.5rem] left-1/2 -translate-x-1/2 z-40 flex flex-col gap-2 bg-black/70 backdrop-blur-sm rounded-2xl px-4 py-3 shadow-xl"
        }>
          {/* 색상 */}
          <div className="flex items-center gap-1.5">
            {PALETTE.map((c) => (
              <button
                key={c}
                aria-label={COLOR_NAMES[c]}
                title={COLOR_NAMES[c]}
                onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full border border-white/20 transition-transform hover:scale-110"
                style={{
                  backgroundColor: c,
                  outline: color === c ? '2px solid white' : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* 크기 */}
            <div className="flex items-center gap-1">
              {THICKNESSES.map((t) => (
                <button
                  key={t}
                  aria-label={SIZE_LABELS[t]}
                  title={SIZE_LABELS[t]}
                  onClick={() => setThickness(t)}
                  className={`w-8 h-7 rounded-lg text-xs font-bold transition-colors ${
                    thickness === t ? 'bg-white text-black' : 'text-white hover:bg-white/20'
                  }`}
                >
                  {SIZE_LABELS[t]}
                </button>
              ))}
            </div>

            <div className="w-px h-5 bg-white/20" />

            {/* 폰트 */}
            <div className="flex items-center gap-1">
              {FONT_FAMILIES.map((f) => (
                <button
                  key={f.value}
                  aria-label={f.label}
                  title={f.label}
                  onClick={() => setFontFamily(f.value)}
                  className={`w-8 h-7 rounded-lg text-sm transition-colors ${
                    fontFamily === f.value ? 'bg-white text-black' : 'text-white hover:bg-white/20'
                  }`}
                  style={{ fontFamily: f.value }}
                >
                  A
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 메인 툴바 */}
      <div className={isModal
        ? "flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-xl"
        : "fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-black/70 backdrop-blur-sm rounded-2xl px-5 py-3 shadow-xl"
      }>
        {/* 그리기 버튼 — floating 모드에서만 표시 */}
        {!isModal && (
          <>
            <button
              aria-label="그리기"
              title="그리기"
              onClick={() => setIsDrawModalOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:bg-white/20 transition-colors"
            >
              <Pencil size={16} />
            </button>
            <div className="w-px h-6 bg-white/20" />
          </>
        )}

        {/* 텍스트 도구 */}
        <button
          aria-label="텍스트"
          title="텍스트"
          onClick={() => setTool(tool === 'text' ? 'brush' : 'text')}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            tool === 'text' ? 'bg-white text-black' : 'text-white hover:bg-white/20'
          }`}
        >
          <Type size={16} />
        </button>

        <div className="w-px h-6 bg-white/20" />

        {/* 사진 업로드 */}
        <button
          aria-label="사진 업로드"
          title="사진 업로드"
          onClick={() => fileInputRef.current?.click()}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
            isUploadMode ? 'bg-white text-black' : 'text-white hover:bg-white/20'
          }`}
        >
          <ImageIcon size={16} />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <DrawingModal
        isOpen={isDrawModalOpen}
        onClose={() => setIsDrawModalOpen(false)}
        onConfirm={(file) => onImageSelected?.(file)}
      />
    </>
  );
}
