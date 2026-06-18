import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Truck, Lock, Phone, Eye, EyeOff, ChevronRight, Loader2 } from "lucide-react";
import { DRIVER_TOKEN_KEY, setDriverToken } from "@/lib/driverAuth";

export default function DriverLogin() {
  const [, navigate] = useLocation();
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [showPin, setShowPin] = useState(false);

  const utils = trpc.useUtils();

  const loginMutation = trpc.driver.login.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.name} 기사님, 환영합니다!`);
      // 토큰 localStorage 저장 (쿠키 차단 환경 대응)
      if (data.token) {
        setDriverToken(data.token);
      }
      // 쿠키 세팅 후 navigate
      setTimeout(() => {
        utils.driver.me.invalidate();
        navigate("/driver");
      }, 300);
    },
    onError: (e) => {
      toast.error(e.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) { toast.error("전화번호를 입력해주세요."); return; }
    if (pin.length < 4) { toast.error("PIN은 4자리 이상 입력해주세요."); return; }
    loginMutation.mutate({ phone: phone.trim(), pin });
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{
        background: "linear-gradient(160deg, oklch(0.14 0.04 252) 0%, oklch(0.18 0.05 258) 60%, oklch(0.13 0.03 248) 100%)",
      }}
    >
      {/* 로고 */}
      <div className="mb-8 flex flex-col items-center gap-3">
        <div
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "oklch(0.78 0.12 72)" }}
        >
          <Truck className="w-7 h-7" style={{ color: "oklch(0.12 0.02 240)" }} />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold" style={{ color: "oklch(0.95 0.005 240)" }}>
            기사 로그인
          </h1>
          <p className="text-sm mt-1" style={{ color: "oklch(0.55 0.018 240)" }}>
            전화번호와 PIN으로 입장하세요
          </p>
        </div>
      </div>

      {/* 로그인 카드 */}
      <div
        className="w-full max-w-sm rounded-2xl p-7"
        style={{
          background: "oklch(0.22 0.06 252 / 0.85)",
          border: "1px solid oklch(0.38 0.06 252 / 0.55)",
          boxShadow: "0 4px 32px oklch(0.08 0.04 252 / 0.6)",
          backdropFilter: "blur(12px)",
        }}
      >
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* 전화번호 */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" style={{ color: "oklch(0.80 0.01 240)" }}>
              전화번호
            </Label>
            <div className="relative">
              <Phone
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "oklch(0.55 0.018 240)" }}
              />
              <Input
                type="tel"
                placeholder="010-0000-0000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pl-10 h-11 rounded-xl border-0 text-sm"
                style={{
                  background: "oklch(0.16 0.04 252 / 0.8)",
                  color: "oklch(0.92 0.005 240)",
                  boxShadow: "inset 0 0 0 1px oklch(0.38 0.06 252 / 0.5)",
                }}
                autoComplete="tel"
                inputMode="tel"
              />
            </div>
          </div>

          {/* PIN */}
          <div className="space-y-2">
            <Label className="text-sm font-medium" style={{ color: "oklch(0.80 0.01 240)" }}>
              PIN 번호
            </Label>
            <div className="relative">
              <Lock
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                style={{ color: "oklch(0.55 0.018 240)" }}
              />
              <Input
                type={showPin ? "text" : "password"}
                placeholder="4~8자리 PIN"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                maxLength={8}
                className="pl-10 pr-10 h-11 rounded-xl border-0 text-sm"
                style={{
                  background: "oklch(0.16 0.04 252 / 0.8)",
                  color: "oklch(0.92 0.005 240)",
                  boxShadow: "inset 0 0 0 1px oklch(0.38 0.06 252 / 0.5)",
                }}
                autoComplete="current-password"
                inputMode="numeric"
              />
              <button
                type="button"
                onClick={() => setShowPin((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                style={{ color: "oklch(0.55 0.018 240)" }}
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* 로그인 버튼 */}
          <Button
            type="submit"
            disabled={loginMutation.isPending}
            className="w-full h-11 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
            style={{
              background: loginMutation.isPending
                ? "oklch(0.55 0.12 72 / 0.6)"
                : "oklch(0.78 0.12 72)",
              color: "oklch(0.12 0.02 240)",
            }}
          >
            {loginMutation.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> 로그인 중...</>
            ) : (
              <>기사 대시보드 입장 <ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </form>

        {/* 안내 문구 */}
        <p className="text-center text-xs mt-5" style={{ color: "oklch(0.45 0.018 240)" }}>
          PIN을 모르시면 관리자에게 문의하세요
        </p>
      </div>

      {/* 홈으로 */}
      <button
        onClick={() => navigate("/")}
        className="mt-6 text-sm"
        style={{ color: "oklch(0.50 0.018 240)" }}
      >
        ← 홈으로 돌아가기
      </button>
    </div>
  );
}
