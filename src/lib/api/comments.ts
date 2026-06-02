import { supabase } from '@/lib/supabase';
import type { Comment } from '@/lib/supabase';

export async function fetchComments(drawingId: string): Promise<Comment[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*')
    .eq('drawing_id', drawingId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return data as Comment[];
}

export async function insertComment(drawingId: string, content: string): Promise<Comment> {
  const { data, error } = await supabase
    .from('comments')
    .insert({ drawing_id: drawingId, content })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Comment;
}

export async function incrementLike(drawingId: string): Promise<number> {
  const { data, error } = await supabase.rpc('increment_drawing_likes', { drawing_id: drawingId });
  if (error) throw new Error(error.message);
  return data as number;
}
