import { describe, expect, it } from 'vitest';
import { DrawingSchema, DrawingInsertSchema, DrawingUpdateSchema } from './drawing';

// AC1, AC2 관련: Drawing 데이터 구조 검증
describe('DrawingSchema', () => {
  it('유효한 Drawing 객체를 파싱한다', () => {
    const valid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      image_url: 'https://example.com/image.png',
      x: 100,
      y: 200,
      created_at: '2026-06-02T00:00:00Z',
    };
    expect(() => DrawingSchema.parse(valid)).not.toThrow();
    const result = DrawingSchema.parse(valid);
    expect(result.x).toBe(100);
    expect(result.y).toBe(200);
  });

  it('image_url이 URL 형식이 아니면 파싱에 실패한다', () => {
    const invalid = {
      id: '123e4567-e89b-12d3-a456-426614174000',
      image_url: 'not-a-url',
      x: 100,
      y: 200,
      created_at: '2026-06-02T00:00:00Z',
    };
    expect(() => DrawingSchema.parse(invalid)).toThrow();
  });

  it('id가 UUID 형식이 아니면 파싱에 실패한다', () => {
    const invalid = {
      id: 'not-a-uuid',
      image_url: 'https://example.com/image.png',
      x: 100,
      y: 200,
      created_at: '2026-06-02T00:00:00Z',
    };
    expect(() => DrawingSchema.parse(invalid)).toThrow();
  });
});

// AC6 관련: insert 스키마 검증
describe('DrawingInsertSchema', () => {
  it('image_url, x, y만 포함한 객체를 파싱한다', () => {
    const valid = {
      image_url: 'https://example.com/image.png',
      x: 300,
      y: 400,
    };
    const result = DrawingInsertSchema.parse(valid);
    expect(result.image_url).toBe('https://example.com/image.png');
    expect(result.x).toBe(300);
    expect(result.y).toBe(400);
  });

  it('image_url이 없으면 파싱에 실패한다', () => {
    expect(() => DrawingInsertSchema.parse({ x: 0, y: 0 })).toThrow();
  });
});

// AC9 관련: 위치 업데이트 스키마 검증
describe('DrawingUpdateSchema', () => {
  it('x, y만 포함한 객체를 파싱한다', () => {
    const result = DrawingUpdateSchema.parse({ x: 50, y: 75 });
    expect(result.x).toBe(50);
    expect(result.y).toBe(75);
  });

  it('x 또는 y가 없으면 파싱에 실패한다', () => {
    expect(() => DrawingUpdateSchema.parse({ x: 50 })).toThrow();
  });
});
