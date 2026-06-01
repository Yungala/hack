import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { supabase, type GraffitiImage, type GraffitiText, type Stroke } from '@/lib/supabase';
import { useDrawingStore, type Thickness } from '@/stores/drawing-store';
import { TransformOverlay, type TransformItem } from './TransformOverlay';

const LOGICAL_W = 1920;
const LOGICAL_H = 1080;
const CHANNEL_NAME = 'graffiti-wall';
const FONT_SIZES: Record<Thickness, number> = { 2: 28, 6: 52, 14: 100 };

const WALL_BOTTOM = 870;
const CAP_H = 12;
const BASEBOARD_H = 72;
const MOLDING_H = 34;
// brickY = 870 + 12 + 72 + 34 = 988 → to 1080 = 92px

function drawHerringbone(c: CanvasRenderingContext2D, startY: number, endY: number) {
  const cell = 60;
  const mortar = 3;
  const bH = Math.floor((cell - 3 * mortar) / 2); // 25
  const bW = cell - 2 * mortar;                   // 54

  c.save();
  c.beginPath();
  c.rect(0, startY, LOGICAL_W, endY - startY);
  c.clip();

  c.fillStyle = '#5a4e47';
  c.fillRect(0, startY, LOGICAL_W, endY - startY);

  const brickColors = ['#8c7f76', '#97897f', '#7f7369', '#a09388', '#867a70'];
  const startRow = Math.floor(startY / cell);
  const endRow = Math.ceil(endY / cell);

  for (let row = startRow; row <= endRow; row++) {
    for (let col = 0; col * cell <= LOGICAL_W; col++) {
      const px = col * cell;
      const py = row * cell;
      const isH = (row + col) % 2 === 0;
      const c1 = brickColors[Math.abs(row * 7 + col * 3) % brickColors.length];
      const c2 = brickColors[Math.abs(row * 5 + col * 7 + 2) % brickColors.length];

      c.fillStyle = c1;
      if (isH) {
        c.fillRect(px + mortar, py + mortar, bW, bH);
        c.fillStyle = c2;
        c.fillRect(px + mortar, py + mortar + bH + mortar, bW, bH);
      } else {
        c.fillRect(px + mortar, py + mortar, bH, bW);
        c.fillStyle = c2;
        c.fillRect(px + mortar + bH + mortar, py + mortar, bH, bW);
      }
    }
  }
  c.restore();
}

function drawBackground(c: CanvasRenderingContext2D) {
  // 벽 (스투코 질감)
  const wallGrad = c.createLinearGradient(0, 0, 0, WALL_BOTTOM);
  wallGrad.addColorStop(0, '#eae7e0');
  wallGrad.addColorStop(0.5, '#e3e0d9');
  wallGrad.addColorStop(1, '#dbd8d1');
  c.fillStyle = wallGrad;
  c.fillRect(0, 0, LOGICAL_W, WALL_BOTTOM);

  // 미세 스투코 점묘
  c.save();
  c.globalAlpha = 0.12;
  for (let i = 0; i < 7000; i++) {
    const x = Math.random() * LOGICAL_W;
    const y = Math.random() * WALL_BOTTOM;
    const bright = Math.random() > 0.5;
    c.fillStyle = bright ? '#ffffff' : '#7a7870';
    c.fillRect(x, y, Math.random() * 2 + 1, Math.random() * 2 + 1);
  }
  c.restore();

  // 걸레받이 캡 (shadow line)
  const capY = WALL_BOTTOM;
  const capGrad = c.createLinearGradient(0, capY, 0, capY + CAP_H);
  capGrad.addColorStop(0, '#aeaaa3');
  capGrad.addColorStop(1, '#c6c2bc');
  c.fillStyle = capGrad;
  c.fillRect(0, capY, LOGICAL_W, CAP_H);

  // 흰 걸레받이
  const boardY = capY + CAP_H;
  const boardGrad = c.createLinearGradient(0, boardY, 0, boardY + BASEBOARD_H);
  boardGrad.addColorStop(0, '#f3f1ef');
  boardGrad.addColorStop(0.8, '#edeae7');
  boardGrad.addColorStop(1, '#d6d3ce');
  c.fillStyle = boardGrad;
  c.fillRect(0, boardY, LOGICAL_W, BASEBOARD_H);

  // 어두운 몰딩 띠
  const moldingY = boardY + BASEBOARD_H;
  c.fillStyle = '#2c2620';
  c.fillRect(0, moldingY, LOGICAL_W, MOLDING_H);
  c.fillStyle = '#44403a';
  c.fillRect(0, moldingY, LOGICAL_W, 5);

  // 헤링본 벽돌 바닥
  drawHerringbone(c, moldingY + MOLDING_H, LOGICAL_H);
}

function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
  if (stroke.points.length < 2) return;
  ctx.save();
  ctx.strokeStyle = stroke.color;
  ctx.lineWidth = stroke.thickness;
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

async function preloadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => resolve(el);
    el.src = url;
  });
}

function drawImageEl(ctx: CanvasRenderingContext2D, el: HTMLImageElement, img: GraffitiImage) {
  if (!el.naturalWidth) return;
  ctx.save();
  ctx.drawImage(el, img.x - img.width / 2, img.y - img.height / 2, img.width, img.height);
  ctx.restore();
}

async function drawImage(ctx: CanvasRenderingContext2D, img: GraffitiImage) {
  const el = await preloadImage(img.url);
  drawImageEl(ctx, el, img);
}

function drawText(ctx: CanvasRenderingContext2D, text: GraffitiText) {
  ctx.save();
  ctx.fillStyle = text.color;
  ctx.font = `bold ${text.font_size}px ${text.font_family ?? 'sans-serif'}`;
  ctx.textBaseline = 'top';
  ctx.fillText(text.content, text.x, text.y);
  ctx.restore();
}

export function GraffitiCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const { color, thickness, tool, fontFamily, setConnected, setPresenceCount, setUploadMode, setPendingImageFile, pendingImageFile } = useDrawingStore();
  const localStrokeIds = useRef(new Set<string>());
  const localImageIds = useRef(new Set<string>());
  const localTextIds = useRef(new Set<string>());

  const [transformPending, setTransformPending] = useState<{
    item: TransformItem; initialCX?: number; initialCY?: number;
  } | null>(null);

  const ctx = useCallback(() => canvasRef.current?.getContext('2d') ?? null, []);

  // 초기 로딩
  useEffect(() => {
    async function load() {
      const c = ctx();
      if (!c) return;

      drawBackground(c);

      const [strokesRes, imagesRes, textsRes] = await Promise.all([
        supabase.from('strokes').select('*').order('created_at'),
        supabase.from('images').select('*').order('created_at'),
        supabase.from('texts').select('*').order('created_at'),
      ]);

      const strokes: Stroke[] = strokesRes.data ?? [];
      const images: GraffitiImage[] = imagesRes.data ?? [];
      const texts: GraffitiText[] = textsRes.data ?? [];

      // 이미지 모두 병렬 프리로드
      const imageElMap = new Map(
        await Promise.all(
          images.map(async (img) => [img.id, await preloadImage(img.url)] as const)
        )
      );

      type Item =
        | { type: 'stroke'; data: Stroke }
        | { type: 'image'; data: GraffitiImage }
        | { type: 'text'; data: GraffitiText };

      const items: Item[] = [
        ...strokes.map((s) => ({ type: 'stroke' as const, data: s })),
        ...images.map((img) => ({ type: 'image' as const, data: img })),
        ...texts.map((t) => ({ type: 'text' as const, data: t })),
      ].sort((a, b) => a.data.created_at.localeCompare(b.data.created_at));

      for (const item of items) {
        if (item.type === 'stroke') drawStroke(c, item.data);
        else if (item.type === 'image') {
          const el = imageElMap.get(item.data.id);
          if (el) drawImageEl(c, el, item.data);
        } else {
          drawText(c, item.data);
        }
      }
    }

    load();
  }, [ctx]);

  // Realtime 구독 (Broadcast 방식)
  useEffect(() => {
    const channel = supabase
      .channel(CHANNEL_NAME)
      .on('broadcast', { event: 'new_stroke' }, ({ payload: stroke }: { payload: Stroke }) => {
        if (localStrokeIds.current.has(stroke.id)) return;
        const c = ctx();
        if (c) drawStroke(c, stroke);
      })
      .on('broadcast', { event: 'new_image' }, async ({ payload: img }: { payload: GraffitiImage }) => {
        if (localImageIds.current.has(img.id)) return;
        const c = ctx();
        if (c) await drawImage(c, img);
      })
      .on('broadcast', { event: 'new_text' }, ({ payload: text }: { payload: GraffitiText }) => {
        if (localTextIds.current.has(text.id)) return;
        const c = ctx();
        if (c) drawText(c, text);
      })
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setPresenceCount(Object.keys(state).length);
      })
      .subscribe(async (status) => {
        console.log('[Realtime]', status);
        setConnected(status === 'SUBSCRIBED');
        if (status === 'SUBSCRIBED') {
          await channel.track({ joined_at: Date.now() });
        }
      });

    channelRef.current = channel;
    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [ctx, setConnected, setPresenceCount]);

  // 이미지 파일 선택 → 변환 모드
  useEffect(() => {
    if (!pendingImageFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        setTransformPending({
          item: { kind: 'image', dataUrl, file: pendingImageFile, naturalW: img.width, naturalH: img.height },
        });
        setPendingImageFile(null);
        setUploadMode(false);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(pendingImageFile);
  }, [pendingImageFile, setUploadMode, setPendingImageFile]);

  function cssToLogical(cssW: number, cssH: number) {
    const rect = canvasRef.current?.getBoundingClientRect();
    const scaleX = rect ? LOGICAL_W / rect.width : 1;
    const scaleY = rect ? LOGICAL_H / rect.height : 1;
    return { w: cssW * scaleX, h: cssH * scaleY };
  }

  // 변환 확정 → 캔버스에 그리고 저장
  async function handleTransformConfirm(file: File, cssX: number, cssY: number, cssW: number, cssH: number) {
    setTransformPending(null);
    const { w: logW, h: logH } = cssToLogical(cssW, cssH);
    const rect = canvasRef.current?.getBoundingClientRect();
    const logX = rect ? (cssX - rect.left) / rect.width * LOGICAL_W : cssX;
    const logY = rect ? (cssY - rect.top) / rect.height * LOGICAL_H : cssY;

    // 즉시 캔버스에 표시
    const objUrl = URL.createObjectURL(file);
    const el = await preloadImage(objUrl);
    URL.revokeObjectURL(objUrl);
    const c = ctx();
    if (c && el.naturalWidth) {
      c.save();
      c.drawImage(el, logX - logW / 2, logY - logH / 2, logW, logH);
      c.restore();
    }

    const fileName = `${crypto.randomUUID()}.png`;
    const { error: uploadError } = await supabase.storage
      .from('graffiti-images')
      .upload(fileName, file, { contentType: 'image/png' });
    if (uploadError) { toast.error('저장에 실패했습니다. 다시 시도해주세요.'); return; }

    const { data: urlData } = supabase.storage.from('graffiti-images').getPublicUrl(fileName);
    const { data, error } = await supabase.from('images')
      .insert({ url: urlData.publicUrl, x: logX, y: logY, width: logW, height: logH })
      .select().single();
    if (error) { toast.error('저장에 실패했습니다. 다시 시도해주세요.'); return; }

    localImageIds.current.add(data.id);
    channelRef.current?.send({ type: 'broadcast', event: 'new_image', payload: data });
  }

  function handlePointerDown(e: React.PointerEvent) {
    if (tool === 'text') {
      e.preventDefault();
      setTransformPending({
        item: { kind: 'text', content: '', color, fontSize: FONT_SIZES[thickness], fontFamily },
        initialCX: e.clientX,
        initialCY: e.clientY,
      });
    }
  }

  return (
    <>
      <canvas
        ref={canvasRef}
        width={LOGICAL_W}
        height={LOGICAL_H}
        className="fixed left-0 w-screen z-20"
        style={{
          top: '20vh',
          height: '80vh',
          cursor: tool === 'text' ? 'text' : 'default',
          touchAction: 'none',
        }}
        onPointerDown={handlePointerDown}
      />

      {transformPending && canvasRef.current && (
        <TransformOverlay
          item={transformPending.item}
          canvasRect={canvasRef.current.getBoundingClientRect()}
          initialCX={transformPending.initialCX}
          initialCY={transformPending.initialCY}
          onConfirm={handleTransformConfirm}
          onCancel={() => { setTransformPending(null); setUploadMode(false); }}
        />
      )}

    </>
  );
}
