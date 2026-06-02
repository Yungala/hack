# Devlog — iter 1

> Slug: local-canvas
> Date: 2026-06-02

## 이 iteration의 의도
GraffitiCanvas의 DB/Realtime 의존성을 제거하고, 로컬 메모리 기반으로 동작하는 LocalCanvas를 만들어 CanvasModal에 통합했다. 완료 시 `getBlob()`으로 PNG를 export해 기존 업로드 흐름에 연결했다.

## 변경 파일
- `src/components/gallery/LocalCanvas.tsx` — 신규. `forwardRef<LocalCanvasHandle>` 기반 로컬 캔버스
- `src/components/gallery/CanvasModal.tsx` — 수정. 단순 캔버스 구현 제거, LocalCanvas + DrawingToolbar 통합
- `src/components/graffiti/DrawingToolbar.tsx` — 수정. `onImageSelected` prop을 optional로 변경

## 결정 요지
1. 획은 `useRef<LocalStroke[]>`에 저장하고 pointermove 시 incremental draw(마지막 두 점만 그리기)로 성능을 유지했다. Eraser는 `destination-out` compositeOperation으로 처리.
2. 이미지/텍스트 배치는 기존 `TransformOverlay`를 그대로 재사용했다. `onConfirm`이 `File`을 돌려주므로 Blob → ObjectURL → preload → canvas 렌더 흐름으로 연결했다.
3. `DrawingToolbar`는 `fixed` 포지션이라 모달 내부에 렌더해도 화면 하단에 고정된다. 모달과 툴바의 z-index 충돌을 피하기 위해 모달을 `z-50`, 툴바를 `z-40`으로 유지했다.

## 자가 점검 결과
- `pnpm typecheck`: ✅
- `pnpm lint`: ✅ (기존 warning 1개, 내 변경과 무관)

## 미해결 / 향후 작업
- DrawingToolbar의 `fixed bottom-6` 포지션이 모달 오버레이 위에 렌더되므로, 모달이 닫혀 있을 때도 툴바가 보일 수 있다. CanvasModal이 `isOpen` 조건부 렌더이므로 모달 닫히면 툴바도 사라져 문제없다.
- 모바일에서 캔버스 비율이 정사각형으로 fallback되는데, 16:9 논리 해상도(1280×720)와 aspect-ratio가 불일치할 수 있다. 스펙 요구사항("정사각형, 모바일")에 맞춰 구현했으나 논리 해상도 조정이 필요할 수 있다.
