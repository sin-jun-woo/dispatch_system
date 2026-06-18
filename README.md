# 배차 관리 시스템 (Dispatch System)

화물/지입차 **직접배차** 와 **정산**을 관리하는 풀스택 웹 애플리케이션.
관리자(배차 담당)와 기사(드라이버) 두 역할로 동작한다.

> **이 프로젝트는 Docker Compose로만 실행한다.**
> 상세 개발 가이드: [`DEVELOPMENT.md`](./DEVELOPMENT.md)

---

## 요구사항

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows / Mac / Linux)
- Git

로컬 Node.js / MySQL / pnpm 설치 **불필요** — 전부 컨테이너 안에서 실행된다.

---

## 빠른 시작 (Docker)

### 1. Docker Desktop 실행
Docker Desktop 앱을 켜고 엔진이 Running 상태인지 확인한다.

### 2. 환경변수 (선택)
```powershell
copy .env.example .env
```
`.env` 없어도 `docker-compose.yml` 기본값으로 동작한다. JWT_SECRET만 바꾸고 싶으면 `.env`에 설정.

### 3. 실행
```powershell
docker compose up -d --build
```
또는
```powershell
pnpm docker:up
```

### 4. 접속
- 앱: http://localhost:3000
- 관리자: http://localhost:3000/admin (비밀번호 기본값 `admin1234`)
- 기사: http://localhost:3000/driver/login

MySQL (호스트에서 직접 접속 시): `localhost:3306` / user `dispatch` / password `dispatch_dev`

---

## Docker 명령어

| 명령 | 설명 |
|------|------|
| `pnpm docker:up` | 빌드 + 백그라운드 실행 |
| `pnpm docker:down` | 컨테이너 중지 및 제거 |
| `pnpm docker:logs` | 전체 로그 (실시간) |
| `pnpm docker:logs:app` | 앱 로그만 |
| `pnpm docker:restart` | 앱 컨테이너 재시작 |
| `pnpm docker:shell` | 앱 컨테이너 셸 접속 |
| `pnpm docker:test` | 컨테이너 안에서 테스트 실행 |
| `pnpm docker:db:migrate` | DB 마이그레이션만 적용 |
| `pnpm docker:db:push` | 스키마 변경 후 generate + migrate |

---

## 컨테이너 구성

| 서비스 | 포트 | 설명 |
|--------|------|------|
| `app` | 3000 | Express + Vite dev 서버 (핫 리로드) |
| `mysql` | 3306 | MySQL 8.4, DB `dispatch_system` |

앱 시작 시 자동으로:
1. MySQL 연결 대기
2. `drizzle-kit migrate` 실행
3. `pnpm dev` 실행

소스 코드는 볼륨 마운트되어 **호스트에서 수정하면 컨테이너에 즉시 반영**된다.

---

## 핵심 기능

### 관리자 (`/admin`)
- 기사 등록/수정/삭제, 차량 사진, PIN 관리
- 직접배차 생성·수정·취소, 정산 관리, 알림 발송

### 기사 (`/driver`)
- 전화번호 + PIN 로그인
- 배차 승인/완료, 작업일지, 정산 현황

---

## 기술 스택

React 19 · Vite 7 · Express · tRPC 11 · Drizzle ORM · MySQL 8.4 · pnpm · Docker

---

## 트러블슈팅

**`Cannot connect to the Docker daemon`**
→ Docker Desktop 실행 후 다시 시도.

**포트 3000 / 3306 이미 사용 중**
→ `docker-compose.yml`의 `ports` 매핑 변경 (예: `"3001:3000"`).

**DB 초기화 (데이터 전부 삭제)**
```powershell
docker compose down -v
docker compose up -d --build
```

**의존성 변경 후 (package.json 수정)**
```powershell
docker compose up -d --build
```

---

## 라이선스

MIT
