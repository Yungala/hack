# Devlog — iter 1

> Slug: gallery-board
> Date: 2026-06-02

## 이 iteration의 의도

기존 공유 그라피티 캔버스를 제거하고 `drawings` 테이블 기반의 갤러리 보드로 메인 페이지를 전면 재구성한다. 사용자가 직접 그린 그림을 카드로 저장하고 자유롭게 드래그해 배치할 수 있는 협업 갤러리를 구현한다.

## 변경 파일

- `supabase/migrations/20260602100000_create_drawings_table.sql` — 신규: drawings 테이블, RLS, Storage 버킷 생성
- `src/lib/supabase.ts` — 수정: Drawing, DrawingInsert 인터페이스 추가
- `src/lib/schemas/drawing.ts` — 신규: Zod 스키마 (DrawingSchema, DrawingInsertSchema, DrawingUpdateSchema)
- `src/lib/api/drawings.ts` — 신규: fetchDrawings, insertDrawing, updateDrawingPosition, uploadDrawingImage, clearCanvasData
- `src/components/gallery/GalleryCard.tsx` — 신규: 개별 그림 카드 (드래그 + 클릭 구분)
- `src/components/gallery/CardViewer.tsx` — 신규: 확대 뷰어 모달 (ESC, 외부 클릭 닫기)
- `src/components/gallery/CanvasModal.tsx` — 신규: 그리기 모달 (완료→Storage→insert, 닫기→초기화)
- `src/components/gallery/GalleryBoard.tsx` — 신규: 카드 자유 배치 + Realtime INSERT/UPDATE 구독
- `src/routes/index.tsx` — 수정: 갤러리 보드 페이지로 완전 교체
- `src/components/graffiti/SkyView.tsx` — 삭제

## 결정 요지

1. **드래그/클릭 구분**: `GalleryCard`에서 `pointerdown`부터 누적 이동 거리(4px 임계값)로 드래그 여부를 판별한다. `pointerup` 시 드래그가 아닌 경우에만 `onClick`을 호출해 CardViewer가 열리도록 한다. 별도 라이브러리 없이 native pointer events만 사용.

2. **API 레이어 분리**: 컴포넌트/라우트에서 직접 supabase 호출을 하지 않고 `src/lib/api/drawings.ts`를 통해서만 접근한다. 모든 응답은 Zod로 검증한다.

3. **CanvasModal 독립 구현**: 기존 `GraffitiCanvas`는 전체 그라피티 벽 상태(Realtime, presence, 브로드캐스트)와 강하게 결합되어 있어 모달 안에 재사용하기 어렵다. DrawingModal의 패턴을 확장해 독립적인 `CanvasModal`로 구현했다. 완료 버튼에서 Storage 업로드 → drawings insert → strokes/images/texts 전체 삭제 순서를 보장한다.

## 자가 점검 결과

- `pnpm typecheck`: ✅
- `pnpm lint`: ✅ (경고 1개 — 기존 `src/components/ui/button.tsx`의 react-refresh 경고, 이번 작업과 무관)

## 미해결 / 향후 작업

- `clearCanvasData`에서 strokes/images/texts 테이블 전체 삭제 시 `neq('id', <임의 uuid>)` 패턴을 사용하는데, Supabase는 `delete().eq('id', ...)` 없이는 전체 삭제를 허용하지 않을 수 있다. 실제 Supabase 버전에 따라 `gt('created_at', '1970-01-01')` 등 대안 필터로 교체가 필요할 수 있다.
- 갤러리 카드가 많아지면 z-index 충돌 없이 카드 위에 카드가 올라오는 순서(레이어) 조정이 필요할 수 있다 (spec 범위 밖).
- 모바일에서 `window.innerWidth`를 렌더 시점에 읽는 방식은 SSR 환경에서는 문제가 될 수 있으나 현재 프로젝트는 CSR이므로 무방하다.
