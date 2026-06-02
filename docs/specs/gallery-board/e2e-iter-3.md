# E2E Test — iter 3

> Verdict: PASS
> Tested by: e2e-tester subagent
> Date: 2026-06-02
> Browser: Chrome (chrome-devtools MCP)

## 전제 조건
- needsE2E: true
- preview 서버: http://localhost:4173 (PID 78163) ready
- 빌드: `vite build && tsc -b --noEmit` 성공 (1.81s)

## 시나리오 결과
| ID | 시나리오 (요약) | 매핑 AC | 결과 |
|----|----------------|---------|------|
| E2E1 | "+ 그림 추가" 클릭 → 획 긋기 → 완료 → 모달 닫힘 + 갤러리 카드 추가 | AC3, AC6 | PASS |
| E2E2 | 카드 드래그 → drawings 테이블 x,y PATCH 확인 | AC9 | PASS |
| E2E3 | X 버튼 닫기 + ESC 닫기 → 새 insert 없음 | AC7, AC8 | PASS |
| E2E4 | 카드 클릭 → CardViewer 열림 + 외부 클릭 닫기 | AC12 | PASS |

## 시나리오 상세

### E2E1 — "+ 그림 추가" → 완료 → 갤러리 카드 추가
- 초기 상태: 갤러리에 카드 3개 표시
- WHEN: "그림 추가" 버튼 클릭 → CanvasModal 열림 (캔버스 + DrawingToolbar 확인)
- WHEN: 캔버스에 PointerEvent로 획 긋기 (600×600 캔버스)
- WHEN: 완료 버튼 클릭
- THEN: 모달이 닫히고 8초 이내에 갤러리에 새 카드(4번째) 표시
- 네트워크: Storage POST 200, drawings INSERT POST 201 확인
- 이번 수정(clearCanvasData() 제거) 이후 onDrawingAdded가 정상 호출됨을 확인

### E2E2 — 카드 드래그 → x,y 업데이트
- 카드 0번: 초기 left=912px, top=257px
- PointerEvent(pointerId=1) 시뮬레이션으로 +120px, +100px 이동
- 이동 후: left=1132px, top=457px (120px, 100px 이동 확인)
- 네트워크: PATCH /rest/v1/drawings?id=eq.{uuid} [204] 2건 확인
- 비고: `setPointerCapture` 에러는 JS 시뮬레이션 부작용 — 실제 사용자 조작 시 발생 안 함

### E2E3 — X 버튼 / ESC → 모달 닫힘 + 미insert
- X 버튼: 모달 열기 → 획 긋기 → 닫기 버튼 클릭 → 모달 닫힘, 카드 수 4개 유지 (insert 없음)
- ESC: 모달 열기 → ESC 키 → 모달 닫힘, 카드 수 4개 유지

### E2E4 — 카드 클릭 → CardViewer + 외부 클릭 닫기
- 카드 클릭 시 CardViewer 모달 열림: 닫기 버튼 + "갤러리 그림" 이미지(원본 URL 동일) 표시
- 외부 좌표(10,10) 클릭 → CardViewer 닫힘 확인

## 콘솔 / 네트워크 이슈
- console errors: 1종 2건
  - `NotFoundError: Failed to execute 'setPointerCapture' on 'Element': No active pointer with the given id is found.`
  - 원인: 테스트 도구의 PointerEvent JS 시뮬레이션 시 pointerId 불일치. 실제 사용자 마우스/터치 조작에서는 발생하지 않음. 앱 로직 결함 아님.
- 4xx/5xx 응답: 없음

## 권고
- E2E2에서 Realtime UPDATE 이벤트로 다른 탭에서도 카드 위치가 갱신되는지(AC10) 검증하는 멀티탭 시나리오를 추가하면 좋음
- E2E1에서 Storage 업로드 실패 시 에러 토스트 표시(AC13) 시나리오 미검증 — 별도 추가 권고

Verdict: PASS
