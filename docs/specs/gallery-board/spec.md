# 갤러리 보드

> Status: draft
> Slug: gallery-board
> Created: 2026-06-02

## 1. 목표 (Why)

기존 공유 그라피티 캔버스를 "갤러리 보드"로 전면 재구성한다. 사용자가 그린 그림을 카드 형태로 자유롭게 배치하고 실시간으로 공유할 수 있는 협업 갤러리 공간을 제공한다. Zone 개념과 기록 페이지를 제거해 앱 구조를 단순화한다.

## 2. 사용자 스토리

- As a 방문자, I want 갤러리 보드에서 다른 사람의 그림 카드를 보고 싶다, so that 공유된 창작물을 감상할 수 있다.
- As a 방문자, I want 새 그림을 그려 갤러리에 추가하고 싶다, so that 나의 작품을 공유할 수 있다.
- As a 방문자, I want 카드를 드래그해 위치를 바꾸고 싶다, so that 보드를 자유롭게 구성할 수 있다.
- As a 방문자, I want 카드를 클릭해 크게 보고 싶다, so that 그림 상세를 확인할 수 있다.

## 3. 기능 요구사항 (What)

### 갤러리 보드 (메인 페이지)
- 배경은 흰 화면 전체.
- 중앙에 흐릿한(opacity 낮음) 고정 텍스트 "당신의 그림을 추가하세요" 표시.
- `drawings` 테이블에서 모든 카드를 로드해 저장된 `(x, y)` 좌표에 자유 배치.
- 카드 드래그로 위치 이동 → 드래그 종료 시 `drawings` 테이블의 `x, y` 업데이트.
- Supabase Realtime 구독: `drawings` INSERT 시 새 카드 즉시 추가, UPDATE 시 카드 위치 반영.
- 카드 클릭 시 CardViewer 모달(확대 뷰어) 열림.
- 하단 중앙에 "+ 그림 추가" 버튼 고정 (z-index 최상단).
- 헤더의 "기록" 링크 제거.

### 캔버스 모달
- "+ 그림 추가" 버튼 클릭 시 CanvasModal 오픈.
- 기존 `GraffitiCanvas` + `DrawingToolbar` 컴포넌트를 모달 내부에 재사용.
- 데스크탑(≥768px): 최대 너비 1280px, 화면 높이 90%.
- 모바일(<768px): 캔버스를 정사각형으로 표시 (너비 = 높이 = 화면 너비).
- 좌측 하단에 기존 고양이 캐릭터 SVG 표시.
- **완료 버튼** 동작 순서:
  1. 캔버스를 PNG 이미지로 export.
  2. Supabase Storage `drawings` 버킷에 업로드, 공개 URL 획득.
  3. `drawings` 테이블에 `{ image_url, x, y }` insert (초기 위치는 화면 중앙).
  4. 캔버스 및 `strokes`, `graffiti_images`, `graffiti_text` 테이블 초기화.
  5. 모달 닫기.
- **닫기(X) 버튼**: 그린 내용 버리고 모달 즉시 닫기 (로컬 캔버스 상태만 초기화, DB 기록 없음).

### 카드 뷰어 모달
- 선택한 카드의 이미지를 모달로 확대 표시.
- 모달 외부 클릭 또는 닫기 버튼으로 닫힘.

### 제거 대상
- `src/routes/archive.tsx`
- `src/components/graffiti/ZoneSelector.tsx`
- `src/components/graffiti/SkyView.tsx`
- 헤더 "기록" 링크
- Zone 관련 UI 및 `zone_id` 참조 전체

## 4. 비기능 요구사항

- **성능**: 갤러리 초기 로드 시 카드 목록 표시까지 2초 이내.
- **실시간**: Realtime 이벤트 수신 후 카드 추가/위치 변경 반영까지 1초 이내.
- **이미지 업로드**: 완료 버튼 클릭 후 갤러리에 새 카드 등장까지 5초 이내.
- **에러 처리**: Storage 업로드 실패 시 토스트 메시지로 오류 안내, 모달 유지.
- **접근성**: 모달은 ESC 키로 닫힐 수 있어야 함.
- **보안**: Supabase Storage 버킷은 공개 읽기, 인증 없이 업로드 허용 (현재 앱 정책 유지).

## 5. UI 스케치

### 화면 흐름

```
갤러리 보드 (index.tsx)
  ├─ [카드 클릭] → CardViewer 모달 (확대 이미지)
  └─ [+ 그림 추가 클릭] → CanvasModal
        ├─ [완료] → Storage 업로드 → drawings insert → 갤러리 카드 추가 → 모달 닫기
        └─ [X 닫기] → 로컬 초기화 → 모달 닫기
```

### 주요 컴포넌트

| 컴포넌트 | 위치 | 역할 |
|---|---|---|
| `GalleryBoard` | `src/components/gallery/` | 카드 자유 배치, 드래그, Realtime |
| `GalleryCard` | `src/components/gallery/` | 개별 그림 카드 |
| `CanvasModal` | `src/components/gallery/` | 그리기 모달 (기존 캔버스 재사용) |
| `CardViewer` | `src/components/gallery/` | 확대 뷰어 모달 |

### shadcn 컴포넌트 후보

- `Dialog` — CanvasModal, CardViewer
- `Button` — "+ 그림 추가", 완료, 닫기

### 디자인 토큰 노트

- 배경: `#FFFFFF`
- 플레이스홀더 텍스트: `opacity: 0.15`, 폰트 크기 `1.5rem`, 중앙 고정
- "+ 그림 추가" 버튼: 기존 디자인 토큰 유지, `position: fixed; bottom: 24px; left: 50%; transform: translateX(-50%)`

## 6. 데이터 모델 / API

### drawings 테이블 (신규)

```
id          uuid        PK, default gen_random_uuid()
image_url   text        NOT NULL (Supabase Storage public URL)
x           float8      NOT NULL (갤러리 내 px 좌표)
y           float8      NOT NULL (갤러리 내 px 좌표)
created_at  timestamptz NOT NULL, default now()
```

### Zod 스키마 초안

```ts
const DrawingSchema = z.object({
  id: z.string().uuid(),
  image_url: z.string().url(),
  x: z.number(),
  y: z.number(),
  created_at: z.string(),
});

const DrawingInsertSchema = DrawingSchema.pick({ image_url: true, x: true, y: true });
const DrawingUpdateSchema = DrawingSchema.pick({ x: true, y: true });
```

### supabase.ts 추가 타입

```ts
interface Drawing {
  id: string;
  image_url: string;
  x: number;
  y: number;
  created_at: string;
}

interface DrawingInsert {
  image_url: string;
  x: number;
  y: number;
}
```

### 클라이언트 상태 vs 서버 상태

- **서버 상태**: `drawings` 테이블 (Supabase, Realtime 구독)
- **클라이언트 상태**: 캔버스 그리기 도구 상태 (`drawing-store.ts` 기존 유지), 모달 열림/닫힘 여부
- 기존 `strokes`, `graffiti_images`, `graffiti_text`는 캔버스 임시 상태로만 사용; 완료 시 전체 삭제

### Supabase Realtime 채널

- 채널명: `gallery`
- 이벤트: `drawings` 테이블 `INSERT` → 카드 추가, `UPDATE` → 카드 위치 갱신

## 7. 수용 기준 (Acceptance Criteria)

- **AC1**: GIVEN 앱에 접속했을 때 WHEN 갤러리 보드 페이지가 로드되면 THEN `drawings` 테이블의 모든 카드가 저장된 `(x, y)` 좌표에 배치되어 표시된다.
- **AC2**: GIVEN 갤러리 보드에 카드가 없을 때 WHEN 페이지가 로드되면 THEN 화면 중앙에 "당신의 그림을 추가하세요" 플레이스홀더 텍스트가 표시된다.
- **AC3**: GIVEN 갤러리 보드에서 WHEN "+ 그림 추가" 버튼을 클릭하면 THEN CanvasModal이 열리고 그리기 도구(캔버스 + DrawingToolbar)가 표시된다.
- **AC4**: GIVEN CanvasModal이 열려 있을 때 WHEN 데스크탑(≥768px)에서 THEN 모달 너비는 최대 1280px이고 높이는 화면 높이의 90%이다.
- **AC5**: GIVEN CanvasModal이 열려 있을 때 WHEN 모바일(<768px)에서 THEN 캔버스는 정사각형(너비=높이=화면 너비)으로 표시된다.
- **AC6**: GIVEN CanvasModal에서 그림을 그린 후 WHEN 완료 버튼을 클릭하면 THEN (1) 캔버스가 PNG로 export되고 (2) Storage에 업로드되고 (3) `drawings` 테이블에 insert되고 (4) 갤러리에 새 카드가 추가되고 (5) 모달이 닫힌다. 전체 흐름이 5초 이내에 완료된다.
- **AC7**: GIVEN CanvasModal이 열려 있을 때 WHEN X(닫기) 버튼을 클릭하면 THEN DB 기록 없이 모달이 닫히고 캔버스 내용이 초기화된다.
- **AC8**: GIVEN CanvasModal이 열려 있을 때 WHEN ESC 키를 누르면 THEN AC7과 동일하게 모달이 닫힌다.
- **AC9**: GIVEN 갤러리 보드에서 카드를 드래그할 때 WHEN 드래그를 종료하면 THEN `drawings` 테이블의 해당 레코드 `x, y`가 새 위치로 업데이트된다.
- **AC10**: GIVEN 다른 사용자가 카드 위치를 변경했을 때 WHEN Realtime UPDATE 이벤트가 수신되면 THEN 1초 이내에 내 화면의 카드 위치가 갱신된다.
- **AC11**: GIVEN 다른 사용자가 새 그림을 추가했을 때 WHEN Realtime INSERT 이벤트가 수신되면 THEN 1초 이내에 내 갤러리에 새 카드가 나타난다.
- **AC12**: GIVEN 갤러리 카드를 클릭했을 때 WHEN CardViewer 모달이 열리면 THEN 해당 카드의 이미지가 확대 표시되고, 모달 외부 클릭 또는 닫기 버튼으로 닫힌다.
- **AC13**: GIVEN Storage 업로드가 실패했을 때 WHEN 완료 버튼을 눌렀을 때 THEN 에러 토스트 메시지가 표시되고 모달은 닫히지 않는다.
- **AC14**: GIVEN 앱에 접속했을 때 WHEN 헤더를 확인하면 THEN "기록" 링크가 존재하지 않는다.

## 8. 범위 밖 (Out of Scope)

- 사용자 인증 / 본인 그림만 이동 제한
- 카드 삭제 기능
- 카드 순서/레이어 조정
- 갤러리 보드 스크롤 / 무한 캔버스 (현재는 뷰포트 내 고정)
- `archive.tsx` 데이터 마이그레이션 (기록 데이터 보존 없이 제거)
- 드래그 충돌 해결 (두 사용자가 동시에 같은 카드를 드래그하는 경우 last-write-wins)

## 9. 가정 (Assumptions)

- Supabase Storage에 `drawings` 버킷이 이미 존재하거나 마이그레이션에서 생성한다고 가정.
- 현재 앱은 익명 사용 구조이므로 업로드 권한은 인증 없이 허용한다고 가정 (RLS 정책은 기존과 동일하게 공개 읽기/쓰기).
- 카드 초기 배치 좌표(`x, y`)는 화면 중앙 기준으로 결정한다고 가정 (서버 측에서 뷰포트 크기를 모르므로 클라이언트가 insert 시 현재 뷰포트 중앙값을 전송).
- 기존 `strokes`, `graffiti_images`, `graffiti_text` 테이블은 삭제하지 않고 계속 임시 캔버스 상태로 사용하며, 완료/닫기 시 해당 테이블의 모든 레코드를 삭제한다고 가정.
- `GraffitiCanvas`와 `DrawingToolbar`는 코드 수정 없이 CanvasModal 내부에 임베드 가능하다고 가정. 필요 시 경미한 props 추가는 허용.
- Zone 개념 제거 시 `drawing-store.ts`의 `zone_id` 관련 상태가 있다면 함께 정리한다.

## 10. E2E 검증 필요 여부

- **needsE2E**: `true`

E2E 시나리오 (다단계 사용자 플로우, 핵심 비즈니스 가치):

- **E2E1** (AC3, AC6 검증): GIVEN 갤러리 보드가 열려 있을 때 WHEN "+ 그림 추가" 버튼 클릭 → 캔버스에 한 획 긋기 → 완료 버튼 클릭 THEN 모달이 닫히고 갤러리에 새 카드가 표시된다.
- **E2E2** (AC9, AC10 검증): GIVEN 갤러리에 카드가 1개 이상 있을 때 WHEN 카드를 드래그해 위치를 변경하면 THEN `drawings` 테이블의 `x, y`가 새 값으로 업데이트된다.
- **E2E3** (AC7, AC8 검증): GIVEN CanvasModal이 열려 있고 그림이 그려진 상태에서 WHEN X 버튼 또는 ESC 키를 누르면 THEN 모달이 닫히고 `drawings` 테이블에 새 레코드가 insert되지 않는다.
- **E2E4** (AC12 검증): GIVEN 갤러리에 카드가 있을 때 WHEN 카드를 클릭하면 THEN CardViewer 모달이 열리고 이미지가 표시되며, 외부 클릭 시 모달이 닫힌다.
