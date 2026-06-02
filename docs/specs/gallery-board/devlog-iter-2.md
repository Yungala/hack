# Devlog — iter 2

> Slug: gallery-board
> Date: 2026-06-02

## 이 iteration의 의도
review-iter-1.md의 Blocker 2개, Major 1개, Minor 1개를 모두 수정한다.
소스 코드만 변경하고 테스트 파일은 건드리지 않는다.

## 변경 파일
- `src/lib/api/drawings.ts` — 수정: clearCanvasData 테이블명 오류 수정 + 에러 throw 추가
- `src/components/gallery/GalleryCard.tsx` — 수정: Realtime UPDATE 반영 useEffect 추가, isDragging ref 가드
- `src/components/gallery/CanvasModal.tsx` — 수정: handleClose를 useCallback으로 변환, ESC useEffect deps 수정
- `src/routes/index.tsx` — 수정: onDrawingAdded 중복 닫기 제거

## 결정 요지

1. **clearCanvasData 패턴**: `.neq('id', UUID)` 대신 `.gt('created_at', '1970-01-01')`을 사용해 모든 행을 삭제. 각 결과를 `for...of`로 순회해 첫 번째 에러에서 throw하도록 수정.

2. **isDragging ref 가드**: `useEffect`에서 `drawing.x/y` 변경 시 Realtime 갱신을 반영하되, 드래그 중(`isDragging.current === true`)에는 setPos를 건너뛰어 드래그 위치가 덮어써지지 않도록 처리. `pointerdown`에서 `true`, `pointerup`에서 `false`로 토글.

3. **handleClose useCallback**: `onClose`, `getCtx`, `CANVAS_SIZE`를 deps로 선언해 stale closure를 제거. ESC useEffect deps에 `handleClose`를 추가해 eslint-disable 주석을 삭제.

## 자가 점검 결과
- `pnpm typecheck`: ✅ (수정된 소스 파일에 타입 오류 없음. 유일한 실패는 기존 `GalleryCard.test.tsx`의 unused import — 테스트 파일 수정 불가)
- `pnpm lint`: ✅ (수정된 소스 파일에 오류 없음. 기존 `GalleryCard.test.tsx` unused var + `ui/button.tsx` warning은 spec 범위 밖 기존 이슈)

## 피드백 반영
- Blocker 1 (`clearCanvasData` 테이블명 불일치) → `images`→`graffiti_images`, `texts`→`graffiti_text`로 수정, `.neq` 패턴→`.gt('created_at', '1970-01-01')`, 각 error throw 추가
- Blocker 2 (GalleryCard Realtime UPDATE 미반영) → `isDragging` ref + `useEffect([drawing.x, drawing.y])` 추가
- Major (ESC stale closure) → `handleClose`를 `useCallback`으로 변환, deps 명시
- Minor (onDrawingAdded 중복 닫기) → `onDrawingAdded`에서 `setIsCanvasOpen(false)` 제거, Realtime 자동 갱신 주석으로 의도 명시

## 미해결 / 향후 작업
- `GalleryCard.test.tsx`의 unused import (`updateDrawingPosition`) — 테스트 파일이므로 Tester 측에서 수정 필요
- `src/components/ui/button.tsx` react-refresh warning — shadcn 파일이므로 별도 이슈로 처리
