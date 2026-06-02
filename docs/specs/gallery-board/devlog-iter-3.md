# Devlog — iter 3

> Slug: gallery-board
> Date: 2026-06-02

## 이 iteration의 의도
E2E1 실패 원인인 "완료 후 갤러리 카드 즉시 미표시" 문제를 낙관적 업데이트로 해결한다.
Supabase Realtime이 동일 클라이언트의 INSERT 이벤트를 수신하지 못하는 상황에서도
완료 버튼 클릭 즉시 갤러리에 카드가 렌더링되도록 한다.

## 변경 파일
- `src/components/gallery/CanvasModal.tsx` — 수정: `onDrawingAdded` 타입을 `() => void`에서 `(drawing: Drawing) => void`로 변경. `handleConfirm`에서 `insertDrawing` 반환값을 캡처하여 콜백에 전달.
- `src/components/gallery/GalleryBoard.tsx` — 수정: `extraDrawings?: Drawing[]` prop 추가. `useMemo`로 내부 `drawings`와 `extraDrawings`를 id 기준 dedup 병합하여 `merged` 목록 계산. 렌더링은 `merged` 사용.
- `src/routes/index.tsx` — 수정: `extraDrawings` 상태 추가. `handleDrawingAdded`에서 중복 체크 후 `setExtraDrawings`로 즉시 추가. `GalleryBoard`에 `extraDrawings` prop 전달. `CanvasModal`의 `onDrawingAdded`에 `handleDrawingAdded` 연결.

## 결정 요지
1. **extraDrawings prop 패턴 선택**: `GalleryBoard` 내부 상태(`drawings`)는 건드리지 않고, 부모에서 낙관적 항목을 `extraDrawings`로 주입하는 방식을 선택. `GalleryBoard`가 Realtime으로 같은 id를 수신하면 `merged` 계산 시 `drawings` 쪽이 우선되어 중복 없이 자연스럽게 교체됨.
2. **단방향 데이터 흐름 유지**: `GalleryBoard`는 여전히 내부에서 fetch와 Realtime 구독을 담당하고, 외부에서는 낙관적 추가만 밀어 넣는다. 레이어 의존성 방향을 어기지 않음.
3. **insertDrawing 반환값 활용**: `insertDrawing`은 이미 `Drawing`을 반환하고 있었으므로 API 레이어 변경 없이 반환값만 캡처하면 됐음.

## 자가 점검 결과
- `pnpm typecheck`: ✅
- `pnpm lint`: ✅ (경고 1건은 기존 `src/components/ui/button.tsx` 관련, 이번 변경과 무관)

## 피드백 반영
- E2E Tester (e2e-iter-2.md) "Realtime 자기 INSERT 반영 수정" 권고 → `onDrawingAdded(drawing)` 콜백으로 낙관적 업데이트 적용하여 해결.
