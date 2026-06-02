import { supabase } from '@/lib/supabase';
import { DrawingSchema, DrawingInsertSchema, DrawingUpdateSchema } from '@/lib/schemas/drawing';
import type { Drawing, DrawingInsert } from '@/lib/supabase';
import { z } from 'zod';

export async function fetchDrawings(): Promise<Drawing[]> {
  const { data, error } = await supabase
    .from('drawings')
    .select('*')
    .order('created_at');
  if (error) throw new Error(error.message);
  return z.array(DrawingSchema).parse(data);
}

export async function insertDrawing(insert: DrawingInsert): Promise<Drawing> {
  DrawingInsertSchema.parse(insert);
  const { data, error } = await supabase.rpc('insert_drawing', {
    p_image_url: insert.image_url,
    p_x: insert.x,
    p_y: insert.y,
  });
  if (error) throw new Error(error.message);
  return DrawingSchema.parse(data);
}

export async function updateDrawingPosition(id: string, x: number, y: number): Promise<void> {
  DrawingUpdateSchema.parse({ x, y });
  const { error } = await supabase
    .from('drawings')
    .update({ x, y })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function uploadDrawingImage(blob: Blob): Promise<string> {
  const fileName = `${crypto.randomUUID()}.png`;
  const { error } = await supabase.storage
    .from('drawings')
    .upload(fileName, blob, { contentType: 'image/png' });
  if (error) throw new Error(error.message);
  const { data } = supabase.storage.from('drawings').getPublicUrl(fileName);
  return data.publicUrl;
}

export async function clearCanvasData(): Promise<void> {
  const results = await Promise.all([
    supabase.from('strokes').delete().gt('created_at', '1970-01-01'),
    supabase.from('graffiti_images').delete().gt('created_at', '1970-01-01'),
    supabase.from('graffiti_text').delete().gt('created_at', '1970-01-01'),
  ]);
  for (const { error } of results) {
    if (error) throw new Error(error.message);
  }
}
