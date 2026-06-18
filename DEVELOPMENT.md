# 개발 가이드 / 프로젝트 정리 (DEVELOPMENT.md)

> 이 문서는 프로젝트를 이어서 개발할 때 "어디에 뭐가 있고, 어떻게 흐르는지" 한눈에 보기 위한 정리본이다.
> **실행은 Docker Compose 전용.** 빠른 시작은 [`README.md`](./README.md) 참고.

---

## 0. Docker 개발 환경 (필수)

### 구성
```
docker-compose.yml
├── mysql   (MySQL 8.4, 포트 3306, 볼륨 mysql_data)
└── app     (Node 24 + pnpm, 포트 3000, 소스 볼륨 마운트)
```

### 파일
| 파일 | 역할 |
|------|------|
| `Dockerfile` | app 이미지 (Node 24, pnpm install) |
| `docker-compose.yml` | mysql + app 오케스트레이션 |
| `docker/entrypoint.sh` | MySQL 대기 → migrate → 앱 실행 |
| `.dockerignore` | 빌드 컨텍스트 제외 목록 |
| `.env.example` | 환경변수 템플릿 |

### 일반적인 개발 흐름
```powershell
# 최초 / 의존성 변경 후
docker compose up -d --build

# 로그 확인
docker compose logs -f app

# 컨테이너 셸
docker compose exec app sh

# 테스트
docker compose exec app pnpm test

# DB 스키마 변경 후
# 1. drizzle/schema.ts 수정
# 2. 호스트 또는 컨테이너에서:
docker compose exec app pnpm db:push

# 전체 초기화 (DB 데이터 삭제)
docker compose down -v && docker compose up -d --build
```

### 환경변수 (Docker)
| 변수 | 기본값 | 설명 |
|------|--------|------|
| `DATABASE_URL` | `mysql://dispatch:dispatch_dev@mysql:3306/dispatch_system` | **컨테이너 내부** DB 접속 (호스트명 `mysql`) |
| `JWT_SECRET` | compose 기본값 | 기사 JWT 서명 키 |
| `PORT` | `3000` | 앱 포트 |
| `BUILT_IN_FORGE_API_*` | (없음) | manus 스토리지 — 없으면 사진 업로드만 실패 |

> 호스트에서 MySQL CLI로 접속할 때는 `localhost:3306`, user `dispatch`, password `dispatch_dev`.

### 볼륨
- `.:/app` — 소스 코드 실시간 반영 (tsx watch + Vite HMR)
- `app_node_modules:/app/node_modules` — Windows bind mount 성능/호환용 (node_modules는 컨테이너 전용)
- `mysql_data` — DB 영속 데이터

---

## 1. 한 문장 요약

화물/지입차 **배차 → 기사 승인 → 운행 완료 → 정산**을 관리하는 풀스택 앱.
`React 19 + Vite` 프론트, `Express + tRPC + Drizzle(MySQL)` 백엔드, 단일 포트에서 동작.
manus 플랫폼 보일러플레이트(`_core`) 위에 비즈니스 로직이 얹혀 있는 구조다.

---

## 2. 아키텍처 큰 그림

```
[브라우저]
   │  React 19 + Wouter 라우팅
   │  TanStack Query + tRPC client (superjson)
   │  /api/trpc 로 배치 호출, credentials include + Bearer 토큰 폴백
   ▼
[Express 서버]  (server/_core/index.ts 가 진입점)
   ├─ /api/trpc           → appRouter (server/routers.ts)   ← API 본체
   ├─ /api/worklog/upload → multer + S3 (작업일지 사진)
   ├─ /api/driver/upload-vehicle-photo → multer + S3 (차량 사진)
   ├─ OAuth / storage proxy 라우트 (_core)
   └─ dev: Vite 미들웨어 / prod: 정적 파일 serve
   ▼
[Drizzle ORM] → MySQL
[S3 스토리지] → 사진 저장
```

### 요청 흐름 (tRPC)
1. 클라이언트 `client/src/lib/trpc.ts` 의 `trpc` 훅으로 호출
2. `main.tsx` 의 `httpBatchLink` 가 `/api/trpc` 로 배치 전송 (superjson 직렬화)
3. 서버 `createExpressMiddleware` → `appRouter` (`server/routers.ts`)
4. 각 procedure가 `server/db.ts` 헬퍼 호출 → Drizzle → MySQL
5. `AppRouter` 타입이 클라로 그대로 추론됨 (end-to-end 타입 안전)

---

## 3. 디렉토리 상세

### 프론트엔드 `client/src/`
| 경로 | 역할 |
|------|------|
| `main.tsx` | 진입점. QueryClient, tRPC Provider, 401 시 로그인 리다이렉트, Bearer 토큰 헤더 주입 |
| `App.tsx` | 라우트 정의 (`/`, `/admin`, `/driver`, `/driver/login`, `/404`) + Provider 래핑 |
| `pages/Home.tsx` | 랜딩 (관리자/기사 역할 선택, 148줄) |
| `pages/AdminDashboard.tsx` | **관리자 화면 전체 (4151줄, 가장 큼).** 기사/배차/작업일지/정산/알림 탭 전부 여기 |
| `pages/DriverDashboard.tsx` | **기사 화면 전체 (2035줄).** 현재배차/운행이력/정산현황 탭, 작업일지 업로드 |
| `pages/DriverLogin.tsx` | 기사 로그인 (전화번호+PIN) |
| `pages/ComponentShowcase.tsx` | UI 컴포넌트 데모 (1437줄, 실서비스 무관) |
| `pages/NotFound.tsx` | 404 |
| `contexts/RoleContext.tsx` | 데모 역할(admin/driver) + driverId를 sessionStorage에 저장 |
| `contexts/ThemeContext.tsx` | 라이트/다크 테마 |
| `lib/trpc.ts` | tRPC React 클라이언트 인스턴스 |
| `lib/driverAuth.ts` | 기사 토큰 localStorage 폴백 관리 |
| `lib/design.ts` | 공통 디자인 상수 (NAV_STYLE, CARD_STYLE, 상태별 색상 config, 날짜 포맷 유틸) |
| `lib/imageResize.ts` | 업로드 전 Canvas 기반 이미지 압축 (최대 1920px, JPEG 85%) |
| `lib/utils.ts` | `cn()` 등 |
| `components/ui/` | shadcn/ui 컴포넌트 모음 (Radix 기반, 60+개) |
| `components/` | DashboardLayout, Map, AIChatBox, ErrorBoundary 등 |
| `const.ts` | 클라 전용 상수 (로그인 URL 등) |

> **주의: `AdminDashboard.tsx`(4151줄)와 `DriverDashboard.tsx`(2035줄)가 비대하다.** 모달/탭별로 컴포넌트 분리하면 유지보수 훨씬 쉬워진다. (아래 9. 기술 부채 참고)

### 백엔드 `server/`
| 경로 | 역할 |
|------|------|
| `_core/index.ts` | **서버 진입점.** Express 세팅, 사진 업로드 라우트, tRPC 미들웨어, 포트 자동 탐색 |
| `routers.ts` | **tRPC 라우터 = API 정의 본체 (725줄).** 모든 procedure가 여기 |
| `db.ts` | **DB 접근 계층 (962줄).** Drizzle 쿼리 헬퍼 전부 |
| `storage.ts` | S3 `storagePut` 등 업로드 헬퍼 |
| `_core/context.ts` | tRPC 컨텍스트 생성 (req/res/user) |
| `_core/trpc.ts` | `router`, `publicProcedure` 정의 |
| `_core/cookies.ts` | 세션 쿠키 옵션 |
| `_core/sdk.ts` | manus SDK (OAuth 요청 인증) |
| `_core/oauth.ts` | OAuth 라우트 등록 |
| `_core/storageProxy.ts` | S3 객체 프록시 서빙 |
| `_core/llm.ts` / `map.ts` / `voiceTranscription.ts` / `imageGeneration.ts` / `notification.ts` | manus 플랫폼 부가 기능 (현재 배차 로직과 직접 연관 적음) |
| `_core/vite.ts` | dev Vite 미들웨어 / prod 정적 서빙 |
| `_core/heartbeat.ts` | 헬스/하트비트 |
| `dispatch.test.ts` | 배차/정산 핵심 테스트 (894줄) |
| `auth.logout.test.ts` | 로그아웃 테스트 |

### 공용 `shared/`
- `types.ts` — `drizzle/schema` 타입 + `_core/errors` 재노출 (단일 진입점)
- `const.ts` — 쿠키명, 타임아웃, 인증 에러 메시지 등 공용 상수
- `_core/errors.ts` — 공용 에러

### DB `drizzle/`
- `schema.ts` — 테이블 정의 (아래 4장)
- `relations.ts` — 관계 정의
- `0000_*.sql ~ 0013_*.sql` — 마이그레이션 이력 (14개)
- `meta/` — Drizzle 스냅샷

---

## 4. 데이터베이스 스키마

모두 `drizzle/schema.ts`에 정의. MySQL.

### `users` — manus OAuth 사용자
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | int PK | auto |
| openId | varchar(64) unique | OAuth ID |
| name, email, loginMethod | text/varchar | |
| role | enum(user/admin) | 기본 user |
| createdAt/updatedAt/lastSignedIn | timestamp | |

### `drivers` — 기사
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | int PK | |
| name, phone | varchar | 필수 |
| vehicleNumber, vehicleType, affiliation | varchar | 차량번호/차종/소속 |
| status | enum(idle/driving/repair) | 대기중/운행중/수리중 |
| vehiclePhotoUrl, vehiclePhotoKey | varchar | 차량 사진 (URL + S3 key) |
| pinHash | varchar | bcrypt PIN (로그인용) |
| bankName, accountNumber, accountHolder | varchar | 계좌 정보 |

### `dispatch_orders` — 배차 (핵심)
| 컬럼 | 타입 | 비고 |
|------|------|------|
| id | int PK | |
| driverId | int | 기사 (FK 논리적) |
| pickupLocation, dropoffLocation | text | 출발/도착지 |
| approvalStatus | enum(pending/confirmed/completed/cancelled) | 대기→확인→완료/취소 |
| dispatchType | enum(forced/normal) | 직접배차/일반 |
| memo | text | |
| unitPrice | int | 회차 단가(원) |
| tripCount | int | 회차 수 |
| totalAmount | int | 정산금액 = unitPrice × tripCount |
| arrivalDeadline | timestamp | 도착 기한 |
| confirmedAt, completedAt | timestamp | |

### `work_logs` / `work_log_photos` — 작업일지
- `work_logs`: 배차 1건당 1개 (`dispatchOrderId`, `driverId`, `memo`)
- `work_log_photos`: 작업일지당 N장 (`workLogId`, `storageKey`, `storageUrl`, `originalName`, `mimeType`)

### `driver_payments` — 정산 지급 내역
`driverId`, `companyName`(지급업체), `amount`, `paidAt`, `memo`

### `sms_templates` — 문자 템플릿
`title`, `content`

### `app_settings` — 시스템 설정 (key-value)
`key`(PK), `value` — 예: `admin_password`

### `driver_notifications` — 관리자 → 기사 알림
`driverId`, `title`, `message`, `isRead`(0/1), `createdAt`

> ⚠️ FK 제약이 DB 레벨에 걸려있지 않고 `driverId` 등으로 논리적 연결만 되어 있다. 삭제 시 고아 레코드 주의 (예: 기사 삭제 시 그 기사 배차/작업일지 처리 로직 확인 필요).

---

## 5. API (tRPC) 전체 목록

`server/routers.ts` 의 `appRouter`. 전부 `publicProcedure` (인증은 procedure 내부에서 토큰 검증)다.

### `auth`
- `me` (query) — 현재 OAuth 유저
- `logout` (mutation) — 세션 쿠키 삭제

### `driver` — 기사 관리/인증/정산
| procedure | 종류 | 설명 |
|-----------|------|------|
| `list` | query | 전체 기사 |
| `get` | query | 기사 단건 |
| `create` | mutation | 등록 (전화/이름+차량번호 중복 체크) |
| `delete` | mutation | 삭제 |
| `updateStatus` | mutation | 상태 변경 |
| `monthlySummary` | query | 기사별 이번 달 실적 요약 |
| `login` | mutation | 전화번호+PIN 로그인 → JWT 발급(쿠키 + 응답 토큰) |
| `logout` | mutation | 기사 세션 삭제 |
| `me` | query | 로그인된 기사 정보 (pinHash 제외) |
| `updateProfile` | mutation | 본인 정보 수정 |
| `changePin` | mutation | 본인 PIN 변경 (현재 PIN 검증) |
| `adminSetPin` | mutation | 관리자: PIN 설정/초기화 |
| `adminUpdate` | mutation | 관리자: 기사 정보 수정 |
| `completedHistory` | query | 본인 완료 배차 이력 (년/월) |
| `monthlyEarnings` | query | 본인 월별 정산 합계 |
| `dispatchDayStats` | query | 기사별 이번 달 배차 일수 통계 |
| `updateBankInfo` | mutation | 계좌 정보 수정 |
| `addPayment` | mutation | 관리자: 지급 등록 |
| `payments` | query | 기사별 지급 내역 |
| `settlementSummary` | query | 관리자 정산: 기사별 총정산/지급/미지급 |
| `mySettlement` | query | 기사 본인 월별 정산 현황 |
| `mySettlementAllTime` | query | 기사 본인 누적 정산 |

### `dispatch` — 배차
| procedure | 종류 | 설명 |
|-----------|------|------|
| `listAll` | query | 전체 배차 (기사 정보 join) |
| `listByDriver` | query | 기사별 배차 |
| `create` | mutation | 단일 배차 생성 |
| `createMultiple` | mutation | 다중 기사 일괄 배차 |
| `pendingCount` | query | 기사별 미확인(pending) 건수 |
| `confirm` | mutation | 기사 승인 (pending→confirmed) |
| `update` | mutation | 배차 수정 (완료/취소 건 불가) |
| `cancel` | mutation | 취소 |
| `delete` | mutation | 삭제 |
| `complete` | mutation | 운행 완료 (회차 수 입력 → 정산금액 계산, 기사 상태 idle 복귀) |

### `settlement` — 정산 리포트
- `monthlyReport` (query) — 월별 정산 집계
- `driverDetail` (query) — 기사별 월별 배차 상세 (드릴다운)
- `filteredOrders` (query) — 날짜범위 + 기사 필터 배차 조회

### `smsTemplate` — 문자 템플릿
- `list` / `create` / `delete`

### `workLog` — 작업일지
- `listByDriver` (query) — 기사별 (사진 포함)
- `getByDispatchOrder` (query) — 배차별
- `listAll` (query) — 관리자 전체 (기사+사진)
- `deletePhoto` (mutation)

### `admin` — 관리자 설정/알림
- `verifyPassword` (mutation) — 비밀번호 확인 (기본 `admin1234`)
- `changePassword` (mutation)
- `sendNotification` (mutation) — 기사들에게 알림 발송
- `notificationHistory` (query)

### `notification` — 기사 알림 수신
- `getUnread` / `markRead` / `markAllRead`

### REST 엔드포인트 (tRPC 밖, `_core/index.ts`)
- `POST /api/worklog/upload` — multipart, 작업일지 사진 다중 업로드 → S3
- `POST /api/driver/upload-vehicle-photo` — 차량 사진 업로드 → S3

---

## 6. 인증 / 권한 구조

> ⚠️ **여기가 이 프로젝트에서 가장 주의할 부분이다.**

### 기사 인증 (전화번호 + PIN)
- 로그인 시 `bcrypt.compare(pin, pinHash)` → 통과하면 `jose`로 JWT 발급 (HS256, 30일)
- 토큰 저장: **쿠키(`driver_session_id`) + 응답 본문 토큰** 둘 다.
  프록시 환경에서 쿠키가 막히면 클라가 토큰을 localStorage에 보관(`lib/driverAuth.ts`)하고 `Authorization: Bearer` 헤더로 폴백.
- 서버는 `쿠키 → Authorization 헤더` 순으로 토큰을 찾아 검증.

### 관리자 인증 (사실상 비밀번호 게이트)
- `app_settings.admin_password` 값과 단순 평문 비교 (`input === current`). 기본값 `admin1234`.
- **해시 안 됨, 평문 비교다.** 진짜 보안이 필요하면 bcrypt + 세션/JWT로 바꿔야 함.

### ⚠️ 보안상 알아둘 점 (이어서 개발할 때 반드시 인지)
1. **모든 tRPC procedure가 `publicProcedure`다.** 즉 인증 미들웨어가 없고, 일부는 내부에서 토큰 검증을 하지만 **상당수(기사 list/create/delete, dispatch 생성/삭제, settlement 등)는 토큰 검증 없이 누구나 호출 가능**하다. 운영에 올리려면 관리자 전용 procedure에 인증 가드를 꼭 추가해야 한다.
2. 관리자 비밀번호 평문 저장/비교.
3. `JWT_SECRET` 미설정 시(`cookieSecret`가 빈 문자열) 토큰이 빈 키로 서명됨 → 반드시 `.env`에 강한 값 설정.
4. 사진 업로드는 16MB×20장 제한, 이미지 MIME만 허용 (multer fileFilter).

---

## 7. 핵심 비즈니스 흐름

### 배차 생명주기
```
pending(대기) ──기사 confirm──▶ confirmed(확인) ──기사 complete──▶ completed(완료)
     │                              │
     └────관리자 cancel────────────┴────▶ cancelled(취소)
```
- `complete` 시 `totalAmount = unitPrice × tripCount` 계산해서 저장하고, 기사 상태를 `idle`로 자동 복귀.
- `update`는 completed/cancelled 상태면 거부.

### 정산 흐름
1. 완료된 배차의 `totalAmount` 합 = 기사 총매출
2. 관리자가 `driver_payments`로 지급 등록
3. 미지급 잔액 = 총매출 − 지급액 합
4. 관리자 정산 탭 / 기사 정산 현황 탭에서 각각 조회, CSV 내보내기 지원

### 실시간성
- 별도 WebSocket 없음. **TanStack Query refetch 폴링** (배차 목록 3초, 알림 10초 등)으로 처리.

---

## 8. 개발 시 자주 하는 작업 레시피

### 새 API(procedure) 추가
1. `server/db.ts`에 DB 헬퍼 함수 작성 (Drizzle 쿼리)
2. `server/routers.ts`에서 import 후 적절한 sub-router에 procedure 추가 (Zod input 정의)
3. 클라에서 `trpc.<router>.<proc>.useQuery/useMutation`으로 호출 (타입 자동 추론)

### DB 스키마 변경
1. `drizzle/schema.ts` 수정
2. `pnpm db:push` (generate + migrate)
3. 새 SQL이 `drizzle/`에 생기는지 확인
4. 필요 시 `shared/types.ts`로 타입 노출됨 (자동)

### 테스트
- `pnpm test` (Vitest). `server/dispatch.test.ts`에 배차/정산 계산 케이스 다수.
- DB 헬퍼는 mock 처리하는 패턴 → 새 헬퍼 추가 시 테스트 mock에도 추가 필요할 수 있음.

### 타입체크
- `pnpm check` — 커밋 전 권장.

---

## 9. 기술 부채 / 이어서 개발할 때 손볼 거리

우선순위 대략 높은 순:

1. **인증 가드 부재** — 관리자 전용 procedure에 권한 체크 추가 (가장 중요, 보안).
2. **관리자 비밀번호 평문** — bcrypt 해시 + 세션화.
3. **거대 컴포넌트** — `AdminDashboard.tsx`(4151줄), `DriverDashboard.tsx`(2035줄)를 탭/모달 단위 컴포넌트로 분리.
4. **FK 제약 없음** — 기사 삭제 시 관련 배차/작업일지/지급 내역 cascade 또는 가드 처리.
5. **Windows 스크립트 호환** — 로컬 직접 실행 시 `cross-env` 사용. **Docker 전용 운영이므로 해당 없음.**
6. **ComponentShowcase.tsx** — 실서비스 라우트에 연결 안 돼 있으면 정리 대상.
7. **manus `_core` 의존성** — OAuth/스토리지/LLM 등이 manus 플랫폼에 묶여 있음. 자체 호스팅 시 이 부분 대체 필요.

---

## 10. 빠른 참조 (어디부터 볼까)

- **API 뭐 있나?** → `server/routers.ts`
- **DB 쿼리 어떻게?** → `server/db.ts`
- **테이블 구조?** → `drizzle/schema.ts`
- **관리자 화면 고치기?** → `client/src/pages/AdminDashboard.tsx`
- **기사 화면 고치기?** → `client/src/pages/DriverDashboard.tsx`
- **서버 시작/업로드 라우트?** → `server/_core/index.ts`
- **환경변수?** → `server/_core/env.ts` + `.env`
- **공통 디자인 상수?** → `client/src/lib/design.ts`
- **지금까지 한 작업 이력?** → `todo.md` (기능별 체크리스트, 사실상 변경 이력)
