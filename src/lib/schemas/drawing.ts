import { z } from 'zod';

export const DrawingSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().url(),
  x: z.number(),
  y: z.number(),
  created_at: z.string(),
});

export const DrawingInsertSchema = DrawingSchema.pick({ image_url: true, x: true, y: true });
export const DrawingUpdateSchema = DrawingSchema.pick({ x: true, y: true });

export type DrawingSchemaType = z.infer<typeof DrawingSchema>;
