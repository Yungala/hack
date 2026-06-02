# E2E Test — iter 2

> Verdict: FAIL
> Tested by: e2e-tester subagent
> Date: 2026-06-02
> Browser: Chrome DevTools MCP (Chromium)

## 전제 조건
- needsE2E: true
- preview 서버: http://localhost:4173 (PID 62468) ✅ ready
- 빌드: ✅ (`vite build && tsc -b --noEmit` 성공, 1.52s)

## 시나리오 결과
| ID | 시나리오 (요약) | 매핑 AC | 결과 |
|----|----------------|---------|------|
| E2E1 | "+ 그림 추가" 클릭 → 획 긋기 → 완료 → 모달 닫힘 + 갤러리 카드 | AC3, AC6 | ❌ |
| E2E2 | 카드 드래그 → drawings 테이블 x,y 업데이트 | AC9 | ✅ |
| E2E3 | X 버튼/ESC → 모달 닫힘 + drawings 테이블 미변경 | AC7, AC8 | ✅ |
| E2E4 | 카드 클릭 → CardViewer 모달 열림 + 이미지 표시 + 닫기 | AC12 | ✅ |

## 실패 상세

### E2E1 — "+ 그림 추가" 클릭 → 완료 → 갤러리 카드

- 매핑 AC: AC3, AC6
- 실패 단계: THEN 4번째 — "갤러리에 새 카드가 추가된다"
- 관찰된 동작:
  - CanvasModal 열림 ✅
  - 캔버스 600×600 확인, PointerEvent로 획 그리기 시뮬레이션 ✅
  - 완료 버튼 클릭 후 모달이 DOM 기준으로는 닫힘 (`role="dialog"` 없어짐) ✅
  - Storage 업로드 성공, drawings 테이블에 레코드 insert 성공 ✅
    - `{"id":"9a33a0bd-43bf-484d-b3af-d7847d9db492","image_url":"https://...","x":960,"y":456}`
  - 그러나 동일 세션에서 갤러리에 카드가 즉시 렌더링되지 않음 ❌
    - `div.relative.w-full.h-full` 내부가 비어 있음 (img 요소 없음)
    - 페이지 리로드 후에는 카드 정상 표시됨 → DB 데이터 자체는 정상
  - 추가 관찰: a11y 트리에 완료 버튼 등 모달 UI 요소가 잠시 잔류 (stale snapshot)
- 콘솔 로그: 없음 (error/warn 0건)
- 스크린샷: `docs/specs/gallery-board/screenshots/e2e1-iter2-fail.png`
- 추정 원인: Supabase Realtime 채널이 동일 클라이언트에서 발생한 INSERT 이벤트를 수신하지 못하거나, `gallery` 채널 구독 설정에서 자기 자신의 INSERT를 필터링하고 있는 것으로 보임. GalleryBoard 컴포넌트의 Realtime 구독 핸들러 혹은 초기 상태 업데이트 로직 (`useEffect` / Zustand store)을 확인해야 함.

## 시나리오 상세 — PASS

### E2E2 — 카드 드래그 → DB x,y 업데이트
- 드래그 전 DB: `x=960, y=456`
- PointerEvent (pointerdown → pointermove×5 → pointerup) 시뮬레이션
- 드래그 후 DB: `x=1010, y=506` (각 +50 변경 확인)
- AC9 충족

### E2E3 — X 버튼/ESC → 모달 닫힘 + DB 미변경
- X(닫기) 버튼 클릭 후 모달 즉시 닫힘, drawings 카운트 1개 유지 ✅
- ESC 키 입력 후 모달 즉시 닫힘, drawings 카운트 1개 유지 ✅
- AC7, AC8 충족

### E2E4 — CardViewer 모달 열림 + 이미지 표시 + 닫기
- 갤러리 카드(img[alt="그림 카드"]) 클릭 → CardViewer 모달 열림 ✅
- `image "갤러리 그림"` 요소 표시 확인 (동일 Storage URL) ✅
- 닫기 버튼 클릭 → 모달 닫힘 ✅
- AC12 충족

## 콘솔 / 네트워크 이슈
- console errors: 0건
- console warnings: 0건

## 권고
- **Realtime 자기 INSERT 반영 수정**: 완료 버튼 클릭 후 Supabase Realtime INSERT 이벤트를 기다리지 않고, 완료 콜백에서 직접 `setDrawings(prev => [...prev, newDrawing])` 형태로 낙관적 업데이트(optimistic update)를 적용하면 이 문제를 해결할 수 있음.
- **향후 추가 시나리오 제안**:
  - E2E5: 두 번째 완료 버튼 클릭 후 5초 이내 카드 표시 여부 (타임아웃 검증)
  - E2E6: Storage 업로드 실패 시 에러 토스트 표시 (AC13)
  - E2E7: 외부 클릭으로 CardViewer 닫기 (AC12 추가 검증)

Verdict: FAIL
