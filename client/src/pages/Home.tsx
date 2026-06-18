import { useLocation } from "wouter";
import { useRole } from "@/contexts/RoleContext";
import { Truck, Shield, ChevronRight, LayoutDashboard, CheckCircle2, Users } from "lucide-react";

export default function Home() {
  const [, navigate] = useLocation();
  const { setRole } = useRole();

  const handleAdminEnter = () => {
    setRole("admin", null);
    navigate("/admin");
  };

  const handleDriverSelect = () => navigate("/driver/login");

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(160deg, oklch(0.14 0.04 252) 0%, oklch(0.18 0.05 258) 60%, oklch(0.13 0.03 248) 100%)",
      }}
    >
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 sm:px-10 py-5">
        <div className="flex items-center gap-2.5">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "oklch(0.78 0.12 72)" }}
          >
            <Truck className="w-4 h-4" style={{ color: "oklch(0.12 0.02 240)" }} />
          </div>
          <span className="text-sm font-semibold tracking-tight" style={{ color: "oklch(0.90 0.008 240)" }}>
            배차 관리 시스템
          </span>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="text-center mb-12 max-w-lg">
          <p
            className="text-xs font-semibold tracking-[0.18em] uppercase mb-4"
            style={{ color: "oklch(0.78 0.12 72)" }}
          >
            Dispatch Management
          </p>
          <h1
            className="text-3xl sm:text-4xl font-bold leading-snug mb-4"
            style={{ color: "oklch(0.95 0.005 240)" }}
          >
            스마트한 배차 관리를
            <br />
            <span style={{ color: "oklch(0.78 0.12 72)" }}>한 화면에서</span>
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "oklch(0.60 0.018 240)" }}>
            역할을 선택하여 전용 대시보드로 입장하세요.
          </p>
        </div>

        {/* ── Role Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full max-w-xl mb-14">
          {/* Admin */}
          <button
            onClick={handleAdminEnter}
            className="group rounded-2xl p-7 text-left transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "oklch(0.22 0.06 252 / 0.85)",
              border: "1px solid oklch(0.38 0.06 252 / 0.55)",
              boxShadow: "0 4px 24px oklch(0.08 0.04 252 / 0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-105"
              style={{ background: "oklch(0.78 0.12 72 / 0.14)", border: "1px solid oklch(0.78 0.12 72 / 0.28)" }}
            >
              <Shield className="w-5 h-5" style={{ color: "oklch(0.78 0.12 72)" }} />
            </div>
            <h2 className="text-base font-bold mb-1.5" style={{ color: "oklch(0.95 0.005 240)" }}>
              관리자
            </h2>
            <p className="text-xs leading-relaxed mb-5" style={{ color: "oklch(0.58 0.018 240)" }}>
              기사 관리 · 직접배차 생성<br />승인 상태 모니터링 · 정산 관리
            </p>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "oklch(0.78 0.12 72)" }}>
              관리자 대시보드 입장
              <ChevronRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>
          </button>

          {/* Driver */}
          <button
            onClick={handleDriverSelect}
            className="group rounded-2xl p-7 text-left transition-all duration-200 hover:-translate-y-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
            style={{
              background: "oklch(0.18 0.04 248 / 0.85)",
              border: "1px solid oklch(0.32 0.04 248 / 0.55)",
              boxShadow: "0 4px 24px oklch(0.08 0.04 252 / 0.5)",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform duration-200 group-hover:scale-105"
              style={{ background: "oklch(0.55 0.18 252 / 0.14)", border: "1px solid oklch(0.55 0.18 252 / 0.28)" }}
            >
              <Truck className="w-5 h-5" style={{ color: "oklch(0.62 0.16 252)" }} />
            </div>
            <h2 className="text-base font-bold mb-1.5" style={{ color: "oklch(0.95 0.005 240)" }}>
              기사
            </h2>
            <p className="text-xs leading-relaxed mb-5" style={{ color: "oklch(0.58 0.018 240)" }}>
              전화번호 + PIN으로 로그인<br />배차 확인 · 운행 완료 · 정보 수정
            </p>
            <div className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "oklch(0.62 0.16 252)" }}>
              기사 로그인
              <ChevronRight className="w-3.5 h-3.5 transition-transform duration-150 group-hover:translate-x-0.5" />
            </div>
          </button>
        </div>

        {/* ── Feature Pills ── */}
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { icon: LayoutDashboard, text: "직접배차 생성" },
            { icon: CheckCircle2, text: "실시간 상태 반영" },
            { icon: Users, text: "역할 기반 접근" },
          ].map(({ icon: Icon, text }) => (
            <div
              key={text}
              className="flex items-center gap-2 px-3.5 py-2 rounded-full text-xs font-medium"
              style={{
                background: "oklch(0.22 0.04 252 / 0.6)",
                border: "1px solid oklch(0.35 0.04 252 / 0.4)",
                color: "oklch(0.72 0.02 240)",
              }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: "oklch(0.78 0.12 72)" }} />
              {text}
            </div>
          ))}
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="py-5 text-center">
        <p className="text-xs" style={{ color: "oklch(0.38 0.02 240)" }}>
          © 2026 배차 관리 시스템
        </p>
      </footer>
    </div>
  );
}
