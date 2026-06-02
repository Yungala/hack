-- drawings 테이블 생성
create table if not exists drawings (
  id          uuid        primary key default gen_random_uuid(),
  image_url   text        not null,
  x           float8      not null,
  y           float8      not null,
  created_at  timestamptz not null default now()
);

-- RLS 활성화
alter table drawings enable row level security;

-- 공개 읽기 정책
create policy "drawings_public_read"
  on drawings for select
  using (true);

-- 공개 쓰기 정책 (insert)
create policy "drawings_public_insert"
  on drawings for insert
  with check (true);

-- 공개 업데이트 정책 (x, y 드래그)
create policy "drawings_public_update"
  on drawings for update
  using (true)
  with check (true);

-- Storage 버킷 생성 (public)
insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', true)
on conflict (id) do nothing;

-- Storage 공개 읽기 정책
create policy "drawings_storage_public_read"
  on storage.objects for select
  using (bucket_id = 'drawings');

-- Storage 공개 업로드 정책
create policy "drawings_storage_public_insert"
  on storage.objects for insert
  with check (bucket_id = 'drawings');
