# Review — iter 2

> Verdict: PASS
> Reviewed by: reviewer subagent
> Date: 2026-06-02

## iter 1 FAIL 항목 재검토 요약

### Blocker 1 — clearCanvasData 테이블명 불일치
- **수정 위치**: `src/lib/api/drawings.ts:45-54`
- **수정 내용**: `images` → `graffiti_images`, `texts` → `graffiti_text` 로 테이블명 수정 완료. 삭제 패턴도 `.gt('created_at', '1970-01-01')` 으로 변경. `for...of` 순회로 각 결과의 `error` 를 확인해 첫 번째 오류 발생 시 `throw` 처리.
- **판정**: ✅ 해소

### Blocker 2 — GalleryCard Realtime UPDATE 미반영 (AC10)
- **수정 위치**: `src/components/gallery/GalleryCard.tsx:19-23`
- **수정 내용**: `useEffect(() => { if (!isDragging.current) { setPos({ x: drawing.x, y: drawing.y }); } }, [drawing.x, drawing.y])` 추가. `isDragging` ref 가드로 드래그 중 덮어쓰기 방지. `pointerdown` 에서 `isDragging.current = true`, `pointerup` 에서 `false` 로 토글.
- **판정**: ✅ 해소

### Major — ESC 핸들러 stale closure
- **수정 위치**: `src/components/gallery/CanvasModal.tsx:43-59`
- **수정 내용**: `handleClose` 를 `useCallback` 으로 래핑하고 deps 에 `[getCtx, onClose, CANVAS_SIZE]` 명시. ESC keydown useEffect deps 에 `handleClose` 추가. `eslint-disable` 주석 제거.
- **판정**: ✅ 해소

### Minor — onDrawingAdded 중복 닫기
- **수정 위치**: `src/routes/index.tsx:32`
- **수정 내용**: `onDrawingAdded` 콜백을 `() => { /* GalleryBoard는 Realtime으로 자동 갱신 */ }` 로 변경. `setIsCanvasOpen(false)` 중복 호출 제거. `handleConfirm` 내부에서는 여전히 `onDrawingAdded()` → `onClose()` 순서로 호출되나 `onDrawingAdded` 가 실질적 부수작용 없는 no-op 이므로 문제 없음.
- **판정**: ✅ 해소

## 수용 기준 매핑

iter 1에서 검증된 AC1~AC14 매핑은 변동 없음. 이번 수정으로 AC6(4단계 캔버스 초기화), AC10(Realtime UPDATE 반영)의 실질적 동작이 보완되었음.

- AC6 → `src/lib/api/drawings.ts:45-54` clearCanvasData 정상 동작 ✅
- AC10 → `src/components/gallery/GalleryCard.tsx:19-23` Realtime UPDATE 시 setPos 반영 ✅

## 통과 항목 (요약)

- A. spec 부합성: ✅ 범위 밖 항목 미추가, 가정과 구현 일치
- B. 아키텍처: ✅ api 레이어 경유, Zod 검증, path alias, `any` 없음, 1파일 1 named export, kebab-case, cleanup 존재
- C. 코드 품질: ✅ (Blocker/Major 모두 해소, 기존 minor 항목은 아래 권고 참조)
- D. 보안: ✅ 하드코딩 시크릿 없음, VITE_* 사용, Zod 입력 검증

## 실패 항목

없음.

## 권고 (선택)

1. **GalleryCard 접근성 미보완** (iter 1 minor, 이번 iter 에서 미수정): `src/components/gallery/GalleryCard.tsx:69-93` 의 드래그 카드가 `role`, `tabIndex`, `onKeyDown` 없이 순수 `<div>` + pointer 이벤트로만 구현되어 있음. 키보드/스크린 리더 사용자가 카드를 클릭할 수 없음. spec 범위 밖으로 명시하지 않았으므로 후속 이슈로 분리 권장.

2. **CANVAS_SIZE / isMobile 리사이즈 미대응**: `CanvasModal` 의 `CANVAS_SIZE`, `isMobile` 이 마운트 시점의 `window.innerWidth` 고정값. 브라우저 창 크기 변경 시 캔버스가 갱신되지 않음. 현재 spec 범위 밖이나 추후 `ResizeObserver` 연동 권장.

3. **GalleryBoard 초기 로드 에러 토스트 없음**: `fetchDrawings` 실패 시 `console.error` 만 호출. 사용자에게 오류를 알리는 토스트 처리 미흡. 후속 이슈로 분리 권장.

---

Verdict: PASS
