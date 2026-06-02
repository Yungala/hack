import { createClient } from '@supabase/supabase-js';
import { env } from '@/env';

export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  realtime: { log_level: 'info' },
});

export interface Stroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  thickness: 2 | 6 | 14;
  created_at: string;
}

export interface StrokeInsert {
  points: { x: number; y: number }[];
  color: string;
  thickness: 2 | 6 | 14;
}

export interface GraffitiImage {
  id: string;
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
  created_at: string;
}

export interface GraffitiImageInsert {
  url: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface GraffitiText {
  id: string;
  content: string;
  x: number;
  y: number;
  color: string;
  font_size: number;
  font_family: string;
  created_at: string;
}

export interface GraffitiTextInsert {
  content: string;
  x: number;
  y: number;
  color: string;
  font_size: number;
  font_family: string;
}

export interface Drawing {
  id: string;
  image_url: string;
  x: number;
  y: number;
  created_at: string;
}

export interface DrawingInsert {
  image_url: string;
  x: number;
  y: number;
}
