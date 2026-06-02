import { useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';

export type TransformItem =
  | { kind: 'image'; dataUrl: string; file: File; naturalW: number; naturalH: number }
  | { kind: 'text'; content: string; color: string; fontSize: number; fontFamily: string };

interface TF { cx: number; cy: number; w: number; h: number; rot: number }

type DragOp =
  | { op: 'move'; startX: number; startY: number; startCX: number; startCY: number }
  | { op: 'resize'; startX: number; startY: number; startCX: number; startCY: number; startW: number; startH: number }
  | { op: 'rotate'; centerX: number; centerY: number; startAngle: number; startRot: number };

interface Props {
  item: TransformItem;
  canvasRect: DOMRect;
  initialCX?: number;
  initialCY?: number;
  onConfirm: (file: File, cx: number, cy: number, cssW: number, cssH: number) => void;
  onCancel: () => void;
}

const MIN_W = 40;

function measureInitialSize(item: TransformItem, canvasRect: DOMRect): { w: number; h: number } {
  if (item.kind === 'image') {
    const maxW = canvasRect.width * 0.4;
    const maxH = canvasRect.height * 0.4;
    const scale = Math.min(maxW / item.naturalW, maxH / item.naturalH, 1);
    return { w: item.naturalW * scale, h: item.naturalH * scale };
  }
  const oc = document.createElement('canvas').getContext('2d')!;
  oc.font = `bold ${item.fontSize}px ${item.fontFamily}`;
  const sample = item.content.trim() || 'Aa';
  const tw = Math.max(oc.measureText(sample).width + 24, 80);
  return { w: tw, h: item.fontSize * 1.5 };
}

export function TransformOverlay({ item, canvasRect, initialCX, initialCY, onConfirm, onCancel }: Props) {
  const initSizeRef = useRef<{ w: number; h: number } | null>(null);
  const [tf, setTf] = useState<TF>(() => {
    const { w, h } = measureInitialSize(item, canvasRect);
    initSizeRef.current = { w, h };
    const cx = initialCX ?? (canvasRect.left + canvasRect.width / 2);
    const cy = initialCY ?? (canvasRect.top + canvasRect.height / 2);
    return { cx, cy, w, h, rot: 0 };
  });

  const [localText, setLocalText] = useState(() => item.kind === 'text' ? item.content : '');
  const ghostRef = useRef<HTMLSpanElement>(null);

  const dragRef = useRef<DragOp | null>(null);
  const tfWRef = useRef(tf.w); // tf.w 최신값을 stale closure 없이 참조
  tfWRef.current = tf.w;
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  // 텍스트 변경 시 measureText로 너비 계산해 tf.w 동기화
  useEffect(() => {
    if (item.kind !== 'text') return;
    const fontSize = item.fontSize * (tf.w / (initSizeRef.current?.w ?? tf.w));
    const oc = document.createElement('canvas').getContext('2d')!;
    oc.font = `bold ${fontSize}px ${item.fontFamily}`;
    const measured = oc.measureText(localText || 'Aa').width + 24;
    const newW = Math.max(measured, MIN_W);
    if (initSizeRef.current) {
      initSizeRef.current.w = initSizeRef.current.w * newW / tfWRef.current;
    }
    setTf(prev => ({ ...prev, w: newW }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localText]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onCancelRef.current();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    function onMove(e: PointerEvent) {
      const d = dragRef.current;
      if (!d) return;
      if (d.op === 'move') {
        setTf(prev => ({ ...prev, cx: d.startCX + e.clientX - d.startX, cy: d.startCY + e.clientY - d.startY }));
      } else if (d.op === 'resize') {
        const dx = e.clientX - d.startCX;
        const dy = e.clientY - d.startCY;
        const cur = Math.sqrt(dx * dx + dy * dy);
        const dx0 = d.startX - d.startCX;
        const dy0 = d.startY - d.startCY;
        const orig = Math.sqrt(dx0 * dx0 + dy0 * dy0);
        if (orig < 1) return;
        const scale = Math.max(cur / orig, MIN_W / d.startW);
        setTf(prev => ({ ...prev, w: d.startW * scale, h: d.startH * scale }));
      } else if (d.op === 'rotate') {
        const angle = Math.atan2(e.clientY - d.centerY, e.clientX - d.centerX) * (180 / Math.PI) + 90;
        setTf(prev => ({ ...prev, rot: d.startRot + (angle - d.startAngle) }));
      }
    }
    function onUp() { dragRef.current = null; }
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  function handleConfirm() {
    if (item.kind === 'text' && !localText.trim()) { onCancel(); return; }
    const rotRad = tf.rot * Math.PI / 180;
    const ac = Math.abs(Math.cos(rotRad));
    const as = Math.abs(Math.sin(rotRad));
    const bboxW = Math.round(tf.w * ac + tf.h * as);
    const bboxH = Math.round(tf.w * as + tf.h * ac);

    const QUALITY = 2;
    const oc = document.createElement('canvas');
    oc.width = bboxW * QUALITY;
    oc.height = bboxH * QUALITY;
    const c = oc.getContext('2d')!;
    c.scale(QUALITY, QUALITY);
    c.translate(bboxW / 2, bboxH / 2);
    c.rotate(rotRad);

    function finalize() {
      oc.toBlob((blob) => {
        if (!blob) return;
        onConfirm(new File([blob], `item-${Date.now()}.png`, { type: 'image/png' }), tf.cx, tf.cy, bboxW, bboxH);
      }, 'image/png');
    }

    if (item.kind === 'image') {
      const img = new Image();
      img.onload = () => { c.drawImage(img, -tf.w / 2, -tf.h / 2, tf.w, tf.h); finalize(); };
      img.src = item.dataUrl;
    } else {
      const initW = initSizeRef.current?.w ?? tf.w;
      const fontSize = item.fontSize * (tf.w / initW);
      c.fillStyle = item.color;
      c.font = `bold ${fontSize}px ${item.fontFamily}`;
      c.textBaseline = 'middle';
      c.textAlign = 'center';
      c.fillText(localText, 0, 0);
      finalize();
    }
  }

  const initW = initSizeRef.current?.w ?? tf.w;
  const textFontSize = item.kind === 'text' ? item.fontSize * (tf.w / initW) : 0;
  const itemLeft = tf.cx - tf.w / 2;
  const itemTop = tf.cy - tf.h / 2;

  return (
    <div className="fixed inset-0 z-30" style={{ touchAction: 'none' }}>
      <div className="absolute inset-0 bg-black/25 pointer-events-none" />

      {/* 변환 대상 */}
      <div
        style={{
          position: 'fixed',
          left: itemLeft,
          top: itemTop,
          width: tf.w,
          height: tf.h,
          transform: `rotate(${tf.rot}deg)`,
          transformOrigin: 'center',
          cursor: 'move',
          userSelect: 'none',
          touchAction: 'none',
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragRef.current = { op: 'move', startX: e.clientX, startY: e.clientY, startCX: tf.cx, startCY: tf.cy };
        }}
      >
        {/* 점선 테두리 */}
        <div className="absolute inset-0 border-2 border-dashed border-white/75 rounded-sm pointer-events-none" />

        {/* 콘텐츠 */}
        {item.kind === 'image' ? (
          <img
            src={item.dataUrl}
            draggable={false}
            style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            <div
              style={{ display: 'grid', pointerEvents: 'auto' }}
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span ref={ghostRef} style={{
                gridArea: '1/1', visibility: 'hidden', whiteSpace: 'pre',
                fontSize: textFontSize, fontFamily: item.fontFamily, fontWeight: 'bold',
                padding: '0 4px', minWidth: '2ch',
              }}>
                {localText + '​'}
              </span>
              <input
                autoFocus
                value={localText}
                onChange={(e) => setLocalText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing) { e.preventDefault(); handleConfirm(); }
                }}
                style={{
                  gridArea: '1/1', background: 'transparent', border: 'none', outline: 'none',
                  color: item.color, fontSize: textFontSize, fontFamily: item.fontFamily, fontWeight: 'bold',
                  caretColor: item.color, padding: '0 4px', width: '100%', minWidth: '2ch', textAlign: 'center',
                }}
              />
            </div>
          </div>
        )}

        {/* 회전 줄기 */}
        <div
          className="absolute pointer-events-none"
          style={{ bottom: '100%', left: '50%', transform: 'translateX(-50%)', width: 1, height: 32, background: 'rgba(255,255,255,0.6)' }}
        />
        {/* 회전 핸들 */}
        <div
          className="absolute rounded-full bg-white border-2 border-zinc-600 shadow"
          style={{ width: 18, height: 18, bottom: 'calc(100% + 32px)', left: '50%', transform: 'translateX(-50%)', cursor: 'grab' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            const a = Math.atan2(e.clientY - tf.cy, e.clientX - tf.cx) * (180 / Math.PI) + 90;
            dragRef.current = { op: 'rotate', centerX: tf.cx, centerY: tf.cy, startAngle: a, startRot: tf.rot };
          }}
        />

        {/* SE 크기 조절 핸들 */}
        <div
          className="absolute bg-white border-2 border-zinc-600 rounded-sm shadow"
          style={{ width: 14, height: 14, bottom: -7, right: -7, cursor: 'se-resize' }}
          onPointerDown={(e) => {
            e.stopPropagation();
            dragRef.current = { op: 'resize', startX: e.clientX, startY: e.clientY, startCX: tf.cx, startCY: tf.cy, startW: tf.w, startH: tf.h };
          }}
        />
      </div>

      {/* 확인 / 취소 — SE 핸들 아래에 배치 */}
      <div className="fixed z-40 flex gap-3" style={{ left: tf.cx + tf.w / 2 - 44, top: tf.cy + tf.h / 2 + 16 }}>
        <button
          onClick={onCancel}
          className="w-10 h-10 rounded-full bg-black/70 backdrop-blur-sm border border-white/20 text-white flex items-center justify-center hover:bg-black/90 transition-colors"
        >
          <X size={16} />
        </button>
        <button
          onClick={handleConfirm}
          className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 transition-colors shadow-lg"
        >
          <Check size={16} />
        </button>
      </div>
    </div>
  );
}
