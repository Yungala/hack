# Review — iter 1

> Verdict: FAIL
> Reviewed by: reviewer subagent
> Date: 2026-06-02

## 수용 기준 매핑

- AC1 → `src/components/gallery/GalleryBoard.tsx:13-17` (fetchDrawings + useState로 초기 로드, GalleryCard에 pos 적용) ✅ 충족
- AC2 → `src/components/gallery/GalleryBoard.tsx:56-65` (drawings.length === 0 시 플레이스홀더 표시) ✅ 충족
- AC3 → `src/routes/index.tsx:22-26` (버튼 클릭 → CanvasModal 오픈, 내부에 캔버스+도구 포함) ✅ 충족
- AC4 → `src/components/gallery/CanvasModal.tsx:144-148` (maxWidth 1280, width 90vw, maxHeight 90vh) ✅ 충족
- AC5 → `src/components/gallery/CanvasModal.tsx:24, 169` (window.innerWidth < 768 시 정사각형) ✅ 충족
- AC6 → `src/components/gallery/CanvasModal.tsx:106-133` (toBlob → uploadDrawingImage → insertDrawing → clearCanvasData → onClose 순서) ✅ 충족 (단, clearCanvasData의 테이블명 불일치 문제 별도 기재)
- AC7 → `src/components/gallery/CanvasModal.tsx:53-59` (X 버튼 handleClose: canvas.clearRect + onClose, DB 기록 없음) ✅ 충족
- AC8 → `src/components/gallery/CanvasModal.tsx:44-51` (ESC keydown → handleClose) ✅ 충족
- AC9 → `src/components/gallery/GalleryCard.tsx:51-53` (드래그 종료 시 updateDrawingPosition 호출) ✅ 충족
- AC10 → `src/components/gallery/GalleryBoard.tsx:35-44` (Realtime UPDATE → setDrawings 갱신) ✅ 충족
- AC11 → `src/components/gallery/GalleryBoard.tsx:23-33` (Realtime INSERT → setDrawings 추가, 중복 방어 포함) ✅ 충족
- AC12 → `src/components/gallery/CardViewer.tsx` (모달 외부 클릭 / 닫기 버튼 / ESC 닫기) ✅ 충족
- AC13 → `src/components/gallery/CanvasModal.tsx:128-131` (catch에서 toast.error, finally에서만 isSubmitting 해제, onClose 미호출) ✅ 충족
- AC14 → `src/routes/__root.tsx` (헤더 자체가 없어졌으므로 "기록" 링크 없음) ✅ 충족

## 통과 항목 (요약)

- A. spec 부합성: ✅ (제거 대상 파일 삭제 확인, Zone/archive 참조 없음, 범위 밖 항목 미구현)
- B. 아키텍처: ✅ 부분 (컴포넌트→api 레이어 경유, Zod 검증, path alias, no `any`, 1파일 1 named export, kebab-case, cleanup 존재)
- C. 코드 품질: 부분 (아래 실패 항목 참조)
- D. 보안: ✅ (하드코딩 시크릿 없음, VITE_* 사용, Zod 입력 검증)

## 실패 항목

### 1. clearCanvasData — 테이블명 불일치 (데이터 삭제 무효화 위험)

- 위치: `src/lib/api/drawings.ts:47-49`
- 문제: spec(및 기존 DB)에서는 `graffiti_images`, `graffiti_text` 테이블명을 사용하는데, 코드에서는 `images`, `texts`로 호출한다. Supabase는 존재하지 않는 테이블에 대한 쿼리를 에러 없이 빈 응답으로 처리할 수 있으며, 이 경우 임시 캔버스 데이터가 영구 잔존한다. 또한 에러가 발생해도 `Promise.all`에서 결과를 무시(`.catch` 없음)하므로 실패가 조용히 삼켜진다.
- 어떻게 고쳐야 하나: 테이블명을 실제 DB 스키마와 일치하도록 수정하고, 각 삭제 쿼리의 `error`를 확인해 실패 시 로깅하거나 상위로 throw 한다.
  ```ts
  const [r1, r2, r3] = await Promise.all([
    supabase.from('strokes').delete().neq('id', '00000000-...'),
    supabase.from('graffiti_images').delete().neq('id', '00000000-...'),
    supabase.from('graffiti_text').delete().neq('id', '00000000-...'),
  ]);
  if (r1.error || r2.error || r3.error) throw new Error('캔버스 데이터 삭제 실패');
  ```
- 심각도: **blocker** (AC6의 "(4) 캔버스 및 테이블 초기화" 단계가 실질적으로 동작하지 않을 수 있음)

### 2. ESC 핸들러의 stale closure (handleClose 참조 누락)

- 위치: `src/components/gallery/CanvasModal.tsx:44-51`
- 문제: `handleClose` 함수가 의존하는 `getCtx`, `CANVAS_SIZE`, `onClose`는 렌더마다 재생성되지만, ESC keydown 핸들러는 `isOpen`만 deps로 등록되어 있다. `// eslint-disable-line react-hooks/exhaustive-deps` 주석으로 경고를 억제했으나, `onClose` prop이 변경되는 경우(부모 리렌더) 오래된 클로저를 사용하게 된다. 실용적으로는 현재 코드 구조에서 큰 문제가 아닐 수 있으나, 원칙 위반이다.
- 어떻게 고쳐야 하나: `handleClose`를 `useCallback`으로 감싸고 deps를 정확히 선언하거나, `useRef`로 최신 함수를 보관해 항상 최신값을 참조하도록 한다.
- 심각도: **major**

### 3. GalleryCard — Realtime UPDATE 시 로컬 pos 상태 미반영

- 위치: `src/components/gallery/GalleryCard.tsx:14`
- 문제: `pos` 상태의 초기값은 `drawing.x, drawing.y`이지만, `useEffect`나 `useMemo` 없이 초기화만 한다. GalleryBoard에서 Realtime UPDATE를 받아 `drawings` 배열이 갱신되어도, `GalleryCard`는 이미 마운트된 상태이므로 `useState` 초기값은 다시 적용되지 않는다. 즉, 다른 클라이언트가 위치를 변경해도 현재 사용자 화면의 카드 위치가 갱신되지 않는다 (AC10 미충족).
- 어떻게 고쳐야 하나:
  ```ts
  useEffect(() => {
    setPos({ x: drawing.x, y: drawing.y });
  }, [drawing.x, drawing.y]);
  ```
- 심각도: **blocker** (AC10 "Realtime UPDATE 이벤트 수신 시 카드 위치 갱신" 직접 미충족)

### 4. onDrawingAdded 콜백 중복 닫기

- 위치: `src/routes/index.tsx:29-33`
- 문제: `CanvasModal`의 `onClose`와 `onDrawingAdded` 모두 `() => setIsCanvasOpen(false)`로 설정되어 있다. `handleConfirm` 내부에서 `onDrawingAdded()` 후 `onClose()`를 순서대로 호출하므로 `setIsCanvasOpen(false)`가 두 번 실행된다. React batching으로 실질적 문제는 없지만, `onDrawingAdded`의 존재 의미가 없어져 혼란을 야기한다.
- 어떻게 고쳐야 하나: `handleConfirm`에서 `onDrawingAdded` 호출을 제거하거나, index.tsx에서 `onDrawingAdded`를 실제로 필요한 후속 처리(예: 토스트, 리프레시)에만 사용한다.
- 심각도: **minor**

### 5. 접근성 — GalleryCard에 role/aria 없음

- 위치: `src/components/gallery/GalleryCard.tsx:60-84`
- 문제: 드래그 + 클릭이 가능한 카드가 순수 `<div>` + pointer 이벤트로만 구현되어 있다. 키보드 사용자나 스크린 리더는 카드를 클릭하거나 드래그할 수 없다.
- 어떻게 고쳐야 하나: `role="button"`, `tabIndex={0}`, `onKeyDown` (Enter/Space → onClick) 추가. 드래그는 별도 키보드 단축키 지원이 어렵다면 Out of Scope으로 명시한다.
- 심각도: **minor**

## 권고 (선택)

- `clearCanvasData`의 `neq('id', '00000000-...')` 패턴은 devlog에서 스스로 미해결로 표시한 항목이다. Supabase JS v2에서는 `.delete().gt('created_at', '1970-01-01')` 또는 `.delete().is('id', 'not.null')` 패턴이 더 안정적이다.
- `CanvasModal`의 `CANVAS_SIZE`와 `isMobile`이 렌더 시점 `window.innerWidth`를 직접 읽어 반응형 리사이즈를 지원하지 않는다. 현재 spec 범위 밖이나, 추후 `ResizeObserver` 또는 `window.resize` 이벤트 연동이 권장된다.
- `GalleryBoard`의 초기 로드 에러가 `console.error`로만 처리된다. 사용자에게 토스트 등으로 알리는 것이 UX상 바람직하다.

---

Verdict: FAIL
