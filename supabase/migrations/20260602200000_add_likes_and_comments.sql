-- drawings 테이블에 likes 컬럼 추가
ALTER TABLE drawings ADD COLUMN IF NOT EXISTS likes integer NOT NULL DEFAULT 0;

-- comments 테이블
CREATE TABLE IF NOT EXISTS comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  drawing_id uuid NOT NULL REFERENCES drawings(id) ON DELETE CASCADE,
  content text NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public read comments" ON comments FOR SELECT USING (true);
CREATE POLICY "public insert comments" ON comments FOR INSERT WITH CHECK (true);

-- likes 증가 RPC
CREATE OR REPLACE FUNCTION increment_drawing_likes(drawing_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE drawings SET likes = likes + 1 WHERE id = drawing_id RETURNING likes;
$$;
