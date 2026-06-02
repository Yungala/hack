# Test — iter 1

> Verdict: PASS
> Tested by: tester subagent
> Date: 2026-06-02

## 명령 실행 결과

- `pnpm typecheck`: ✅
- `pnpm lint`: ✅ (경고 1개 — `src/components/ui/button.tsx` react-refresh 경고, 이번 작업과 무관. error 없음)
- `pnpm test:run`: ✅ 37 passed, 0 failed, 1 skipped

## 수용 기준 ↔ 테스트 매핑

- AC1 ↔ `src/components/gallery/GalleryBoard.test.tsx :: "drawings 테이블에서 로드한 카드를 모두 표시한다"` ✅
       ↔ `src/components/gallery/GalleryCard.test.tsx :: "저장된 x, y 좌표로 카드가 렌더링된다"` ✅
- AC2 ↔ `src/components/gallery/GalleryBoard.test.tsx :: "카드가 없을 때 '당신의 그림을 추가하세요' 텍스트가 표시된다"` ✅
- AC3 ↔ `src/components/gallery/CanvasModal.test.tsx :: "isOpen=true 이면 캔버스와 완료 버튼이 표시된다"` ✅
- AC4 ↔ 자동 테스트 불가 (CSS 미디어쿼리/스타일 검증은 E2E 또는 시각적 검증 필요)
- AC5 ↔ 자동 테스트 불가 (window.innerWidth 의존 레이아웃, jsdom 환경 한계)
- AC6 ↔ `src/components/gallery/CanvasModal.test.tsx :: "완료 버튼 클릭 시 upload → insert → clearCanvasData → onClose 순서로 호출된다"` ✅
       ↔ `src/lib/api/drawings.test.ts :: "Storage 업로드 성공 시 publicUrl을 반환한다"` ✅
       ↔ `src/lib/api/drawings.test.ts :: "insert 후 Drawing을 반환한다"` ✅
       ↔ `src/lib/api/drawings.test.ts :: "strokes, images, texts 테이블을 모두 삭제한다"` ✅
- AC7 ↔ `src/components/gallery/CanvasModal.test.tsx :: "닫기(X) 버튼 클릭 시 onClose가 호출된다"` ✅
- AC8 ↔ `src/components/gallery/CanvasModal.test.tsx :: "ESC 키를 누르면 onClose가 호출된다"` ✅
       ↔ `src/components/gallery/CardViewer.test.tsx :: "ESC 키 누르면 onClose가 호출된다"` ✅
- AC9 ↔ 단위 테스트 스킵 (jsdom PointerEvent.clientX 전달 한계) → E2E2로 위임
       ↔ `src/lib/api/drawings.test.ts :: "x, y 좌표를 업데이트한다"` (API 레이어 단위 ✅)
- AC10 ↔ `src/components/gallery/GalleryBoard.test.tsx :: "컴포넌트 마운트 시 Realtime gallery 채널을 구독한다"` ✅
- AC11 ↔ AC10과 동일 채널 구독 확인 ✅ (INSERT/UPDATE 핸들러 실제 동작은 Realtime 환경 의존 → E2E에서 검증 필요)
- AC12 ↔ `src/components/gallery/CardViewer.test.tsx :: "카드 이미지가 확대 표시된다"` ✅
        ↔ `src/components/gallery/CardViewer.test.tsx :: "닫기 버튼 클릭 시 onClose가 호출된다"` ✅
        ↔ `src/components/gallery/CardViewer.test.tsx :: "모달 외부(배경) 클릭 시 onClose가 호출된다"` ✅
        ↔ `src/components/gallery/GalleryCard.test.tsx :: "드래그 없이 클릭하면 onClick이 호출된다"` ✅
- AC13 ↔ `src/components/gallery/CanvasModal.test.tsx :: "Storage 업로드 실패 시 toast.error가 호출되고 모달이 닫히지 않는다"` ✅
- AC14 ↔ 자동 테스트 불가 (헤더 컴포넌트 렌더링은 라우터 통합 테스트 필요, 시각적 검증 권고)

## 작성한 테스트 파일

- `src/lib/schemas/drawing.test.ts` (신규)
- `src/lib/api/drawings.test.ts` (신규)
- `src/components/gallery/GalleryCard.test.tsx` (신규)
- `src/components/gallery/GalleryBoard.test.tsx` (신규)
- `src/components/gallery/CardViewer.test.tsx` (신규)
- `src/components/gallery/CanvasModal.test.tsx` (신규)

※ `vitest.config.ts`에 `resolve.alias` 설정 추가 (기존 `@/` 경로가 vitest에서 해석되지 않아 모든 테스트가 실행 불가한 문제 수정, 테스트 인프라 설정).

## 실패 상세

없음. 모든 테스트 PASS (1개 skip).

## 커버리지 / 권고

### 스킵된 테스트 (E2E 위임)

- **AC9 드래그 테스트**: jsdom 환경에서 `fireEvent.pointerMove`로 전달한 `clientX` 값이 컴포넌트의 React 이벤트 핸들러에서 0으로 읽히는 한계가 있다. `PointerEvent` 생성자는 jsdom에 미구현(`PointerEvent is not defined`). E2E2 시나리오로 대체 검증 필요.

### 자동 테스트 불가 항목 (시각적/E2E 검증 필요)

- **AC4** (데스크탑 모달 크기): `maxWidth: 1280px`, `maxHeight: 90vh` CSS 스타일 검증은 브라우저 실측 필요.
- **AC5** (모바일 캔버스 정사각형): `window.innerWidth < 768` 조건 분기 검증은 jsdom에서 `window.innerWidth = 0`으로 고정됨.
- **AC10, AC11** (Realtime 1초 이내 반영): 실제 Supabase Realtime 연결 필요, 타이밍 SLA는 E2E에서 검증.
- **AC14** (헤더 "기록" 링크 제거): TanStack Router 통합 렌더링 필요, E2E4 수준의 시나리오 권고.
