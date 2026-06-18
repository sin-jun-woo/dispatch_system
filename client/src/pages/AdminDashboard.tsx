import { useState, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  NAV_STYLE,
  CARD_STYLE,
  DRIVER_STATUS_CONFIG,
  formatArrivalDeadlineKorean,
  getDeadlineUrgency,
} from "@/lib/design";
import { trpc } from "@/lib/trpc";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Shield,
  Truck,
  Plus,
  LogOut,
  Users,
  ClipboardList,
  Clock,
  CheckCircle2,
  MapPin,
  Phone,
  Car,
  Building2,
  Loader2,
  Trash2,
  RefreshCw,
  ArrowRight,
  FileText,
  Camera,
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  X,
  Image,
  Wrench,
  PlayCircle,
  PauseCircle,
  AlertTriangle,
  MessageSquare,
  Copy,
  CheckCheck,
  CalendarClock,
  Pencil,
  BookmarkPlus,
  BarChart3,
  Download,
  Filter,
  FilterX,
  Ban,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  KeyRound,
  UserCheck,
  CreditCard,
  Wallet,
  CircleDollarSign,
  Banknote,
} from "lucide-react";

// ─── 기사 상태 설정 (design.ts에서 import한 DRIVER_STATUS_CONFIG에 Icon 추가) ───
const ADMIN_STATUS_CONFIG = {
  idle: {
    ...DRIVER_STATUS_CONFIG.idle,
    Icon: PauseCircle,
  },
  driving: {
    ...DRIVER_STATUS_CONFIG.driving,
    Icon: PlayCircle,
  },
  repair: {
    ...DRIVER_STATUS_CONFIG.repair,
    Icon: Wrench,
  },
} as const;
type DriverStatusKey = keyof typeof ADMIN_STATUS_CONFIG;

// ─── 문자 메시지 생성 ─────────────────────────────────────────────────────────
function generateSmsText(
  driverName: string,
  pickupLocation: string,
  dropoffLocation: string,
  arrivalDeadline?: string
): string {
  const lines = [
    `${driverName}기사님 배차지`,
    `출발지: ${pickupLocation}`,
    `도착지: ${dropoffLocation}`,
  ];
  if (arrivalDeadline) {
    lines.push(`${formatArrivalDeadlineKorean(arrivalDeadline)}까지 도착해주세요`);
  }
  return lines.join("\n");
}

// ─── 관리자용 라이트박스 ─────────────────────────────────────────────────
function AdminLightbox({
  photos,
  initialIndex,
  onClose,
}: {
  photos: { url: string; name?: string | null }[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "oklch(0.05 0.02 240 / 0.95)" }}
      onClick={onClose}
    >
      <button
        className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
        style={{ background: "oklch(0.25 0.03 240)", color: "oklch(0.85 0.01 240)" }}
        onClick={onClose}
      >
        <X className="w-5 h-5" />
      </button>
      {photos.length > 1 && (
        <>
          <button
            className="absolute left-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
            style={{ background: "oklch(0.25 0.03 240)", color: "oklch(0.85 0.01 240)" }}
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i - 1 + photos.length) % photos.length); }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="absolute right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
            style={{ background: "oklch(0.25 0.03 240)", color: "oklch(0.85 0.01 240)" }}
            onClick={(e) => { e.stopPropagation(); setIdx((i) => (i + 1) % photos.length); }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
      <div className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        <img
          src={photos[idx].url}
          alt={photos[idx].name ?? "사진"}
          className="max-h-[75vh] max-w-full rounded-xl object-contain"
          style={{ boxShadow: "0 8px 40px oklch(0.05 0.02 240 / 0.8)" }}
        />
        <p className="text-sm" style={{ color: "oklch(0.65 0.02 240)" }}>
          {photos[idx].name ?? `사진 ${idx + 1}`}
          {photos.length > 1 && <span className="ml-3 opacity-60">{idx + 1} / {photos.length}</span>}
        </p>
      </div>
    </div>
  );
}

// ─── 작업일지 카드 ────────────────────────────────────────────────────────
function WorkLogCard({
  log,
}: {
  log: {
    id: number;
    driverId: number;
    dispatchOrderId: number;
    memo: string | null;
    createdAt: Date;
    driver: { id: number; name: string; vehicleNumber: string | null; phone: string } | null;
    photos: { id: number; storageUrl: string; originalName: string | null }[];
  };
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const photos = log.photos ?? [];

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        background: "oklch(1 0 0)",
        border: "1px solid oklch(0.88 0.01 240)",
        boxShadow: "0 1px 4px oklch(0.15 0.02 240 / 0.06)",
      }}
    >
      {/* 헤더 */}
      <div className="flex items-start gap-4 mb-4">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0"
          style={{ background: "oklch(0.28 0.07 250 / 0.1)", color: "oklch(0.28 0.07 250)" }}
        >
          {log.driver?.name?.[0] ?? "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold" style={{ color: "oklch(0.15 0.02 240)" }}>
              {log.driver?.name ?? "알 수 없음"}
            </span>
            {log.driver?.vehicleNumber && (
              <span className="text-xs px-2 py-0.5 rounded" style={{ background: "oklch(0.94 0.01 240)", color: "oklch(0.45 0.03 240)" }}>
                {log.driver.vehicleNumber}
              </span>
            )}
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: "oklch(0.55 0.18 250 / 0.1)", color: "oklch(0.28 0.07 250)" }}
            >
              배차 #{String(log.dispatchOrderId).padStart(4, "0")}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>
              {new Date(log.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
            </span>
            <span
              className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
              style={{ background: "oklch(0.55 0.18 250 / 0.08)", color: "oklch(0.28 0.07 250)" }}
            >
              <Camera className="w-3 h-3" />
              사진 {photos.length}장
            </span>
          </div>
        </div>
      </div>

      {/* 메모 */}
      {log.memo && (
        <div
          className="rounded-lg p-3 mb-4 text-sm"
          style={{ background: "oklch(0.96 0.006 240)", color: "oklch(0.35 0.03 240)", border: "1px solid oklch(0.88 0.01 240)" }}
        >
          <span className="font-semibold text-xs" style={{ color: "oklch(0.52 0.02 240)" }}>작업 메모</span>
          <p className="mt-1">{log.memo}</p>
        </div>
      )}

      {/* 사진 그리드 */}
      {photos.length > 0 ? (
        <div className="grid grid-cols-6 gap-2">
          {photos.map((photo, i) => (
            <button
              key={photo.id}
              onClick={() => setLightboxIdx(i)}
              className="relative aspect-square rounded-lg overflow-hidden group"
              title={photo.originalName ?? "사진"}
            >
              <img
                src={photo.storageUrl}
                alt={photo.originalName ?? `사진 ${i + 1}`}
                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
              />
              <div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
                style={{ background: "oklch(0.05 0.02 240 / 0.45)" }}
              >
                <ZoomIn className="w-4 h-4 text-white" />
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div
          className="rounded-lg p-4 flex items-center gap-2"
          style={{ background: "oklch(0.96 0.006 240)", color: "oklch(0.55 0.02 240)" }}
        >
          <Image className="w-4 h-4" />
          <span className="text-xs">등록된 사진이 없습니다.</span>
        </div>
      )}

      {lightboxIdx !== null && (
        <AdminLightbox
          photos={photos.map((p) => ({ url: p.storageUrl, name: p.originalName }))}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

// ─── 문자 미리보기 아이템 ─────────────────────────────────────────────────────
function SmsPreviewItem({
  driverName,
  smsText,
  onTextChange,
}: {
  driverName: string;
  smsText: string;
  onTextChange: (newText: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(smsText);

  // smsText prop이 바뀌면 편집 값도 동기화
  const prevSmsText = useState(smsText)[0];
  if (!isEditing && editValue !== smsText && prevSmsText !== smsText) {
    setEditValue(smsText);
  }

  const handleCopy = async () => {
    const textToCopy = isEditing ? editValue : smsText;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const handleEditToggle = () => {
    if (isEditing) {
      // 편집 완료 → 저장
      onTextChange(editValue);
      setIsEditing(false);
    } else {
      setEditValue(smsText);
      setIsEditing(true);
    }
  };

  const handleCancel = () => {
    setEditValue(smsText);
    setIsEditing(false);
  };

  const displayText = isEditing ? editValue : smsText;

  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: isEditing ? "oklch(0.28 0.07 250 / 0.04)" : "oklch(0.97 0.006 240)",
        border: isEditing
          ? "1px solid oklch(0.55 0.12 250 / 0.40)"
          : "1px solid oklch(0.88 0.01 240)",
        transition: "background 0.15s, border-color 0.15s",
      }}
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ background: "oklch(0.28 0.07 250 / 0.12)", color: "oklch(0.28 0.07 250)" }}
          >
            {driverName[0]}
          </div>
          <span className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 240)" }}>
            {driverName} 기사
          </span>
          {isEditing && (
            <span
              className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
              style={{ background: "oklch(0.55 0.12 250 / 0.12)", color: "oklch(0.35 0.10 250)" }}
            >
              편집 중
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {/* 편집/저장 버튼 */}
          <button
            onClick={handleEditToggle}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95"
            style={{
              background: isEditing
                ? "oklch(0.45 0.15 145 / 0.10)"
                : "oklch(0.28 0.07 250 / 0.06)",
              color: isEditing ? "oklch(0.38 0.15 145)" : "oklch(0.40 0.08 250)",
              border: `1px solid ${isEditing ? "oklch(0.45 0.15 145 / 0.30)" : "oklch(0.55 0.08 250 / 0.20)"}`,
            }}
          >
            {isEditing ? (
              <>
                <CheckCheck className="w-3.5 h-3.5" />
                저장
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5" />
                수정
              </>
            )}
          </button>
          {/* 취소 버튼 (편집 중일 때만) */}
          {isEditing && (
            <button
              onClick={handleCancel}
              className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg transition-all duration-150 active:scale-95"
              style={{
                background: "oklch(0.55 0.22 25 / 0.08)",
                color: "oklch(0.48 0.18 25)",
                border: "1px solid oklch(0.55 0.22 25 / 0.25)",
              }}
            >
              <X className="w-3.5 h-3.5" />
              취소
            </button>
          )}
          {/* 복사 버튼 */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all duration-150 active:scale-95"
            style={{
              background: copied ? "oklch(0.45 0.15 145 / 0.12)" : "oklch(0.28 0.07 250 / 0.08)",
              color: copied ? "oklch(0.38 0.15 145)" : "oklch(0.35 0.08 250)",
              border: `1px solid ${copied ? "oklch(0.45 0.15 145 / 0.3)" : "oklch(0.55 0.08 250 / 0.25)"}`,
            }}
          >
            {copied ? (
              <>
                <CheckCheck className="w-3.5 h-3.5" />
                복사됨
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                복사
              </>
            )}
          </button>
        </div>
      </div>

      {/* 텍스트 영역: 편집 모드 vs 보기 모드 */}
      {isEditing ? (
        <textarea
          className="w-full text-sm leading-relaxed rounded-lg p-3 resize-none outline-none transition-all duration-150"
          style={{
            background: "oklch(1 0 0)",
            color: "oklch(0.15 0.02 240)",
            border: "1.5px solid oklch(0.55 0.12 250 / 0.45)",
            fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
            minHeight: "120px",
            boxShadow: "0 0 0 3px oklch(0.55 0.12 250 / 0.08)",
          }}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          autoFocus
        />
      ) : (
        <pre
          className="text-sm leading-relaxed whitespace-pre-wrap font-sans rounded-lg p-3"
          style={{
            background: "oklch(1 0 0)",
            color: "oklch(0.20 0.02 240)",
            border: "1px solid oklch(0.90 0.01 240)",
          }}
        >
          {displayText}
        </pre>
      )}
    </div>
  );
}

const ADMIN_PASSWORD_KEY = "admin_auth_v1";

export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { clearRole } = useRole();
  const utils = trpc.useUtils();

  // 관리자 비밀번호 게이트
  const [adminAuthed, setAdminAuthed] = useState(() => {
    try { return sessionStorage.getItem(ADMIN_PASSWORD_KEY) === "ok"; } catch { return false; }
  });
  const [adminPwInput, setAdminPwInput] = useState("");
  const [adminPwError, setAdminPwError] = useState("");
  const [adminPwLoading, setAdminPwLoading] = useState(false);

  // 비밀번호 변경 다이얼로그 상태
  const [changePwOpen, setChangePwOpen] = useState(false);
  const [changePwForm, setChangePwForm] = useState({ current: "", newPw: "", confirm: "" });
  const [changePwError, setChangePwError] = useState("");
  const [changePwLoading, setChangePwLoading] = useState(false);

  const verifyAdminPassword = trpc.admin.verifyPassword.useMutation();
  const changeAdminPassword = trpc.admin.changePassword.useMutation();

  const handleAdminLogin = async () => {
    if (!adminPwInput.trim()) return;
    setAdminPwLoading(true);
    try {
      const result = await verifyAdminPassword.mutateAsync({ password: adminPwInput });
      if (result.isValid) {
        sessionStorage.setItem(ADMIN_PASSWORD_KEY, "ok");
        setAdminAuthed(true);
        setAdminPwError("");
      } else {
        setAdminPwError("비밀번호가 올바르지 않습니다.");
        setAdminPwInput("");
      }
    } catch {
      setAdminPwError("로그인 중 오류가 발생했습니다.");
    } finally {
      setAdminPwLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (!changePwForm.newPw || changePwForm.newPw.length < 4) {
      setChangePwError("새 비밀번호는 4자 이상이어야 합니다.");
      return;
    }
    if (changePwForm.newPw !== changePwForm.confirm) {
      setChangePwError("새 비밀번호가 일치하지 않습니다.");
      return;
    }
    setChangePwLoading(true);
    try {
      await changeAdminPassword.mutateAsync({
        currentPassword: changePwForm.current,
        newPassword: changePwForm.newPw,
      });
      toast.success("비밀번호가 변경되었습니다.");
      setChangePwOpen(false);
      setChangePwForm({ current: "", newPw: "", confirm: "" });
      setChangePwError("");
    } catch (err: any) {
      setChangePwError(err?.message ?? "비밀번호 변경에 실패했습니다.");
    } finally {
      setChangePwLoading(false);
    }
  };

  const [dispatchDialogOpen, setDispatchDialogOpen] = useState(false);
  const [driverDialogOpen, setDriverDialogOpen] = useState(false);
  const [smsPreviewOpen, setSmsPreviewOpen] = useState(false);

  // 다중 기사 선택 지원 폼 상태
  const [dispatchForm, setDispatchForm] = useState({
    selectedDriverIds: [] as number[],
    pickupLocation: "",
    dropoffLocation: "",
    memo: "",
    unitPrice: "",
    arrivalDeadline: "", // datetime-local input 값
  });

  // 문자 미리보기용 데이터 (배차 생성 성공 후 저장)
  const [smsPreviewData, setSmsPreviewData] = useState<{
    driverName: string;
    smsText: string;
  }[]>([]);

  const [driverForm, setDriverForm] = useState({
    name: "",
    phone: "",
    vehicleNumber: "",
    vehicleType: "",
    affiliation: "",
    initialPin: "",
  });

  // 차량 사진 업로드 관련 상태
  const [vehiclePhotoFile, setVehiclePhotoFile] = useState<File | null>(null);
  const [vehiclePhotoPreview, setVehiclePhotoPreview] = useState<string | null>(null);
  const [vehiclePhotoDragOver, setVehiclePhotoDragOver] = useState(false);
  const [vehiclePhotoUploading, setVehiclePhotoUploading] = useState(false);
  const vehiclePhotoInputRef = useRef<HTMLInputElement>(null);

  // 관리자 기사 목록 차량 사진 라이트박스
  const [vehicleLightbox, setVehicleLightbox] = useState<{ url: string; name: string } | null>(null);

  const { data: drivers, isLoading: driversLoading } = trpc.driver.list.useQuery();
  const {
    data: dispatches,
    isLoading: dispatchesLoading,
  } = trpc.dispatch.listAll.useQuery(undefined, {
    refetchInterval: 3000, // 3초 폴링
  });

  // 다중 기사 배차 생성 mutation
  const createMultipleDispatch = trpc.dispatch.createMultiple.useMutation({
    onSuccess: (data, variables) => {
      const count = data.count;
      toast.success(`${count}명의 기사에게 직접배차가 생성되었습니다.`);
      utils.dispatch.listAll.invalidate();

      // 선택된 기사들의 문자 미리보기 데이터 생성
      const selectedDrivers = drivers?.filter((d) =>
        variables.driverIds.includes(d.id)
      ) ?? [];
      const previewData = selectedDrivers.map((d) => ({
        driverName: d.name,
        smsText: generateSmsText(
          d.name,
          variables.pickupLocation,
          variables.dropoffLocation,
          variables.arrivalDeadline
        ),
      }));
      setSmsPreviewData(previewData);

      // 폼 초기화 및 다이얼로그 닫기
      setDispatchDialogOpen(false);
      setDispatchForm({
        selectedDriverIds: [],
        pickupLocation: "",
        dropoffLocation: "",
        memo: "",
        unitPrice: "",
        arrivalDeadline: "",
      });

      // 문자 미리보기 모달 오픈
      setSmsPreviewOpen(true);
    },
    onError: (e) => toast.error(e.message),
  });

  const createDriver = trpc.driver.create.useMutation({
    onSuccess: () => {
      toast.success("기사가 등록되었습니다.");
      utils.driver.list.invalidate();
      setDriverDialogOpen(false);
      setDriverForm({ name: "", phone: "", vehicleNumber: "", vehicleType: "", affiliation: "", initialPin: "" });
    },
    onError: (e) => toast.error(e.message),
  });

  const adminSetPin = trpc.driver.adminSetPin.useMutation({
    onError: (e) => toast.warning(`기사는 등록되었지만 PIN 설정에 실패했습니다: ${e.message}`),
  });

  const resetDriverPin = trpc.driver.adminSetPin.useMutation({
    onSuccess: () => {
      toast.success(`${pinResetDriver?.name} 기사의 PIN이 초기화되었습니다.`);
      setPinResetDriver(null);
      setPinResetValue("");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDriver = trpc.driver.delete.useMutation({
    onSuccess: () => {
      toast.success("기사가 삭제되었습니다.");
      utils.driver.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const adminUpdateDriver = trpc.driver.adminUpdate.useMutation({
    onSuccess: () => {
      toast.success("기사 정보가 수정되었습니다.");
      utils.driver.list.invalidate();
      setEditDriver(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const cancelDispatch = trpc.dispatch.cancel.useMutation({
    onSuccess: () => {
      toast.success("배차가 취소되었습니다.");
      utils.dispatch.listAll.invalidate();
      utils.settlement.filteredOrders.invalidate();
      setCancelConfirmId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDispatch = trpc.dispatch.delete.useMutation({
    onSuccess: () => {
      toast.success("배차가 삭제되었습니다.");
      utils.dispatch.listAll.invalidate();
      utils.settlement.filteredOrders.invalidate();
      setDeleteConfirmId(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const updateDispatch = trpc.dispatch.update.useMutation({
    onMutate: async (input) => {
      // 진행 중인 쿼리 취소
      await utils.dispatch.listAll.cancel();
      // 현재 캐시 스냅샷 저장
      const prevData = utils.dispatch.listAll.getData();
      // 캐시 즉시 반영 (낙관적 업데이트)
      utils.dispatch.listAll.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((d: any) =>
          d.id === input.id
            ? {
                ...d,
                pickupLocation: input.pickupLocation ?? d.pickupLocation,
                dropoffLocation: input.dropoffLocation ?? d.dropoffLocation,
                unitPrice: input.unitPrice !== undefined ? input.unitPrice : d.unitPrice,
                memo: input.memo !== undefined ? input.memo : d.memo,
                arrivalDeadline: input.arrivalDeadline !== undefined ? input.arrivalDeadline : d.arrivalDeadline,
              }
            : d
        );
      });
      setEditDispatchId(null);
      return { prevData };
    },
    onError: (e, _input, ctx) => {
      // 실패 시 롤백
      if (ctx?.prevData !== undefined) {
        utils.dispatch.listAll.setData(undefined, ctx.prevData);
      }
      setEditDispatchId(null);
      toast.error(e.message);
    },
    onSuccess: () => {
      toast.success("배차 정보가 수정되었습니다.");
    },
    onSettled: () => {
      // 서버 응답 후 캐시 동기화
      utils.dispatch.listAll.invalidate();
      utils.settlement.filteredOrders.invalidate();
    },
  });

  const openEditModal = (d: { id: number; pickupLocation: string; dropoffLocation: string; unitPrice?: number | null; memo?: string | null; arrivalDeadline?: Date | null }) => {
    setEditForm({
      pickupLocation: d.pickupLocation,
      dropoffLocation: d.dropoffLocation,
      unitPrice: d.unitPrice != null ? String(d.unitPrice) : "",
      memo: d.memo ?? "",
      arrivalDeadline: d.arrivalDeadline
        ? new Date(d.arrivalDeadline).toISOString().slice(0, 16)
        : "",
    });
    setEditDispatchId(d.id);
  };

  const handleEditSave = () => {
    if (!editDispatchId) return;
    const pickup = editForm.pickupLocation.trim();
    const dropoff = editForm.dropoffLocation.trim();
    if (!pickup || !dropoff) {
      toast.error("출발지와 도착지는 필수 입력 항목입니다.");
      return;
    }
    if (pickup === dropoff) {
      toast.error("출발지와 도착지가 동일합니다. 다른 주소를 입력해 주세요.");
      return;
    }
    if (editForm.arrivalDeadline && new Date(editForm.arrivalDeadline) <= new Date()) {
      toast.error("도착 기한이 현재 시간보다 과거입니다. 미래 시간을 선택해 주세요.");
      return;
    }
    updateDispatch.mutate({
      id: editDispatchId,
      pickupLocation: editForm.pickupLocation.trim(),
      dropoffLocation: editForm.dropoffLocation.trim(),
      unitPrice: editForm.unitPrice !== "" ? Number(editForm.unitPrice) : null,
      memo: editForm.memo.trim() || null,
      arrivalDeadline: editForm.arrivalDeadline || null,
    });
  };

  // ─── 알림 발송 상태 ───────────────────────────────────────────────────────
  const [notifSelectedIds, setNotifSelectedIds] = useState<number[]>([]);
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");

  const { data: notifHistory, refetch: refetchNotifHistory } = trpc.admin.notificationHistory.useQuery();

  const sendNotification = trpc.admin.sendNotification.useMutation({
    onSuccess: (data) => {
      toast.success(`${data.count}명의 기사에게 알림을 발송했습니다.`);
      setNotifSelectedIds([]);
      setNotifTitle("");
      setNotifMessage("");
      refetchNotifHistory();
    },
    onError: (e) => toast.error(e.message),
  });

  const toggleNotifDriver = (id: number) => {
    setNotifSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleNotifSelectAll = () => {
    const allIds = drivers?.map((d) => d.id) ?? [];
    const allSelected = allIds.every((id) => notifSelectedIds.includes(id));
    setNotifSelectedIds(allSelected ? [] : allIds);
  };

  const handleSendNotification = () => {
    if (notifSelectedIds.length === 0) { toast.error("기사를 한 명 이상 선택해주세요."); return; }
    if (!notifTitle.trim()) { toast.error("제목을 입력해주세요."); return; }
    if (!notifMessage.trim()) { toast.error("메시지 내용을 입력해주세요."); return; }
    sendNotification.mutate({ driverIds: notifSelectedIds, title: notifTitle.trim(), message: notifMessage.trim() });
  };

  const handleLogout = () => {
    clearRole();
    navigate("/");
  };

  // 기사 선택 토글
  const toggleDriverSelection = (driverId: number) => {
    setDispatchForm((prev) => {
      const isSelected = prev.selectedDriverIds.includes(driverId);
      return {
        ...prev,
        selectedDriverIds: isSelected
          ? prev.selectedDriverIds.filter((id) => id !== driverId)
          : [...prev.selectedDriverIds, driverId],
      };
    });
  };

  // 전체 선택/해제
  const toggleSelectAll = () => {
    const allIds = drivers?.map((d) => d.id) ?? [];
    const allSelected = allIds.every((id) => dispatchForm.selectedDriverIds.includes(id));
    setDispatchForm((prev) => ({
      ...prev,
      selectedDriverIds: allSelected ? [] : allIds,
    }));
  };

  const handleCreateDispatch = () => {
    if (dispatchForm.selectedDriverIds.length === 0) {
      toast.error("기사를 한 명 이상 선택해주세요.");
      return;
    }
    if (!dispatchForm.pickupLocation || !dispatchForm.dropoffLocation) {
      toast.error("출발지와 도착지를 모두 입력해주세요.");
      return;
    }
    createMultipleDispatch.mutate({
      driverIds: dispatchForm.selectedDriverIds,
      pickupLocation: dispatchForm.pickupLocation,
      dropoffLocation: dispatchForm.dropoffLocation,
      memo: dispatchForm.memo || undefined,
      unitPrice: dispatchForm.unitPrice ? Number(dispatchForm.unitPrice) : undefined,
      arrivalDeadline: dispatchForm.arrivalDeadline || undefined,
    });
  };

  const handleVehiclePhotoSelect = useCallback(async (files: FileList | File[]) => {
    const file = Array.from(files).find((f) => f.type.startsWith("image/"));
    if (!file) {
      toast.error("이미지 파일만 선택할 수 있습니다.");
      return;
    }
    if (vehiclePhotoPreview) URL.revokeObjectURL(vehiclePhotoPreview);
    // 자동 리사이징 적용
    try {
      const { resizeImage, resizeResultToFile, formatFileSize } = await import("@/lib/imageResize");
      const result = await resizeImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 });
      const resizedFile = resizeResultToFile(result, file);
      setVehiclePhotoFile(resizedFile);
      setVehiclePhotoPreview(URL.createObjectURL(result.blob));
      if (result.compressionRatio > 0) {
        toast.info(`사진 자동 압축: ${formatFileSize(result.originalSize)} → ${formatFileSize(result.compressedSize)} (${result.compressionRatio}% 감소)`);
      }
    } catch {
      setVehiclePhotoFile(file);
      setVehiclePhotoPreview(URL.createObjectURL(file));
    }
  }, [vehiclePhotoPreview]);

  const handleCreateDriver = async () => {
    if (!driverForm.name || !driverForm.phone) {
      toast.error("이름과 연락처는 필수입니다.");
      return;
    }
    setVehiclePhotoUploading(true);
    try {
      // 1. 기사 등록
      const result = await new Promise<{ success: boolean; id?: number }>((resolve, reject) => {
        createDriver.mutate(
          {
            name: driverForm.name,
            phone: driverForm.phone,
            vehicleNumber: driverForm.vehicleNumber || undefined,
            vehicleType: driverForm.vehicleType || undefined,
            affiliation: driverForm.affiliation || undefined,
          },
          {
            onSuccess: (data) => resolve(data as any),
            onError: (e) => reject(e),
          }
        );
      });

      // 2. PIN 설정 (입력한 경우)
      if (driverForm.initialPin && driverForm.initialPin.length === 4 && (result as any)?.id) {
        await adminSetPin.mutateAsync({ driverId: (result as any).id, pin: driverForm.initialPin });
      }

      // 3. 차량 사진 업로드 (등록된 기사 ID 필요)
      if (vehiclePhotoFile && (result as any)?.id) {
        const formData = new FormData();
        formData.append("driverId", String((result as any).id));
        formData.append("photo", vehiclePhotoFile);
        const res = await fetch("/api/driver/upload-vehicle-photo", {
          method: "POST",
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const json = await res.json();
          toast.warning(`기사는 등록되었지만 차량 사진 업로드에 실패했습니다: ${json.error}`);
        }
      }

      // 3. 정리
      utils.driver.list.invalidate();
      setDriverDialogOpen(false);
      setDriverForm({ name: "", phone: "", vehicleNumber: "", vehicleType: "", affiliation: "", initialPin: "" });
      if (vehiclePhotoPreview) URL.revokeObjectURL(vehiclePhotoPreview);
      setVehiclePhotoFile(null);
      setVehiclePhotoPreview(null);
    } catch (e: any) {
      // CONFLICT 코드일 때 중복 등록 오류 메시지 표시
      const msg = e?.message ?? "기사 등록에 실패했습니다.";
      if (msg.includes("이미 등록된") || msg.includes("중복")) {
        toast.error(`⚠️ 중복 등록 불가: ${msg}`, { duration: 5000 });
      } else {
        toast.error(msg);
      }
    } finally {
      setVehiclePhotoUploading(false);
    }
  };

  // 전체 복사 (모든 기사 문자 내용 합치기)
  const handleCopyAll = async () => {
    const allText = smsPreviewData.map((d) => d.smsText).join("\n\n---\n\n");
    try {
      await navigator.clipboard.writeText(allText);
      toast.success("전체 문자 내용이 복사되었습니다.");
    } catch {
      toast.error("복사에 실패했습니다.");
    }
  };

  const pendingCount = dispatches?.filter((d) => d.approvalStatus === "pending").length ?? 0;
  const confirmedCount = dispatches?.filter((d) => d.approvalStatus === "confirmed").length ?? 0;
  const completedCount = dispatches?.filter((d) => d.approvalStatus === "completed").length ?? 0;
  const totalSettlement = dispatches?.filter((d) => d.approvalStatus === "completed").reduce((sum, d) => sum + (d.totalAmount ?? 0), 0) ?? 0;

  // 기사 상태별 수 계산
  const idleCount = drivers?.filter((d) => d.status === "idle").length ?? 0;
  const drivingCount = drivers?.filter((d) => d.status === "driving").length ?? 0;
  const repairCount = drivers?.filter((d) => d.status === "repair").length ?? 0;

  // 선택된 기사 중 수리중인 기사
  const repairDriversSelected = drivers?.filter(
    (d) => dispatchForm.selectedDriverIds.includes(d.id) && d.status === "repair"
  ) ?? [];

  const { data: workLogs, isLoading: workLogsLoading } = trpc.workLog.listAll.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // 문자 템플릿
  const { data: smsTemplates } = trpc.smsTemplate.list.useQuery();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateTitle, setTemplateTitle] = useState("");
  const [templateSaveTarget, setTemplateSaveTarget] = useState<string>("");
  const saveSmsTemplate = trpc.smsTemplate.create.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 저장되었습니다.");
      utils.smsTemplate.list.invalidate();
      setTemplateDialogOpen(false);
      setTemplateTitle("");
    },
    onError: (e) => toast.error(e.message),
  });
  const deleteSmsTemplate = trpc.smsTemplate.delete.useMutation({
    onSuccess: () => {
      toast.success("템플릿이 삭제되었습니다.");
      utils.smsTemplate.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  // 기사별 이번 달 요약
  const { data: driverMonthlySummary } = trpc.driver.monthlySummary.useQuery(undefined, {
    refetchInterval: 10000,
  });

  // 기사별 월평균 배차 일수 통계
  const { data: dispatchDayStats } = trpc.driver.dispatchDayStats.useQuery(undefined, {
    refetchInterval: 15000,
  });

  // 배차 이력 필터 상태
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterDriverId, setFilterDriverId] = useState<number | undefined>(undefined);
  const [filterEnabled, setFilterEnabled] = useState(false);

  const { data: filteredOrders, isLoading: filteredLoading } = trpc.settlement.filteredOrders.useQuery(
    { startDate: filterStartDate || undefined, endDate: filterEndDate || undefined, driverId: filterDriverId },
    { enabled: filterEnabled, refetchInterval: 5000 }
  );

  // 정산 리포트 상태
  const now = new Date();
  const [reportYear, setReportYear] = useState(now.getFullYear());
  const [reportMonth, setReportMonth] = useState(now.getMonth() + 1);
  const { data: settlementReport, isLoading: reportLoading } = trpc.settlement.monthlyReport.useQuery(
    { year: reportYear, month: reportMonth },
    { refetchInterval: 10000 }
  );

  // 정산 드릴다운 상태
  const [drilldownDriver, setDrilldownDriver] = useState<{ id: number; name: string } | null>(null);
  const { data: drilldownOrders, isLoading: drilldownLoading } = trpc.settlement.driverDetail.useQuery(
    { driverId: drilldownDriver?.id ?? 0, year: reportYear, month: reportMonth },
    { enabled: !!drilldownDriver }
  );

  // 정산 상세 Sheet 상태 (기사 행 클릭 시 열림)
  const [settlementDetailDriver, setSettlementDetailDriver] = useState<{ id: number; name: string; totalAmount: number } | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: "", companyName: "", memo: "", paidAt: new Date().toISOString().slice(0, 10) });
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const { data: settlementSummaryAll } = trpc.driver.settlementSummary.useQuery(
    { year: reportYear, month: reportMonth },
    { enabled: !!settlementReport && settlementReport.length > 0 }
  );

  const { data: paymentHistory, isLoading: paymentHistoryLoading } = trpc.driver.payments.useQuery(
    { driverId: settlementDetailDriver?.id ?? 0 },
    { enabled: !!settlementDetailDriver }
  );

  const addPayment = trpc.driver.addPayment.useMutation({
    onSuccess: () => {
      toast.success("지급이 등록되었습니다.");
      setShowPaymentForm(false);
      setPaymentForm({ amount: "", companyName: "", memo: "", paidAt: new Date().toISOString().slice(0, 10) });
      utils.driver.settlementSummary.invalidate();
      utils.driver.payments.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleAddPayment = () => {
    if (!settlementDetailDriver) return;
    const amt = Number(paymentForm.amount);
    if (!amt || amt <= 0) return toast.error("지급 금액을 입력하세요.");
    if (!paymentForm.companyName.trim()) return toast.error("업체명을 입력하세요.");
    addPayment.mutate({
      driverId: settlementDetailDriver.id,
      amount: amt,
      companyName: paymentForm.companyName,
      paidAt: paymentForm.paidAt,
      memo: paymentForm.memo || undefined,
    });
  };

  // 기존 호환용 (사용 안 함)
  const paymentDialogDriver = null;
  const paymentDetailDriver = null;

  // PIN 초기화 상태
  const [pinResetDriver, setPinResetDriver] = useState<{ id: number; name: string } | null>(null);
  const [pinResetValue, setPinResetValue] = useState("");

  // 기사 정보 편집 상태
  const [editDriver, setEditDriver] = useState<{
    id: number;
    name: string;
    phone: string;
    vehicleNumber: string;
    vehicleType: string;
    affiliation: string;
  } | null>(null);

  // 상태 카드 클릭 시 기사 목록 Sheet
  const [statusSheetKey, setStatusSheetKey] = useState<"idle" | "driving" | "repair" | null>(null);

  // 기사 사진 수정 상태
  const [photoEditDriverId, setPhotoEditDriverId] = useState<number | null>(null);
  const [photoEditUploading, setPhotoEditUploading] = useState(false);
  const photoEditInputRef = useRef<HTMLInputElement>(null);

  // 사진 미등록 기사 필터
  const [showNoPhotoOnly, setShowNoPhotoOnly] = useState(false);

  // 배차 상태 필터 (전체 / pending / confirmed / completed / cancelled)
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // 배차 목록 정렬
  type SortKey = "createdAt" | "arrivalDeadline" | "totalAmount" | "driverName";
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  // 배차 취소/삭제 확인 다이얼로그
  const [cancelConfirmId, setCancelConfirmId] = useState<number | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  const [editDispatchId, setEditDispatchId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    pickupLocation: "",
    dropoffLocation: "",
    unitPrice: "",
    memo: "",
    arrivalDeadline: "",
  });

  const handlePhotoEdit = async (driverId: number, file: File) => {
    setPhotoEditUploading(true);
    try {
      const formData = new FormData();
      formData.append("driverId", String(driverId));
      formData.append("photo", file);
      const res = await fetch("/api/driver/upload-vehicle-photo", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) throw new Error("업로드 실패");
      toast.success("차량 사진이 업데이트되었습니다.");
      utils.driver.list.invalidate();
    } catch {
      toast.error("사진 업로드에 실패했습니다.");
    } finally {
      setPhotoEditUploading(false);
      setPhotoEditDriverId(null);
    }
  };

  // CSV 내보내기
  const handleExportCSV = () => {
    if (!settlementSummaryAll || settlementSummaryAll.length === 0) {
      toast.error("내보낼 데이터가 없습니다.");
      return;
    }
    // 엑셀에서 안전하게 표시되도록 쉼표/줄바꿈 포함 값은 따옴표로 감싸기
    const escapeCell = (v: string | number) => {
      const s = String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const header = ["기사명", "차량번호", "소속", "은행명", "계좌번호", "예금주", "총매출(원)", "지급된금액(원)", "남은금액(원)"];
    const rows = (settlementSummaryAll as any[]).map((r) => [
      r.driverName,
      r.vehicleNumber ?? "",
      r.affiliation ?? "",
      r.bankName ?? "",
      r.accountNumber ?? "",
      r.accountHolder ?? "",
      r.totalEarned,
      r.totalPaid,
      r.remaining,
    ]);
    const csv = [header, ...rows]
      .map((row) => row.map(escapeCell).join(","))
      .join("\n");
    // BOM(﻿) 삽입 - 엑셀에서 한글 깨짐 방지
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `정산내역_${reportYear}년${String(reportMonth).padStart(2, "0")}월.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`${reportYear}년 ${reportMonth}월 정산내역 CSV가 다운로드되었습니다.`);
  };

  // 관리자 비밀번호 게이트 화면
  if (!adminAuthed) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "oklch(0.97 0.006 240)", fontFamily: "'Noto Sans KR', 'Inter', sans-serif" }}
      >
        <div
          className="w-full max-w-sm rounded-2xl p-8 shadow-lg"
          style={{ background: "#fff", border: "1px solid oklch(0.90 0.01 240)" }}
        >
          <div className="flex flex-col items-center mb-6">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
              style={{ background: "oklch(0.20 0.04 250)" }}
            >
              <Shield className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-xl font-bold" style={{ color: "oklch(0.20 0.04 250)" }}>관리자 로그인</h1>
            <p className="text-sm mt-1" style={{ color: "oklch(0.50 0.02 240)" }}>비밀번호를 입력하세요</p>
          </div>
          <div className="space-y-3">
            <Input
              type="password"
              placeholder="비밀번호"
              value={adminPwInput}
              onChange={(e) => setAdminPwInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdminLogin()}
              className="h-11 text-base"
              autoFocus
              disabled={adminPwLoading}
            />
            {adminPwError && (
              <p className="text-sm text-red-500 text-center">{adminPwError}</p>
            )}
            <Button
              className="w-full h-11 font-semibold text-base"
              style={{ background: "oklch(0.20 0.04 250)" }}
              onClick={handleAdminLogin}
              disabled={adminPwLoading}
            >
              {adminPwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "입장"}
            </Button>
          </div>
          <button
            className="mt-4 w-full text-sm text-center"
            style={{ color: "oklch(0.55 0.02 240)" }}
            onClick={() => { navigate("/"); }}
          >
            ← 홈으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "oklch(0.97 0.006 240)",
        fontFamily: "'Noto Sans KR', 'Inter', sans-serif",
      }}
    >
      {/* Top Navigation */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4" style={NAV_STYLE}>
          <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
            style={{ background: "oklch(0.78 0.12 75)" }}
          >
            <Shield className="w-4 h-4" style={{ color: "oklch(0.15 0.02 240)" }} />
          </div>
          <div>
            <span className="text-xs sm:text-sm font-bold" style={{ color: "oklch(0.96 0.005 240)" }}>
              관리자 대시보드
            </span>
            <span
              className="hidden sm:inline ml-2 text-xs px-2 py-0.5 rounded-full"
              style={{
                background: "oklch(0.78 0.12 75 / 0.15)",
                color: "oklch(0.78 0.12 75)",
              }}
            >
              Admin
            </span>
          </div>
        </div>
          <div className="flex items-center gap-2">
          <div
            className="hidden sm:flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full"
            style={{
              background: "oklch(0.55 0.18 155 / 0.12)",
              color: "oklch(0.65 0.15 155)",
              border: "1px solid oklch(0.55 0.18 155 / 0.25)",
            }}
          >
            <RefreshCw className="w-3 h-3 animate-spin" style={{ animationDuration: "3s" }} />
            자동 갱신
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { setChangePwOpen(true); setChangePwForm({ current: "", newPw: "", confirm: "" }); setChangePwError(""); }}
            className="gap-1.5 text-xs h-8 px-2 sm:px-3"
            style={{ color: "oklch(0.65 0.02 240)" }}
            title="비밀번호 변경"
          >
            <Pencil className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">비밀번호 변경</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLogout}
            className="gap-1.5 text-xs h-8 px-2 sm:px-3"
            style={{ color: "oklch(0.65 0.02 240)" }}
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">나가기</span>
          </Button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
        {/* 페이지 헤더 */}
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: "oklch(0.12 0.02 240)" }}>배차 관리</h1>
            <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.02 240)" }}>기사 현황 확인 및 직접배차 생성</p>
          </div>
        </div>

        {/* 통계 카드 — 4+3 통합 그리드 */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-3">
          {[
            { label: "대기", value: pendingCount, accent: "oklch(0.48 0.16 55)", icon: <Clock className="w-4 h-4" /> },
            { label: "확인", value: confirmedCount, accent: "oklch(0.38 0.15 155)", icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: "완료", value: completedCount, accent: "oklch(0.35 0.12 250)", icon: <CheckCircle2 className="w-4 h-4" /> },
            { label: "정산금액", value: totalSettlement > 0 ? totalSettlement.toLocaleString() + "원" : "-", accent: "oklch(0.35 0.10 145)", icon: <span className="text-sm font-bold">₩</span> },
          ].map(({ label, value, accent, icon }) => (
            <div key={label} className="rounded-xl px-4 py-3 flex items-center gap-3" style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.90 0.008 240)", boxShadow: "0 1px 3px oklch(0.15 0.02 240 / 0.05)" }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: `${accent} / 0.1`, color: accent }}>
                {icon}
              </div>
              <div>
                <p className="text-lg font-bold leading-tight" style={{ color: "oklch(0.12 0.02 240)" }}>{value}</p>
                <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>{label}</p>
              </div>
            </div>
          ))}
        </div>
        {/* 기사 상태 요약 — 컴팩트 인라인 배지 */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-xs font-medium" style={{ color: "oklch(0.55 0.02 240)" }}>기사 현황</span>
          {([
            { key: "idle" as const, value: idleCount },
            { key: "driving" as const, value: drivingCount },
            { key: "repair" as const, value: repairCount },
          ]).map(({ key, value }) => {
            const cfg = ADMIN_STATUS_CONFIG[key];
            const { Icon } = cfg;
            return (
              <button
                key={key}
                onClick={() => setStatusSheetKey(key)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-150 hover:scale-105 hover:brightness-110 active:scale-95 cursor-pointer"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
                title={`${cfg.label} 기사 목록 보기`}
              >
                <Icon className="w-3 h-3" />
                {cfg.label} {value}
                {key === "repair" && value > 0 && <AlertTriangle className="w-3 h-3" />}
              </button>
            );
          })}
        </div>

        {/* Tabs */}
        <Tabs defaultValue="dispatches">
          {/* 탭 메뉴 + 액션 버튼 통합 카드 */}
          <div
            className="rounded-2xl px-3 sm:px-4 py-3 mb-4 flex flex-col gap-3"
            style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.90 0.008 240)", boxShadow: "0 1px 4px oklch(0.15 0.02 240 / 0.06)" }}
          >
            {/* 탭 메뉴 - 각 탭별 고유 색상으로 시각적 구분 */}
            <div className="w-full">
              <TabsList className="h-auto p-0 gap-2 bg-transparent flex flex-wrap w-full">

                {/* 직접배차 목록 - 오렌지 */}
                <TabsTrigger
                  value="dispatches"
                  className="relative gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 transition-all duration-200 active:scale-95 flex-1 sm:flex-none"
                  style={{
                    background: 'oklch(0.97 0.04 55)',
                    borderColor: 'oklch(0.82 0.12 55)',
                    color: 'oklch(0.45 0.18 50)',
                  }}
                  data-color="orange"
                  onFocus={() => {}}
                  ref={(el) => {
                    if (!el) return;
                    const update = () => {
                      const active = el.dataset.state === 'active';
                      el.style.background = active ? 'linear-gradient(135deg, oklch(0.72 0.20 55), oklch(0.58 0.22 40))' : 'oklch(0.97 0.04 55)';
                      el.style.borderColor = active ? 'transparent' : 'oklch(0.82 0.12 55)';
                      el.style.color = active ? 'oklch(0.99 0 0)' : 'oklch(0.45 0.18 50)';
                      el.style.boxShadow = active ? '0 4px 12px oklch(0.65 0.20 55 / 0.40)' : 'none';
                    };
                    update();
                    const obs = new MutationObserver(update);
                    obs.observe(el, { attributes: true, attributeFilter: ['data-state'] });
                  }}
                >
                  <ClipboardList className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden xs:inline">직접배차 </span>목록
                  {pendingCount > 0 && (
                    <span className="ml-0.5 text-xs font-black px-1.5 py-0.5 rounded-full" style={{ background: 'oklch(0.60 0.22 40)', color: 'white' }}>
                      {pendingCount}
                    </span>
                  )}
                </TabsTrigger>

                {/* 기사 관리 - 파란 */}
                <TabsTrigger
                  value="drivers"
                  className="relative gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 transition-all duration-200 active:scale-95 flex-1 sm:flex-none"
                  style={{
                    background: 'oklch(0.96 0.04 250)',
                    borderColor: 'oklch(0.75 0.14 250)',
                    color: 'oklch(0.38 0.18 250)',
                  }}
                  ref={(el) => {
                    if (!el) return;
                    const update = () => {
                      const active = el.dataset.state === 'active';
                      el.style.background = active ? 'linear-gradient(135deg, oklch(0.55 0.18 250), oklch(0.42 0.20 265))' : 'oklch(0.96 0.04 250)';
                      el.style.borderColor = active ? 'transparent' : 'oklch(0.75 0.14 250)';
                      el.style.color = active ? 'oklch(0.99 0 0)' : 'oklch(0.38 0.18 250)';
                      el.style.boxShadow = active ? '0 4px 12px oklch(0.55 0.18 250 / 0.40)' : 'none';
                    };
                    update();
                    const obs = new MutationObserver(update);
                    obs.observe(el, { attributes: true, attributeFilter: ['data-state'] });
                  }}
                >
                  <Users className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  기사 관리
                </TabsTrigger>

                {/* 정산 관리 - 초록 */}
                <TabsTrigger
                  value="settlement"
                  className="relative gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 transition-all duration-200 active:scale-95 flex-1 sm:flex-none"
                  style={{
                    background: 'oklch(0.96 0.05 155)',
                    borderColor: 'oklch(0.72 0.15 155)',
                    color: 'oklch(0.36 0.18 155)',
                  }}
                  ref={(el) => {
                    if (!el) return;
                    const update = () => {
                      const active = el.dataset.state === 'active';
                      el.style.background = active ? 'linear-gradient(135deg, oklch(0.55 0.18 155), oklch(0.44 0.20 165))' : 'oklch(0.96 0.05 155)';
                      el.style.borderColor = active ? 'transparent' : 'oklch(0.72 0.15 155)';
                      el.style.color = active ? 'oklch(0.99 0 0)' : 'oklch(0.36 0.18 155)';
                      el.style.boxShadow = active ? '0 4px 12px oklch(0.55 0.18 155 / 0.40)' : 'none';
                    };
                    update();
                    const obs = new MutationObserver(update);
                    obs.observe(el, { attributes: true, attributeFilter: ['data-state'] });
                  }}
                >
                  <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  정산 관리
                </TabsTrigger>

                {/* 작업일지 - 보라 */}
                <TabsTrigger
                  value="worklogs"
                  className="relative gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 transition-all duration-200 active:scale-95 flex-1 sm:flex-none"
                  style={{
                    background: 'oklch(0.96 0.04 310)',
                    borderColor: 'oklch(0.74 0.14 310)',
                    color: 'oklch(0.38 0.18 310)',
                  }}
                  ref={(el) => {
                    if (!el) return;
                    const update = () => {
                      const active = el.dataset.state === 'active';
                      el.style.background = active ? 'linear-gradient(135deg, oklch(0.55 0.18 310), oklch(0.44 0.20 295))' : 'oklch(0.96 0.04 310)';
                      el.style.borderColor = active ? 'transparent' : 'oklch(0.74 0.14 310)';
                      el.style.color = active ? 'oklch(0.99 0 0)' : 'oklch(0.38 0.18 310)';
                      el.style.boxShadow = active ? '0 4px 12px oklch(0.55 0.18 310 / 0.40)' : 'none';
                    };
                    update();
                    const obs = new MutationObserver(update);
                    obs.observe(el, { attributes: true, attributeFilter: ['data-state'] });
                  }}
                >
                  <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  작업일지
                  {workLogs && workLogs.length > 0 && (
                    <span className="ml-0.5 text-xs font-black px-1.5 py-0.5 rounded-full" style={{ background: 'oklch(0.44 0.20 295)', color: 'white' }}>
                      {workLogs.length}
                    </span>
                  )}
                </TabsTrigger>

                {/* 알림 발송 - 인디고 */}
                <TabsTrigger
                  value="notifications"
                  className="relative gap-1 sm:gap-1.5 text-xs sm:text-sm font-bold px-2.5 sm:px-4 py-2 sm:py-2.5 rounded-xl border-2 transition-all duration-200 active:scale-95 flex-1 sm:flex-none"
                  style={{
                    background: 'oklch(0.96 0.04 280)',
                    borderColor: 'oklch(0.74 0.14 280)',
                    color: 'oklch(0.38 0.18 280)',
                  }}
                  ref={(el) => {
                    if (!el) return;
                    const update = () => {
                      const active = el.dataset.state === 'active';
                      el.style.background = active ? 'linear-gradient(135deg, oklch(0.55 0.18 280), oklch(0.44 0.20 265))' : 'oklch(0.96 0.04 280)';
                      el.style.borderColor = active ? 'transparent' : 'oklch(0.74 0.14 280)';
                      el.style.color = active ? 'oklch(0.99 0 0)' : 'oklch(0.38 0.18 280)';
                      el.style.boxShadow = active ? '0 4px 12px oklch(0.55 0.18 280 / 0.40)' : 'none';
                    };
                    update();
                    const obs = new MutationObserver(update);
                    obs.observe(el, { attributes: true, attributeFilter: ['data-state'] });
                  }}
                >
                  <MessageSquare className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  알림 발송
                </TabsTrigger>

              </TabsList>
            </div>
            {/* 액션 버튼 - 모바일에서 탭 아래 전체 너비로 배치 */}
            <div className="flex gap-2 w-full sm:w-auto">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDriverDialogOpen(true)}
                className="gap-2 h-9 flex-1 sm:flex-none"
              >
                <Plus className="w-4 h-4" />
                기사 등록
              </Button>
              <Button
                size="sm"
                onClick={() => setDispatchDialogOpen(true)}
                className="gap-2 h-9 font-semibold flex-1 sm:flex-none"
                style={{ background: "oklch(0.28 0.07 250)", color: "oklch(0.98 0.005 240)" }}
              >
                <Truck className="w-4 h-4" />
                직접배차 생성
              </Button>
            </div>
          </div>

          {/* 직접배차 목록 탭 */}
          <TabsContent value="dispatches">
            {/* 필터 영역 */}
            <div className="rounded-2xl mb-3 p-4" style={CARD_STYLE}>
              <div className="flex flex-wrap gap-3 items-end">
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: "oklch(0.45 0.04 240)" }}>시작일</label>
                  <input
                    type="date"
                    className="h-9 px-3 rounded-lg border text-sm"
                    style={{ borderColor: "oklch(0.85 0.01 240)", background: "oklch(1 0 0)", color: "oklch(0.15 0.02 240)" }}
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: "oklch(0.45 0.04 240)" }}>종료일</label>
                  <input
                    type="date"
                    className="h-9 px-3 rounded-lg border text-sm"
                    style={{ borderColor: "oklch(0.85 0.01 240)", background: "oklch(1 0 0)", color: "oklch(0.15 0.02 240)" }}
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: "oklch(0.45 0.04 240)" }}>기사 선택</label>
                  <select
                    className="h-9 px-3 rounded-lg border text-sm"
                    style={{ borderColor: "oklch(0.85 0.01 240)", background: "oklch(1 0 0)", color: "oklch(0.15 0.02 240)" }}
                    value={filterDriverId ?? ""}
                    onChange={(e) => setFilterDriverId(e.target.value ? Number(e.target.value) : undefined)}
                  >
                    <option value="">전체 기사</option>
                    {drivers?.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-medium" style={{ color: "oklch(0.45 0.04 240)" }}>배차 상태</label>
                  <select
                    className="h-9 px-3 rounded-lg border text-sm"
                    style={{ borderColor: "oklch(0.85 0.01 240)", background: "oklch(1 0 0)", color: "oklch(0.15 0.02 240)" }}
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">전체 상태</option>
                    <option value="pending">대기</option>
                    <option value="confirmed">확인</option>
                    <option value="completed">완료</option>
                    <option value="cancelled">취소</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="gap-1.5 h-9"
                    style={{ background: "oklch(0.28 0.07 250)", color: "oklch(0.98 0.005 240)" }}
                    onClick={() => setFilterEnabled(true)}
                  >
                    <Filter className="w-3.5 h-3.5" />
                    필터 적용
                  </Button>
                  {(filterEnabled || statusFilter !== "all") && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-9"
                      onClick={() => {
                        setFilterStartDate("");
                        setFilterEndDate("");
                        setFilterDriverId(undefined);
                        setFilterEnabled(false);
                        setStatusFilter("all");
                        setSortKey("createdAt");
                        setSortDir("desc");
                      }}
                    >
                      <FilterX className="w-3.5 h-3.5" />
                      초기화
                    </Button>
                  )}
                </div>
              </div>
              {(filterEnabled || statusFilter !== "all") && (
                <p className="text-xs mt-2" style={{ color: "oklch(0.55 0.18 250)" }}>
                  {filterEnabled && <>필터 적용 중 — {filteredOrders?.length ?? 0}건 조회됨{statusFilter !== "all" && " / "}</>}
                  {statusFilter !== "all" && (
                    <>상태 필터: <strong>{{ pending: "대기", confirmed: "확인", completed: "완료", cancelled: "취소" }[statusFilter]}</strong>
                    </>)}
                </p>
              )}
            </div>
            <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
              {filterEnabled ? (
                filteredLoading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.28 0.07 250)" }} />
                  </div>
                ) : !filteredOrders || filteredOrders.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <ClipboardList className="w-10 h-10" style={{ color: "oklch(0.75 0.01 240)" }} />
                    <p className="text-sm font-medium" style={{ color: "oklch(0.35 0.02 240)" }}>필터 조건에 맞는 배차가 없습니다.</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                  <table className="w-full" style={{ minWidth: "600px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid oklch(0.92 0.008 240)", background: "oklch(0.985 0.004 240)" }}>
                        {["배차번호", "기사", "경로", "단가/회차", "상태", "생성일시"].map((h) => (
                          <th key={h} className="px-5 py-3 text-left text-xs font-semibold" style={{ color: "oklch(0.45 0.04 240)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...filteredOrders].sort((a: any, b: any) => {
                        let av: any, bv: any;
                        if (sortKey === "createdAt") { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
                        else if (sortKey === "arrivalDeadline") { av = a.arrivalDeadline ? new Date(a.arrivalDeadline).getTime() : (sortDir === "asc" ? Infinity : -Infinity); bv = b.arrivalDeadline ? new Date(b.arrivalDeadline).getTime() : (sortDir === "asc" ? Infinity : -Infinity); }
                        else if (sortKey === "totalAmount") { av = a.totalAmount ?? 0; bv = b.totalAmount ?? 0; }
                        else if (sortKey === "driverName") { const an = a.driver?.name ?? ""; const bn = b.driver?.name ?? ""; return sortDir === "asc" ? an.localeCompare(bn, "ko") : bn.localeCompare(an, "ko"); }
                        return sortDir === "asc" ? av - bv : bv - av;
                      }).map((d: any, idx: number, arr: any[]) => (
                        <tr key={d.id} className="transition-colors hover:bg-[oklch(0.97_0.006_240)]" style={{ borderBottom: idx < filteredOrders.length - 1 ? "1px solid oklch(0.94 0.006 240)" : "none" }}>
                          <td className="px-5 py-4"><span className="text-xs font-mono font-semibold px-2 py-1 rounded" style={{ background: "oklch(0.94 0.01 240)", color: "oklch(0.35 0.04 250)" }}>#{String(d.id).padStart(4, "0")}</span></td>
                          <td className="px-5 py-4"><span className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 240)" }}>{(d as any).driver?.name ?? "알 수 없음"}</span></td>
                          <td className="px-5 py-4">
                            <p className="text-xs" style={{ color: "oklch(0.30 0.03 240)" }}>{d.pickupLocation} → {d.dropoffLocation}</p>
                            {(d as any).memo && <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.02 240)" }}>메모: {(d as any).memo}</p>}
                          </td>
                          <td className="px-5 py-4">{d.unitPrice != null && d.unitPrice > 0 ? <span className="text-xs font-semibold" style={{ color: "oklch(0.38 0.10 145)" }}>{d.unitPrice.toLocaleString()}원{d.tripCount != null && ` × ${d.tripCount}회`}</span> : <span className="text-xs" style={{ color: "oklch(0.65 0.02 240)" }}>-</span>}</td>
                          <td className="px-5 py-4">{d.approvalStatus === "completed" ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "oklch(0.55 0.18 250 / 0.12)", color: "oklch(0.32 0.12 250)", border: "1px solid oklch(0.55 0.18 250 / 0.3)" }}><CheckCircle2 className="w-3 h-3" />완료</span> : d.approvalStatus === "confirmed" ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "oklch(0.55 0.18 155 / 0.12)", color: "oklch(0.38 0.15 155)", border: "1px solid oklch(0.55 0.18 155 / 0.3)" }}><CheckCircle2 className="w-3 h-3" />확인</span> : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "oklch(0.65 0.18 55 / 0.12)", color: "oklch(0.48 0.16 55)", border: "1px solid oklch(0.65 0.18 55 / 0.3)" }}><Clock className="w-3 h-3" />대기</span>}</td>
                          <td className="px-5 py-4"><p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>{new Date(d.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</p></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                )
              ) : dispatchesLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.28 0.07 250)" }} />
                </div>
              ) : !dispatches || dispatches.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <ClipboardList className="w-10 h-10" style={{ color: "oklch(0.75 0.01 240)" }} />
                  <p className="text-sm font-medium" style={{ color: "oklch(0.35 0.02 240)" }}>
                    아직 배차 내역이 없습니다.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setDispatchDialogOpen(true)}
                    style={{ background: "oklch(0.28 0.07 250)", color: "oklch(0.98 0.005 240)" }}
                  >
                    첫 직접배차 생성하기
                  </Button>
                </div>
              ) : (
                <>
                {/* 정렬된 배차 목록 */}
                {(() => {
                  const base = statusFilter !== "all"
                    ? dispatches.filter((d) => d.approvalStatus === statusFilter)
                    : [...dispatches];
                  const sorted = base.sort((a: any, b: any) => {
                    let av: any, bv: any;
                    if (sortKey === "createdAt") { av = new Date(a.createdAt).getTime(); bv = new Date(b.createdAt).getTime(); }
                    else if (sortKey === "arrivalDeadline") { av = a.arrivalDeadline ? new Date(a.arrivalDeadline).getTime() : (sortDir === "asc" ? Infinity : -Infinity); bv = b.arrivalDeadline ? new Date(b.arrivalDeadline).getTime() : (sortDir === "asc" ? Infinity : -Infinity); }
                    else if (sortKey === "totalAmount") { av = a.totalAmount ?? 0; bv = b.totalAmount ?? 0; }
                    else if (sortKey === "driverName") { av = a.driver?.name ?? ""; bv = b.driver?.name ?? ""; return sortDir === "asc" ? av.localeCompare(bv, "ko") : bv.localeCompare(av, "ko"); }
                    return sortDir === "asc" ? av - bv : bv - av;
                  });
                  return (
                    <>
                {/* 모바일 카드 뷰 */}
                <div className="block sm:hidden divide-y" style={{ borderColor: "oklch(0.94 0.006 240)" }}>
                  {sorted.map((d: any) => {
                    const urgency = getDeadlineUrgency((d as any).arrivalDeadline);
                    const isCompleted = d.approvalStatus === "completed";
                    const isCancelled = d.approvalStatus === "cancelled";
                    const cardBg = isCancelled ? "oklch(0.92 0.005 240 / 0.5)" : !isCompleted && urgency === "overdue" ? "oklch(0.62 0.22 25 / 0.04)" : !isCompleted && urgency === "urgent" ? "oklch(0.65 0.18 55 / 0.04)" : "transparent";
                    return (
                      <div key={d.id} className="px-4 py-4" style={{ background: cardBg, opacity: isCancelled ? 0.6 : 1 }}>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-semibold px-2 py-1 rounded" style={{ background: "oklch(0.94 0.01 240)", color: "oklch(0.35 0.04 250)" }}>#{String(d.id).padStart(4, "0")}</span>
                            <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "oklch(0.28 0.07 250 / 0.1)", color: "oklch(0.28 0.07 250)" }}>{d.driver?.name?.[0] ?? "?"}</div>
                            <span className="text-sm font-semibold" style={{ color: isCancelled ? "oklch(0.60 0.02 240)" : "oklch(0.15 0.02 240)" }}>{d.driver?.name ?? "알 수 없음"}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            {isCancelled ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ background: "oklch(0.75 0.01 240 / 0.3)", color: "oklch(0.50 0.02 240)", border: "1px solid oklch(0.75 0.01 240)" }}><Ban className="w-3 h-3" />취소</span>
                            ) : d.approvalStatus === "pending" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ background: "oklch(0.65 0.18 55 / 0.12)", color: "oklch(0.48 0.16 55)", border: "1px solid oklch(0.65 0.18 55 / 0.3)" }}><Clock className="w-3 h-3" />대기</span>
                            ) : d.approvalStatus === "completed" ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ background: "oklch(0.55 0.18 250 / 0.12)", color: "oklch(0.32 0.12 250)", border: "1px solid oklch(0.55 0.18 250 / 0.3)" }}><CheckCircle2 className="w-3 h-3" />완료</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold flex-shrink-0" style={{ background: "oklch(0.55 0.18 155 / 0.12)", color: "oklch(0.38 0.15 155)", border: "1px solid oklch(0.55 0.18 155 / 0.3)" }}><CheckCircle2 className="w-3 h-3" />확인</span>
                            )}
                            {/* 편집/취소/삭제 버튼 */}
                            {!isCancelled && !isCompleted && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" style={{ color: "oklch(0.38 0.14 250)" }} title="배차 수정" onClick={() => openEditModal(d as any)}>
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            {!isCancelled && !isCompleted && (
                              <Button variant="ghost" size="sm" className="h-6 w-6 p-0" style={{ color: "oklch(0.52 0.22 25)" }} title="배차 취소" onClick={() => setCancelConfirmId(d.id)}>
                                <Ban className="w-3.5 h-3.5" />
                              </Button>
                            )}
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" title="배차 삭제" onClick={() => setDeleteConfirmId(d.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="text-xs mb-1" style={{ color: isCancelled ? "oklch(0.60 0.02 240)" : "oklch(0.30 0.03 240)" }}>
                          <span style={{ color: isCancelled ? "oklch(0.65 0.02 240)" : "oklch(0.55 0.18 250)" }}>출발</span> {d.pickupLocation} → <span style={{ color: isCancelled ? "oklch(0.65 0.02 240)" : "oklch(0.38 0.15 155)" }}>도착</span> {d.dropoffLocation}
                        </div>
                        {!isCancelled && (d as any).arrivalDeadline && (() => {
                          const deadlineColor = !isCompleted && urgency === "overdue" ? "oklch(0.52 0.22 25)" : !isCompleted && urgency === "urgent" ? "oklch(0.48 0.18 55)" : "oklch(0.55 0.04 240)";
                          return <p className="text-xs font-medium" style={{ color: deadlineColor }}>{!isCompleted && urgency === "overdue" && "⚠ 기한초과 "}{!isCompleted && urgency === "urgent" && "⏰ 임박 "}{formatArrivalDeadlineKorean(new Date((d as any).arrivalDeadline).toISOString())}까지</p>;
                        })()}
                        <div className="flex items-center justify-between mt-1">
                          {d.unitPrice != null && d.unitPrice > 0 ? (
                            <span className="text-xs font-semibold" style={{ color: isCancelled ? "oklch(0.60 0.02 240)" : "oklch(0.38 0.10 145)" }}>{d.unitPrice.toLocaleString()}원/회{d.tripCount != null && ` × ${d.tripCount}회`}</span>
                          ) : <span />}
                          <span className="text-xs" style={{ color: "oklch(0.60 0.02 240)" }}>{new Date(d.createdAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {/* 데스크톱 테이블 뷰 */}
                <div className="hidden sm:block overflow-x-auto">
                <table className="w-full" style={{ minWidth: "700px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(0.92 0.008 240)", background: "oklch(0.985 0.004 240)" }}>
                      {/* 정렬 불가 컨럼 */}
                      {["배차번호", "경로", "승인 상태"].map((h) => (
                        <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.52 0.02 240)" }}>{h}</th>
                      ))}
                      {/* 정렬 가능 컨럼 */}
                      {([
                        { key: "driverName" as const, label: "기사" },
                        { key: "totalAmount" as const, label: "단가/회차" },
                        { key: "arrivalDeadline" as const, label: "도착기한" },
                        { key: "createdAt" as const, label: "생성일시" },
                      ] as { key: SortKey; label: string }[]).map(({ key, label }) => (
                        <th key={key} className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider cursor-pointer select-none" style={{ color: sortKey === key ? "oklch(0.28 0.07 250)" : "oklch(0.52 0.02 240)" }} onClick={() => handleSort(key)}>
                          <span className="inline-flex items-center gap-1">
                            {label}
                            {sortKey === key ? (sortDir === "asc" ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : <ChevronsUpDown className="w-3 h-3 opacity-40" />}
                          </span>
                        </th>
                      ))}
                      <th className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider" style={{ color: "oklch(0.52 0.02 240)" }}>관리</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((d: any, idx: number, arr: any[]) => {
                      const isCancelled = d.approvalStatus === "cancelled";
                      const isCompleted = d.approvalStatus === "completed";
                      return (
                      <tr
                        key={d.id}
                        className="transition-colors"
                        style={{
                          borderBottom:
                            idx < arr.length - 1
                              ? "1px solid oklch(0.94 0.006 240)"
                              : "none",
                          opacity: isCancelled ? 0.55 : 1,
                          background: (() => {
                            if (isCancelled) return "oklch(0.93 0.005 240 / 0.5)";
                            const urgency = getDeadlineUrgency((d as any).arrivalDeadline);
                            if (urgency === "overdue" && !isCompleted) return "oklch(0.62 0.22 25 / 0.05)";
                            if (urgency === "urgent" && !isCompleted) return "oklch(0.65 0.18 55 / 0.05)";
                            if (d.approvalStatus === "pending") return "oklch(0.65 0.18 55 / 0.02)";
                            return "transparent";
                          })(),
                        }}
                      >
                        <td className="px-5 py-4">
                          <span
                            className="text-xs font-mono font-semibold px-2 py-1 rounded"
                            style={{
                              background: "oklch(0.94 0.01 240)",
                              color: "oklch(0.35 0.04 250)",
                            }}
                          >
                            #{String(d.id).padStart(4, "0")}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                              style={{
                                background: "oklch(0.28 0.07 250 / 0.1)",
                                color: "oklch(0.28 0.07 250)",
                              }}
                            >
                              {d.driver?.name?.[0] ?? "?"}
                            </div>
                            <div>
                              <p className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 240)" }}>
                                {d.driver?.name ?? "알 수 없음"}
                              </p>
                              <p className="text-xs" style={{ color: "oklch(0.52 0.02 240)" }}>
                                {d.driver?.vehicleNumber ?? ""}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.55 0.18 250)" }} />
                              <span className="text-sm" style={{ color: "oklch(0.25 0.03 240)" }}>
                                {d.pickupLocation}
                              </span>
                            </div>
                            <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.65 0.02 240)" }} />
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.55 0.18 155)" }} />
                              <span className="text-sm" style={{ color: "oklch(0.25 0.03 240)" }}>
                                {d.dropoffLocation}
                              </span>
                            </div>
                          </div>
                          {d.memo && (
                            <p className="text-xs mt-1" style={{ color: "oklch(0.60 0.02 240)" }}>
                              메모: {d.memo}
                            </p>
                          )}
                          {(d as any).arrivalDeadline && (() => {
                            const urgency = getDeadlineUrgency((d as any).arrivalDeadline);
                            const isCompleted = d.approvalStatus === "completed";
                            const deadlineColor =
                              !isCompleted && urgency === "overdue" ? "oklch(0.52 0.22 25)" :
                              !isCompleted && urgency === "urgent" ? "oklch(0.48 0.18 55)" :
                              "oklch(0.55 0.04 240)";
                            const deadlineBg =
                              !isCompleted && urgency === "overdue" ? "oklch(0.62 0.22 25 / 0.10)" :
                              !isCompleted && urgency === "urgent" ? "oklch(0.65 0.18 55 / 0.10)" :
                              "transparent";
                            return (
                              <p
                                className="text-xs mt-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium"
                                style={{ color: deadlineColor, background: deadlineBg }}
                              >
                                <CalendarClock className="w-3 h-3 flex-shrink-0" />
                                {!isCompleted && urgency === "overdue" && <span className="font-bold">⚠ 기한초과 </span>}
                                {!isCompleted && urgency === "urgent" && <span className="font-bold">⏰ 임박 </span>}
                                {formatArrivalDeadlineKorean(new Date((d as any).arrivalDeadline).toISOString())}까지
                              </p>
                            );
                          })()}
                        </td>
                        {/* 단가/회차 컬럼 */}
                        <td className="px-5 py-4">
                          {d.unitPrice != null && d.unitPrice > 0 ? (
                            <div>
                              <p className="text-xs font-semibold" style={{ color: "oklch(0.38 0.10 145)" }}>
                                {d.unitPrice.toLocaleString()}원/회
                              </p>
                              {d.tripCount != null && (
                                <p className="text-xs mt-0.5" style={{ color: "oklch(0.45 0.08 145)" }}>
                                  {d.tripCount}회
                                  {d.totalAmount != null && d.totalAmount > 0 && (
                                    <span className="ml-1 font-bold">→ {d.totalAmount.toLocaleString()}원</span>
                                  )}
                                </p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: "oklch(0.70 0.01 240)" }}>-</span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          {isCancelled ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold" style={{ background: "oklch(0.75 0.01 240 / 0.3)", color: "oklch(0.50 0.02 240)", border: "1px solid oklch(0.75 0.01 240)" }}>
                              <Ban className="w-3 h-3" />취소
                            </span>
                          ) : d.approvalStatus === "pending" ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                              style={{
                                background: "oklch(0.65 0.18 55 / 0.12)",
                                color: "oklch(0.48 0.16 55)",
                                border: "1px solid oklch(0.65 0.18 55 / 0.3)",
                              }}
                            >
                              <Clock className="w-3 h-3" />
                              대기
                            </span>
                          ) : isCompleted ? (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                              style={{
                                background: "oklch(0.55 0.18 250 / 0.12)",
                                color: "oklch(0.32 0.12 250)",
                                border: "1px solid oklch(0.55 0.18 250 / 0.3)",
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              완료
                            </span>
                          ) : (
                            <span
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold"
                              style={{
                                background: "oklch(0.55 0.18 155 / 0.12)",
                                color: "oklch(0.38 0.15 155)",
                                border: "1px solid oklch(0.55 0.18 155 / 0.3)",
                              }}
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              확인
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>
                            {new Date(d.createdAt).toLocaleString("ko-KR", {
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                          {d.confirmedAt && (
                            <p className="text-xs mt-0.5 font-medium" style={{ color: "oklch(0.40 0.15 155)" }}>
                              승인:{" "}
                              {new Date(d.confirmedAt).toLocaleString("ko-KR", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                          {d.completedAt && (
                            <p className="text-xs mt-0.5 font-medium" style={{ color: "oklch(0.32 0.12 250)" }}>
                              완료:{" "}
                              {new Date(d.completedAt).toLocaleString("ko-KR", {
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            {!isCancelled && !isCompleted && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                style={{ color: "oklch(0.38 0.14 250)" }}
                                title="배차 수정"
                                onClick={() => openEditModal(d as any)}
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                            )}
                            {!isCancelled && !isCompleted && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                style={{ color: "oklch(0.52 0.22 25)" }}
                                title="배차 취소"
                                onClick={() => setCancelConfirmId(d.id)}
                              >
                                <Ban className="w-4 h-4" />
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="배차 삭제"
                              onClick={() => setDeleteConfirmId(d.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
                </div>
                </>
                  );
                })()}
              </>
              )}
            </div>
          </TabsContent>

          {/* 기사 관리 탭 */}
          <TabsContent value="drivers">
            {/* 이번 달 배차 일수 경고 요약 배너 */}
            {dispatchDayStats && (() => {
              const danger = dispatchDayStats.filter((s) => s.dispatchDaysThisMonth < 10);
              const warn = dispatchDayStats.filter((s) => s.dispatchDaysThisMonth >= 10 && s.dispatchDaysThisMonth < 20);
              if (danger.length === 0 && warn.length === 0) return null;
              return (
                <div className="mb-3 rounded-xl px-4 py-3 flex flex-wrap items-center gap-3"
                  style={{ background: "oklch(0.52 0.22 25 / 0.07)", border: "1px solid oklch(0.52 0.22 25 / 0.25)" }}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.52 0.22 25)" }} />
                  <span className="text-sm font-semibold" style={{ color: "oklch(0.35 0.12 25)" }}>
                    이번 달 배차 20일 미만 기사
                  </span>
                  {danger.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: "oklch(0.55 0.22 25)", color: "white" }}>
                      🚨 위험({danger.length}명) — {danger.map(s => s.driverName).join(', ')}
                    </span>
                  )}
                  {warn.length > 0 && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                      style={{ background: "oklch(0.75 0.16 60)", color: "oklch(0.20 0.06 60)" }}>
                      ⚠ 주의({warn.length}명) — {warn.map(s => s.driverName).join(', ')}
                    </span>
                  )}
                </div>
              );
            })()}
            {/* 사진 미등록 필터 */}
            {drivers && drivers.length > 0 && (
              <div className="mb-3 flex items-center gap-3">
                <Button
                  size="sm"
                  variant={showNoPhotoOnly ? "default" : "outline"}
                  className="gap-1.5 h-9"
                  style={showNoPhotoOnly ? { background: "oklch(0.52 0.22 25)", color: "oklch(0.98 0.005 240)" } : {}}
                  onClick={() => setShowNoPhotoOnly((v) => !v)}
                >
                  <Camera className="w-3.5 h-3.5" />
                  사진 미등록 기사만 보기
                  {(() => {
                    const cnt = drivers.filter((d) => !(d as any).vehiclePhotoUrl).length;
                    return cnt > 0 ? (
                      <span className="ml-1 text-xs font-bold px-1.5 py-0.5 rounded-full" style={{ background: "oklch(0.52 0.22 25 / 0.20)", color: showNoPhotoOnly ? "oklch(0.98 0.005 240)" : "oklch(0.52 0.22 25)" }}>{cnt}</span>
                    ) : null;
                  })()}
                </Button>
                {showNoPhotoOnly && (
                  <span className="text-xs" style={{ color: "oklch(0.52 0.22 25)" }}>
                    사진 미등록 기사 {drivers.filter((d) => !(d as any).vehiclePhotoUrl).length}명 표시 중
                  </span>
                )}
              </div>
            )}
            <div className="rounded-2xl overflow-hidden" style={CARD_STYLE}>
              {driversLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.28 0.07 250)" }} />
                </div>
              ) : !drivers || drivers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Users className="w-10 h-10" style={{ color: "oklch(0.75 0.01 240)" }} />
                  <p className="text-sm font-medium" style={{ color: "oklch(0.35 0.02 240)" }}>
                    등록된 기사가 없습니다.
                  </p>
                  <Button
                    size="sm"
                    onClick={() => setDriverDialogOpen(true)}
                    style={{ background: "oklch(0.28 0.07 250)", color: "oklch(0.98 0.005 240)" }}
                  >
                    기사 등록하기
                  </Button>
                </div>
              ) : (showNoPhotoOnly && drivers.filter((d) => !(d as any).vehiclePhotoUrl).length === 0) ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <Camera className="w-10 h-10" style={{ color: "oklch(0.75 0.01 240)" }} />
                  <p className="text-sm font-medium" style={{ color: "oklch(0.35 0.02 240)" }}>모든 기사가 차량 사진을 등록했습니다.</p>
                </div>
              ) : (
                <>
                {/* 모바일 카드 뷰 */}
                <div className="block sm:hidden divide-y" style={{ borderColor: "oklch(0.94 0.006 240)" }}>
                  {drivers.filter((d) => !showNoPhotoOnly || !(d as any).vehiclePhotoUrl).map((d) => {
                    const st = (d.status ?? "idle") as DriverStatusKey;
                    const cfg = ADMIN_STATUS_CONFIG[st];
                    const { Icon } = cfg;
                    const summary = driverMonthlySummary?.find((s) => s.driverId === d.id);
                    const hasNoPhoto = !(d as any).vehiclePhotoUrl;
                    const mDayStat = dispatchDayStats?.find((s) => s.driverId === d.id);
                    const mDispatchDays = mDayStat?.dispatchDaysThisMonth ?? null;
                    const mIsDanger = mDispatchDays !== null && mDispatchDays < 10;
                    const mIsWarn = mDispatchDays !== null && mDispatchDays >= 10 && mDispatchDays < 20;
                    return (
                      <div key={d.id} className="px-4 py-4" style={{
                        background: mIsDanger
                          ? "oklch(0.55 0.22 25 / 0.06)"
                          : mIsWarn
                          ? "oklch(0.75 0.16 60 / 0.06)"
                          : hasNoPhoto ? "oklch(0.52 0.22 25 / 0.04)" : undefined
                      }}>
                        {/* 사진 없음 경고 배지 */}
                        {hasNoPhoto && (
                          <div className="mb-2 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: "oklch(0.52 0.22 25 / 0.10)", border: "1px solid oklch(0.52 0.22 25 / 0.25)" }}>
                            <Camera className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "oklch(0.52 0.22 25)" }} />
                            <span className="text-xs font-semibold" style={{ color: "oklch(0.52 0.22 25)" }}>차량 사진 미등록</span>
                          </div>
                        )}
                        {/* 차량 사진 영역 (사진 있을 때만) */}
                        {(d as any).vehiclePhotoUrl && (
                          <div
                            className="mb-3 rounded-xl overflow-hidden cursor-pointer"
                            style={{ aspectRatio: "16/7", maxHeight: "140px" }}
                            onClick={() => setVehicleLightbox({ url: (d as any).vehiclePhotoUrl, name: `${d.name} 차량` })}
                          >
                            <img
                              src={(d as any).vehiclePhotoUrl}
                              alt={`${d.name} 차량 전면`}
                              className="w-full h-full object-cover hover:opacity-90 transition-opacity"
                            />
                          </div>
                        )}
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0" style={{ background: "oklch(0.28 0.07 250 / 0.1)", color: "oklch(0.28 0.07 250)" }}>{d.name[0]}</div>
                            <div>
                              <p className="text-sm font-bold" style={{ color: "oklch(0.15 0.02 240)" }}>{d.name}</p>
                              {d.affiliation && <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>{d.affiliation}</p>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                              <Icon className="w-3 h-3" />{cfg.label}
                            </span>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditDriver({
                                id: d.id,
                                name: d.name,
                                phone: d.phone ?? "",
                                vehicleNumber: d.vehicleNumber ?? "",
                                vehicleType: d.vehicleType ?? "",
                                affiliation: d.affiliation ?? "",
                              })}
                              className="h-7 w-7 p-0"
                              style={{ color: "oklch(0.55 0.12 250)" }}
                              title="기사 정보 편집"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => { if (confirm(`'${d.name}' 기사를 삭제하시겠습니까?`)) { deleteDriver.mutate({ id: d.id }); } }} className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10">
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs" style={{ color: "oklch(0.45 0.02 240)" }}>
                          {d.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{d.phone}</span>}
                          {d.vehicleNumber && <span className="flex items-center gap-1"><Car className="w-3 h-3" />{d.vehicleNumber}</span>}
                          {d.vehicleType && <span>{d.vehicleType}</span>}
                        </div>
                        {summary && (
                          <div className="mt-2 flex items-center gap-3 text-xs">
                            <span className="font-semibold" style={{ color: "oklch(0.28 0.07 250)" }}>{summary.totalDispatches}건 배차</span>
                            <span style={{ color: "oklch(0.38 0.12 145)" }}>완료 {summary.completedDispatches}건</span>
                            {summary.totalAmount > 0 && <span className="font-bold" style={{ color: "oklch(0.32 0.10 145)" }}>{summary.totalAmount.toLocaleString()}원</span>}
                          </div>
                        )}
                        {mDispatchDays !== null && (
                          <div className="mt-1.5">
                            {mIsDanger ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: "oklch(0.55 0.22 25)", color: "white" }}>
                                🚨 이번달 {mDispatchDays}일 배차 (위험)
                              </span>
                            ) : mIsWarn ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                                style={{ background: "oklch(0.75 0.16 60)", color: "oklch(0.20 0.06 60)" }}>
                                ⚠ 이번달 {mDispatchDays}일 배차 (주의)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                                style={{ background: "oklch(0.38 0.12 145 / 0.15)", color: "oklch(0.32 0.10 145)" }}>
                                ✓ 이번달 {mDispatchDays}일 배차
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {/* 데스크톱 테이블 뷰 */}
                <div className="hidden sm:block overflow-x-auto">
                <table className="w-full" style={{ minWidth: "750px" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid oklch(0.92 0.008 240)", background: "oklch(0.985 0.004 240)" }}>
                      {["이름", "상태", "연락처", "차량번호", "차종", "소속", "이번달 실적", "월평균 배차", "관리"].map((h) => (
                        <th
                          key={h}
                          className="text-left px-5 py-3.5 text-xs font-semibold uppercase tracking-wider"
                          style={{ color: "oklch(0.52 0.02 240)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {drivers.filter((d) => !showNoPhotoOnly || !(d as any).vehiclePhotoUrl).map((d, idx, arr) => {
                      const hasNoPhoto = !(d as any).vehiclePhotoUrl;
                      const dayStat = dispatchDayStats?.find((s) => s.driverId === d.id);
                      const dispatchDays = dayStat?.dispatchDaysThisMonth ?? null;
                      const isDanger = dispatchDays !== null && dispatchDays < 10;
                      const isWarn = dispatchDays !== null && dispatchDays >= 10 && dispatchDays < 20;
                      return (
                      <tr
                        key={d.id}
                        className="transition-colors hover:bg-[oklch(0.97_0.006_240)]"
                        style={{
                          borderBottom:
                            idx < arr.length - 1
                              ? "1px solid oklch(0.94 0.006 240)"
                              : "none",
                          background: isDanger
                            ? "oklch(0.55 0.22 25 / 0.06)"
                            : isWarn
                            ? "oklch(0.75 0.16 60 / 0.06)"
                            : hasNoPhoto ? "oklch(0.52 0.22 25 / 0.04)" : undefined,
                        }}
                      >
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-2.5">
                            {/* 차량 사진 또는 이니셔 아바타 */}
                            {(d as any).vehiclePhotoUrl ? (
                              <button
                                type="button"
                                onClick={() => setVehicleLightbox({ url: (d as any).vehiclePhotoUrl, name: `${d.name} 차량` })}
                                className="w-12 h-9 rounded-lg overflow-hidden flex-shrink-0 border transition-opacity hover:opacity-80"
                                style={{ borderColor: "oklch(0.85 0.02 240)" }}
                                title="차량 사진 확대보기"
                              >
                                <img
                                  src={(d as any).vehiclePhotoUrl}
                                  alt={`${d.name} 차량`}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            ) : (
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                                style={{ background: "oklch(0.52 0.22 25 / 0.15)", color: "oklch(0.52 0.22 25)" }}
                              >
                                {d.name[0]}
                              </div>
                            )}
                            <div>
                              <span className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 240)" }}>
                                {d.name}
                              </span>
                              {hasNoPhoto && (
                                <div className="flex items-center gap-1 mt-0.5">
                                  <Camera className="w-3 h-3" style={{ color: "oklch(0.52 0.22 25)" }} />
                                  <span className="text-xs font-semibold" style={{ color: "oklch(0.52 0.22 25)" }}>사진 없음</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {(() => {
                            const st = (d.status ?? "idle") as DriverStatusKey;
                            const cfg = ADMIN_STATUS_CONFIG[st];
                            const { Icon } = cfg;
                            return (
                              <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold"
                                style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
                              >
                                <Icon className="w-3 h-3" />
                                {cfg.label}
                              </span>
                            );
                          })()}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.02 240)" }} />
                            <span className="text-sm" style={{ color: "oklch(0.35 0.02 240)" }}>
                              {d.phone}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Car className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.02 240)" }} />
                            <span className="text-sm" style={{ color: "oklch(0.35 0.02 240)" }}>
                              {d.vehicleNumber ?? "-"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          <span className="text-sm" style={{ color: "oklch(0.35 0.02 240)" }}>
                            {d.vehicleType ?? "-"}
                          </span>
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5" style={{ color: "oklch(0.65 0.02 240)" }} />
                            <span className="text-sm" style={{ color: "oklch(0.35 0.02 240)" }}>
                              {d.affiliation ?? "-"}
                            </span>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {(() => {
                            const summary = driverMonthlySummary?.find((s) => s.driverId === d.id);
                            if (!summary) return <span className="text-xs" style={{ color: "oklch(0.70 0.01 240)" }}>-</span>;
                            return (
                              <div className="space-y-0.5">
                                <p className="text-xs font-semibold" style={{ color: "oklch(0.28 0.07 250)" }}>
                                  {summary.totalDispatches}건 배차
                                </p>
                                <p className="text-xs" style={{ color: "oklch(0.38 0.12 145)" }}>
                                  완료 {summary.completedDispatches}건
                                </p>
                                {summary.totalAmount > 0 && (
                                  <p className="text-xs font-bold" style={{ color: "oklch(0.32 0.10 145)" }}>
                                    {summary.totalAmount.toLocaleString()}원
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {/* 이번 달 배차 일수 셀 */}
                        <td className="px-5 py-4">
                          {dispatchDays === null ? (
                            <span className="text-xs" style={{ color: "oklch(0.70 0.01 240)" }}>-</span>
                          ) : isDanger ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: "oklch(0.55 0.22 25)", color: "white" }}>
                              🚨 {dispatchDays}일
                            </span>
                          ) : isWarn ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold"
                              style={{ background: "oklch(0.75 0.16 60)", color: "oklch(0.20 0.06 60)" }}>
                              ⚠ {dispatchDays}일
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
                              style={{ background: "oklch(0.38 0.12 145 / 0.15)", color: "oklch(0.32 0.10 145)" }}>
                              ✓ {dispatchDays}일
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setEditDriver({
                                id: d.id,
                                name: d.name,
                                phone: d.phone ?? "",
                                vehicleNumber: d.vehicleNumber ?? "",
                                vehicleType: d.vehicleType ?? "",
                                affiliation: d.affiliation ?? "",
                              })}
                              className="h-8 w-8 p-0"
                              style={{ color: "oklch(0.55 0.12 250)" }}
                              title="기사 정보 편집"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setPhotoEditDriverId(d.id);
                                photoEditInputRef.current?.click();
                              }}
                              className="h-8 w-8 p-0"
                              style={{ color: "oklch(0.45 0.12 250)" }}
                              title="차량 사진 수정"
                              disabled={photoEditUploading && photoEditDriverId === d.id}
                            >
                              {photoEditUploading && photoEditDriverId === d.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Camera className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => { setPinResetDriver({ id: d.id, name: d.name }); setPinResetValue(""); }}
                              className="h-8 w-8 p-0"
                              style={{ color: "oklch(0.65 0.14 140)" }}
                              title="PIN 초기화"
                            >
                              <KeyRound className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                if (confirm(`'${d.name}' 기사를 삭제하시겠습니까?`)) {
                                  deleteDriver.mutate({ id: d.id });
                                }
                              }}
                              className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                    })}
                  </tbody>
                </table>
                </div>
                </>
              )}
            </div>
          </TabsContent>

          {/* 정산 관리 탭 */}
          <TabsContent value="settlement">
            <div className="rounded-2xl p-5" style={CARD_STYLE}>
              {/* 리포트 헤더 */}
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <select
                      className="h-9 px-3 rounded-lg border text-sm font-semibold"
                      style={{ borderColor: "oklch(0.85 0.01 240)", background: "oklch(1 0 0)", color: "oklch(0.15 0.02 240)" }}
                      value={reportYear}
                      onChange={(e) => setReportYear(Number(e.target.value))}
                    >
                      {[2024, 2025, 2026, 2027].map((y) => (
                        <option key={y} value={y}>{y}년</option>
                      ))}
                    </select>
                    <select
                      className="h-9 px-3 rounded-lg border text-sm font-semibold"
                      style={{ borderColor: "oklch(0.85 0.01 240)", background: "oklch(1 0 0)", color: "oklch(0.15 0.02 240)" }}
                      value={reportMonth}
                      onChange={(e) => setReportMonth(Number(e.target.value))}
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <option key={m} value={m}>{m}월</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-sm font-semibold" style={{ color: "oklch(0.28 0.07 250)" }}>
                    {reportYear}년 {reportMonth}월 정산 리포트
                  </span>
                </div>
                <Button
                  size="sm"
                  className="gap-2 h-10 px-4 font-bold text-sm shadow-sm transition-all duration-150 active:scale-95"
                  style={{
                    background: settlementSummaryAll && settlementSummaryAll.length > 0
                      ? 'linear-gradient(135deg, oklch(0.50 0.16 155), oklch(0.40 0.18 165))'
                      : 'oklch(0.88 0.01 240)',
                    color: settlementSummaryAll && settlementSummaryAll.length > 0 ? 'white' : 'oklch(0.60 0.01 240)',
                    boxShadow: settlementSummaryAll && settlementSummaryAll.length > 0 ? '0 2px 8px oklch(0.50 0.16 155 / 0.35)' : 'none',
                  }}
                  onClick={handleExportCSV}
                  disabled={!settlementSummaryAll || settlementSummaryAll.length === 0}
                >
                  <Download className="w-4 h-4" />
                  엑셀/CSV 다운로드
                </Button>
              </div>

              {/* 리포트 테이블 - settlementSummaryAll 기반으로 전면 개편 */}
              {reportLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.28 0.07 250)" }} />
                </div>
              ) : !settlementSummaryAll || settlementSummaryAll.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <BarChart3 className="w-10 h-10" style={{ color: "oklch(0.75 0.01 240)" }} />
                  <p className="text-sm font-medium" style={{ color: "oklch(0.35 0.02 240)" }}>해당 월 정산 데이터가 없습니다.</p>
                </div>
              ) : (() => {
                const totalEarned = settlementSummaryAll.reduce((s: number, r: any) => s + r.totalEarned, 0);
                const totalPaidAll = settlementSummaryAll.reduce((s: number, r: any) => s + r.totalPaid, 0);
                const totalRemaining = totalEarned - totalPaidAll;
                return (
                <>
                {/* 요약 카드 3개 */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="rounded-xl p-4" style={{ background: "oklch(0.55 0.18 145 / 0.08)", border: "1px solid oklch(0.55 0.18 145 / 0.20)" }}>
                    <p className="text-xs font-medium" style={{ color: "oklch(0.45 0.04 240)" }}>총매출</p>
                    <p className="text-xl font-bold mt-1" style={{ color: "oklch(0.32 0.10 145)" }}>{totalEarned > 0 ? totalEarned.toLocaleString() + "원" : "-"}</p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: "oklch(0.38 0.12 250 / 0.08)", border: "1px solid oklch(0.38 0.12 250 / 0.20)" }}>
                    <p className="text-xs font-medium" style={{ color: "oklch(0.45 0.04 240)" }}>지급된 금액</p>
                    <p className="text-xl font-bold mt-1" style={{ color: "oklch(0.28 0.10 250)" }}>{totalPaidAll > 0 ? totalPaidAll.toLocaleString() + "원" : "-"}</p>
                  </div>
                  <div className="rounded-xl p-4" style={{ background: totalRemaining > 0 ? "oklch(0.62 0.22 25 / 0.08)" : "oklch(0.55 0.18 145 / 0.06)", border: totalRemaining > 0 ? "1px solid oklch(0.62 0.22 25 / 0.25)" : "1px solid oklch(0.55 0.18 145 / 0.20)" }}>
                    <p className="text-xs font-medium" style={{ color: "oklch(0.45 0.04 240)" }}>남은 금액</p>
                    <p className="text-xl font-bold mt-1" style={{ color: totalRemaining > 0 ? "oklch(0.48 0.22 25)" : "oklch(0.38 0.12 145)" }}>
                      {totalRemaining > 0 ? totalRemaining.toLocaleString() + "원" : totalEarned > 0 ? "✔ 전체 완납" : "-"}
                    </p>
                  </div>
                </div>
                {/* 기사별 테이블 */}
                <div className="overflow-x-auto rounded-xl" style={{ border: "1px solid oklch(0.90 0.01 240)" }}>
                  <table className="w-full" style={{ minWidth: "520px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid oklch(0.92 0.008 240)", background: "oklch(0.985 0.004 240)" }}>
                        {["기사명", "차량번호", "소속", "총매출", "지급된 금액", "남은 금액", "상세"].map((h) => (
                          <th key={h} className="px-4 py-3 text-left text-xs font-semibold" style={{ color: "oklch(0.45 0.04 240)" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {settlementSummaryAll.map((r: any, idx: number) => {
                        const remaining = r.remaining;
                        return (
                          <tr
                            key={r.driverId}
                            className="transition-colors cursor-pointer"
                            style={{ borderBottom: idx < settlementSummaryAll.length - 1 ? "1px solid oklch(0.94 0.006 240)" : "none", background: remaining > 0 ? "oklch(0.996 0.003 25)" : "white" }}
                            onMouseEnter={e => (e.currentTarget.style.background = remaining > 0 ? "oklch(0.985 0.008 25)" : "oklch(0.97 0.006 240)")}
                            onMouseLeave={e => (e.currentTarget.style.background = remaining > 0 ? "oklch(0.996 0.003 25)" : "white")}
                            onClick={() => { setSettlementDetailDriver({ id: r.driverId, name: r.driverName, totalAmount: r.totalEarned }); setShowPaymentForm(false); setPaymentForm({ amount: "", companyName: "", memo: "", paidAt: new Date().toISOString().slice(0, 10) }); }}
                          >
                            <td className="px-4 py-4">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: "oklch(0.28 0.07 250 / 0.1)", color: "oklch(0.28 0.07 250)" }}>{r.driverName[0]}</div>
                                <span className="text-sm font-semibold" style={{ color: "oklch(0.28 0.07 250)" }}>{r.driverName}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4"><span className="text-sm" style={{ color: "oklch(0.35 0.02 240)" }}>{r.vehicleNumber ?? "-"}</span></td>
                            <td className="px-4 py-4"><span className="text-sm" style={{ color: "oklch(0.35 0.02 240)" }}>{r.affiliation ?? "-"}</span></td>
                            <td className="px-4 py-4">
                              {r.totalEarned > 0 ? (
                                <span className="text-sm font-bold" style={{ color: "oklch(0.32 0.10 145)" }}>{r.totalEarned.toLocaleString()}원</span>
                              ) : <span className="text-xs" style={{ color: "oklch(0.65 0.02 240)" }}>-</span>}
                            </td>
                            <td className="px-4 py-4">
                              {r.totalPaid > 0 ? (
                                <span className="text-sm font-semibold" style={{ color: "oklch(0.38 0.12 250)" }}>{r.totalPaid.toLocaleString()}원</span>
                              ) : <span className="text-xs" style={{ color: "oklch(0.65 0.02 240)" }}>-</span>}
                            </td>
                            <td className="px-4 py-4">
                              {remaining > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold" style={{ background: "oklch(0.62 0.22 25 / 0.12)", color: "oklch(0.48 0.22 25)", border: "1px solid oklch(0.62 0.22 25 / 0.30)" }}>
                                  <AlertTriangle className="w-3 h-3" />{remaining.toLocaleString()}원
                                </span>
                              ) : r.totalEarned > 0 ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: "oklch(0.55 0.18 145 / 0.10)", color: "oklch(0.38 0.12 145)", border: "1px solid oklch(0.55 0.18 145 / 0.25)" }}>
                                  <CheckCircle2 className="w-3 h-3" />완납
                                </span>
                              ) : <span className="text-xs" style={{ color: "oklch(0.65 0.02 240)" }}>-</span>}
                            </td>
                            <td className="px-4 py-4">
                              <span className="text-xs px-2 py-1 rounded-lg" style={{ background: "oklch(0.28 0.07 250 / 0.08)", color: "oklch(0.28 0.07 250)" }}>상세 ›</span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                </>
                );
              })()}
            </div>
          </TabsContent>

          {/* 작업일지 탭 */}
          <TabsContent value="worklogs">
            {/* 숨김 차량 사진 수정 input */}
            <input
              ref={photoEditInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file && photoEditDriverId !== null) {
                  handlePhotoEdit(photoEditDriverId, file);
                }
                e.target.value = "";
              }}
            />
            {workLogsLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.28 0.07 250)" }} />
              </div>
            ) : !workLogs || workLogs.length === 0 ? (
              <div className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3" style={CARD_STYLE}>
                <Camera className="w-10 h-10" style={{ color: "oklch(0.75 0.01 240)" }} />
                <p className="text-sm font-medium" style={{ color: "oklch(0.35 0.02 240)" }}>등록된 작업일지가 없습니다.</p>
                <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>기사가 작업 완료 후 사진을 등록하면 여기에 표시됩니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {workLogs.map((log) => (
                  <WorkLogCard key={log.id} log={log} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* 알림 발송 탭 */}
          <TabsContent value="notifications">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* 왼쪽: 기사 선택 + 메시지 입력 */}
              <div className="rounded-2xl p-5" style={CARD_STYLE}>
                <p className="text-sm font-bold mb-3" style={{ color: "oklch(0.18 0.02 240)" }}>
                  수신 기사 선택
                  <span className="ml-2 text-xs font-normal" style={{ color: "oklch(0.55 0.02 240)" }}>
                    {notifSelectedIds.length > 0 ? `${notifSelectedIds.length}명 선택됨` : "기사를 선택하세요"}
                  </span>
                </p>
                {/* 전체 선택 */}
                <div
                  className="flex items-center gap-2 mb-2 pb-2 cursor-pointer"
                  style={{ borderBottom: "1px solid oklch(0.91 0.008 240)" }}
                  onClick={toggleNotifSelectAll}
                >
                  <Checkbox
                    checked={!!drivers?.length && drivers.every((d) => notifSelectedIds.includes(d.id))}
                    onCheckedChange={toggleNotifSelectAll}
                  />
                  <span className="text-xs font-semibold" style={{ color: "oklch(0.35 0.02 240)" }}>전체 선택 ({drivers?.length ?? 0}명)</span>
                </div>
                {/* 기사 목록 */}
                <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                  {drivers?.map((d) => (
                    <div
                      key={d.id}
                      className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 cursor-pointer transition-colors"
                      style={{ background: notifSelectedIds.includes(d.id) ? "oklch(0.95 0.04 250)" : "transparent" }}
                      onClick={() => toggleNotifDriver(d.id)}
                    >
                      <Checkbox
                        checked={notifSelectedIds.includes(d.id)}
                        onCheckedChange={() => toggleNotifDriver(d.id)}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: "oklch(0.20 0.02 240)" }}>{d.name}</p>
                        <p className="text-xs truncate" style={{ color: "oklch(0.55 0.02 240)" }}>{d.phone} · {d.affiliation}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 제목 + 메시지 입력 */}
                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.35 0.02 240)" }}>알림 제목 *</label>
                    <input
                      type="text"
                      placeholder="제목을 입력하세요"
                      className="w-full h-9 px-3 rounded-lg border text-sm"
                      style={{ borderColor: "oklch(0.85 0.01 240)", background: "oklch(1 0 0)", color: "oklch(0.15 0.02 240)" }}
                      value={notifTitle}
                      onChange={(e) => setNotifTitle(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold mb-1 block" style={{ color: "oklch(0.35 0.02 240)" }}>메시지 내용 *</label>
                    <textarea
                      placeholder="기사들에게 전달할 내용을 입력하세요"
                      className="w-full px-3 py-2 rounded-lg border text-sm resize-none"
                      style={{ borderColor: "oklch(0.85 0.01 240)", background: "oklch(1 0 0)", color: "oklch(0.15 0.02 240)", minHeight: "100px" }}
                      value={notifMessage}
                      onChange={(e) => setNotifMessage(e.target.value)}
                      maxLength={500}
                    />
                    <p className="text-xs text-right mt-0.5" style={{ color: "oklch(0.65 0.02 240)" }}>{notifMessage.length}/500</p>
                  </div>
                  <Button
                    className="w-full gap-2 font-bold"
                    style={{ background: "oklch(0.42 0.18 250)", color: "white" }}
                    onClick={handleSendNotification}
                    disabled={sendNotification.isPending}
                  >
                    {sendNotification.isPending ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> 발송 중...</>
                    ) : (
                      <><MessageSquare className="w-4 h-4" /> 알림 발송 ({notifSelectedIds.length}명)</>
                    )}
                  </Button>
                </div>
              </div>

              {/* 오른쪽: 발송 이력 */}
              <div className="rounded-2xl p-5" style={CARD_STYLE}>
                <p className="text-sm font-bold mb-3" style={{ color: "oklch(0.18 0.02 240)" }}>발송 이력 <span className="ml-1 text-xs font-normal" style={{ color: "oklch(0.55 0.02 240)" }}>(최근 100건)</span></p>
                {!notifHistory || notifHistory.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 gap-2">
                    <MessageSquare className="w-8 h-8" style={{ color: "oklch(0.80 0.01 240)" }} />
                    <p className="text-sm" style={{ color: "oklch(0.55 0.02 240)" }}>발송된 알림이 없습니다</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {notifHistory.map((n) => (
                      <div
                        key={n.id}
                        className="rounded-xl p-3"
                        style={{ background: n.isRead ? "oklch(0.97 0.005 240)" : "oklch(0.95 0.05 250)", border: `1px solid ${n.isRead ? "oklch(0.91 0.008 240)" : "oklch(0.80 0.10 250)"}` }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 mb-0.5">
                              {!n.isRead && <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: "oklch(0.55 0.18 250)" }} />}
                              <p className="text-xs font-bold truncate" style={{ color: "oklch(0.20 0.02 240)" }}>{n.driverName ?? "알 수 없음"}</p>
                            </div>
                            <p className="text-xs font-semibold" style={{ color: "oklch(0.30 0.02 240)" }}>{n.title}</p>
                            <p className="text-xs mt-0.5 line-clamp-2" style={{ color: "oklch(0.50 0.02 240)" }}>{n.message}</p>
                          </div>
                          <p className="text-xs flex-shrink-0" style={{ color: "oklch(0.60 0.02 240)" }}>
                            {new Date(n.createdAt).toLocaleDateString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* ─── 직접배차 생성 Dialog ─────────────────────────────────────────── */}
      <Dialog open={dispatchDialogOpen} onOpenChange={setDispatchDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl flex flex-col" style={{ maxHeight: '85dvh' }}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Truck className="w-5 h-5" style={{ color: "oklch(0.28 0.07 250)" }} />
              직접배차 생성
            </DialogTitle>
            <DialogDescription>
              기사를 선택하고 출발지/도착지를 입력하세요. 여러 명 동시 선택이 가능합니다.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            {/* 기사 선택 (체크박스 리스트) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">
                  기사 선택 <span className="text-destructive">*</span>
                  {dispatchForm.selectedDriverIds.length > 0 && (
                    <span
                      className="ml-2 text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: "oklch(0.28 0.07 250 / 0.12)", color: "oklch(0.28 0.07 250)" }}
                    >
                      {dispatchForm.selectedDriverIds.length}명 선택
                    </span>
                  )}
                </Label>
                {drivers && drivers.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                    style={{
                      color: "oklch(0.35 0.08 250)",
                      background: "oklch(0.28 0.07 250 / 0.06)",
                      border: "1px solid oklch(0.55 0.08 250 / 0.20)",
                    }}
                  >
                    {drivers.every((d) => dispatchForm.selectedDriverIds.includes(d.id))
                      ? "전체 해제"
                      : "전체 선택"}
                  </button>
                )}
              </div>

              {/* 기사 목록 */}
              <div
                className="rounded-xl overflow-hidden"
                style={{ border: "1px solid oklch(0.88 0.01 240)" }}
              >
                {!drivers || drivers.length === 0 ? (
                  <div className="py-8 text-center">
                    <Users className="w-8 h-8 mx-auto mb-2" style={{ color: "oklch(0.75 0.01 240)" }} />
                    <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>
                      등록된 기사가 없습니다.
                    </p>
                  </div>
                ) : (
                  drivers.map((d, idx) => {
                    const st = (d.status ?? "idle") as DriverStatusKey;
                    const cfg = ADMIN_STATUS_CONFIG[st];
                    const { Icon } = cfg;
                    const isSelected = dispatchForm.selectedDriverIds.includes(d.id);
                    return (
                      <label
                        key={d.id}
                        className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors"
                        style={{
                          borderBottom: idx < drivers.length - 1 ? "1px solid oklch(0.93 0.008 240)" : "none",
                          background: isSelected
                            ? "oklch(0.28 0.07 250 / 0.05)"
                            : "oklch(1 0 0)",
                        }}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleDriverSelection(d.id)}
                          className="flex-shrink-0"
                        />
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                          style={{
                            background: isSelected
                              ? "oklch(0.28 0.07 250 / 0.15)"
                              : "oklch(0.28 0.07 250 / 0.08)",
                            color: "oklch(0.28 0.07 250)",
                          }}
                        >
                          {d.name[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold" style={{ color: "oklch(0.15 0.02 240)" }}>
                              {d.name}
                            </span>
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold"
                              style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                            >
                              <Icon className="w-2.5 h-2.5" />
                              {cfg.label}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5 truncate" style={{ color: "oklch(0.55 0.02 240)" }}>
                            {d.vehicleNumber ?? "차량 미등록"} · {d.phone}
                          </p>
                        </div>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            {/* 출발지 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                출발지 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <MapPin
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "oklch(0.55 0.18 250)" }}
                />
                <Input
                  className="pl-9 h-10"
                  placeholder="예: 서울시 강남구 테헤란로 123"
                  value={dispatchForm.pickupLocation}
                  onChange={(e) =>
                    setDispatchForm((p) => ({ ...p, pickupLocation: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* 도착지 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                도착지 <span className="text-destructive">*</span>
              </Label>
              <div className="relative">
                <MapPin
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                  style={{ color: "oklch(0.55 0.18 155)" }}
                />
                <Input
                  className="pl-9 h-10"
                  placeholder="예: 서울시 마포구 합정동 456"
                  value={dispatchForm.dropoffLocation}
                  onChange={(e) =>
                    setDispatchForm((p) => ({ ...p, dropoffLocation: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* 도착 기한 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <CalendarClock className="w-4 h-4" style={{ color: "oklch(0.48 0.16 55)" }} />
                도착 기한
                <span className="text-xs font-normal" style={{ color: "oklch(0.55 0.04 240)" }}>(선택)</span>
              </Label>
              <Input
                className="h-10"
                type="datetime-local"
                value={dispatchForm.arrivalDeadline}
                onChange={(e) =>
                  setDispatchForm((p) => ({ ...p, arrivalDeadline: e.target.value }))
                }
              />
              {dispatchForm.arrivalDeadline && (
                <p className="text-xs" style={{ color: "oklch(0.48 0.16 55)" }}>
                  문자 메시지: "{formatArrivalDeadlineKorean(new Date(dispatchForm.arrivalDeadline).toISOString())}까지 도착해주세요"
                </p>
              )}
            </div>

            {/* 회차 단가 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <span>회차 단가</span>
                <span className="text-xs font-normal" style={{ color: "oklch(0.55 0.04 240)" }}>원/회 (선택)</span>
              </Label>
              <div className="relative">
                <span
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold"
                  style={{ color: "oklch(0.45 0.12 145)" }}
                >
                  ₩
                </span>
                <Input
                  className="pl-7 h-10"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="예: 50000"
                  value={dispatchForm.unitPrice}
                  onChange={(e) => setDispatchForm((p) => ({ ...p, unitPrice: e.target.value }))}
                />
              </div>
              {dispatchForm.unitPrice && (
                <p className="text-xs" style={{ color: "oklch(0.45 0.12 145)" }}>
                  단가: {Number(dispatchForm.unitPrice).toLocaleString()}원/회 — 기사가 회차 수를 입력하면 정산 금액이 자동 계산됩니다.
                </p>
              )}
            </div>

            {/* 메모 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">메모 (선택)</Label>
              <Input
                className="h-10"
                placeholder="추가 메모 사항"
                value={dispatchForm.memo}
                onChange={(e) => setDispatchForm((p) => ({ ...p, memo: e.target.value }))}
              />
            </div>

            {/* 수리중 기사 선택 시 경고 */}
            {repairDriversSelected.length > 0 && (
              <div
                className="rounded-xl p-3 flex items-start gap-2.5"
                style={{
                  background: "oklch(0.55 0.22 25 / 0.08)",
                  border: "1px solid oklch(0.55 0.22 25 / 0.35)",
                }}
              >
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: "oklch(0.50 0.22 25)" }} />
                <div>
                  <p className="text-xs font-bold" style={{ color: "oklch(0.45 0.22 25)" }}>
                    수리중 기사가 포함되어 있습니다
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "oklch(0.50 0.18 25)" }}>
                    {repairDriversSelected.map((d) => d.name).join(", ")} 기사는 현재 수리 중입니다. 그래도 배차를 진행하시겠습니까?
                  </p>
                </div>
              </div>
            )}

            {/* 안내 */}
            <div
              className="rounded-xl p-3 text-xs"
              style={{
                background: "oklch(0.55 0.18 250 / 0.06)",
                border: "1px solid oklch(0.55 0.18 250 / 0.15)",
                color: "oklch(0.40 0.08 250)",
              }}
            >
              생성 즉시 기사 페이지에 <strong>대기</strong> 상태로 표시되며, 기사가 승인하면 <strong>확인</strong>으로 변경됩니다.
              {dispatchForm.selectedDriverIds.length > 1 && (
                <span className="ml-1">배차 생성 후 <strong>문자 미리보기</strong>가 자동으로 표시됩니다.</span>
              )}
            </div>
          </div>

          <div className="flex gap-2 pt-3 flex-shrink-0 border-t" style={{ borderColor: "oklch(0.90 0.01 240)" }}>
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={() => setDispatchDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              className="flex-1 h-10 font-semibold"
              style={{ background: "oklch(0.28 0.07 250)", color: "oklch(0.98 0.005 240)" }}
              onClick={handleCreateDispatch}
              disabled={createMultipleDispatch.isPending}
            >
              {createMultipleDispatch.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : dispatchForm.selectedDriverIds.length > 1 ? (
                `${dispatchForm.selectedDriverIds.length}명 직접배차 생성`
              ) : (
                "직접배차 생성"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 문자 미리보기 Dialog ─────────────────────────────────────────── */}
      <Dialog open={smsPreviewOpen} onOpenChange={setSmsPreviewOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl flex flex-col" style={{ maxHeight: '85dvh' }}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <MessageSquare className="w-5 h-5" style={{ color: "oklch(0.38 0.15 155)" }} />
              문자 메시지 미리보기
            </DialogTitle>
            <DialogDescription>
              각 기사에게 전달할 문자 내용입니다. 복사하여 직접 발송하세요.
            </DialogDescription>
          </DialogHeader>

          {/* 템플릿 불러오기 / 저장 */}
          <div className="flex-shrink-0 flex items-center gap-2 pb-2 border-b" style={{ borderColor: "oklch(0.92 0.008 240)" }}>
            <select
              className="flex-1 h-9 rounded-lg border text-sm px-3 outline-none"
              style={{
                background: "oklch(0.985 0.004 240)",
                borderColor: "oklch(0.88 0.01 240)",
                color: "oklch(0.25 0.03 240)",
              }}
              defaultValue=""
              onChange={(e) => {
                const tmpl = smsTemplates?.find((t) => String(t.id) === e.target.value);
                if (!tmpl) return;
                setSmsPreviewData((prev) => prev.map((d) => ({ ...d, smsText: tmpl.content })));
                e.target.value = "";
              }}
            >
              <option value="" disabled>템플릿 불러오기...</option>
              {smsTemplates?.map((t) => (
                <option key={t.id} value={String(t.id)}>{t.title}</option>
              ))}
            </select>
            <button
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg transition-all duration-150 active:scale-95 flex-shrink-0"
              style={{
                background: "oklch(0.38 0.15 155 / 0.10)",
                color: "oklch(0.32 0.12 155)",
                border: "1px solid oklch(0.45 0.15 155 / 0.30)",
              }}
              onClick={() => {
                if (smsPreviewData.length === 0) return;
                setTemplateSaveTarget(smsPreviewData[0].smsText);
                setTemplateTitle("");
                setTemplateDialogOpen(true);
              }}
            >
              <BookmarkPlus className="w-3.5 h-3.5" />
              템플릿 저장
            </button>
          </div>

          <div className="space-y-3 py-2 overflow-y-auto flex-1 pr-1">
            {smsPreviewData.length === 0 ? (
              <div className="py-8 text-center">
                <MessageSquare className="w-10 h-10 mx-auto mb-2" style={{ color: "oklch(0.75 0.01 240)" }} />
                <p className="text-sm" style={{ color: "oklch(0.55 0.02 240)" }}>
                  문자 미리보기 데이터가 없습니다.
                </p>
              </div>
            ) : (
              smsPreviewData.map((item, i) => (
                <SmsPreviewItem
                  key={i}
                  driverName={item.driverName}
                  smsText={item.smsText}
                  onTextChange={(newText) =>
                    setSmsPreviewData((prev) =>
                      prev.map((d, idx) =>
                        idx === i ? { ...d, smsText: newText } : d
                      )
                    )
                  }
                />
              ))
            )}
          </div>

          <div className="flex gap-2 pt-3 flex-shrink-0 border-t" style={{ borderColor: "oklch(0.90 0.01 240)" }}>
            {smsPreviewData.length > 1 && (
              <Button
                variant="outline"
                className="flex-1 h-10 gap-2"
                onClick={handleCopyAll}
              >
                <Copy className="w-4 h-4" />
                전체 복사
              </Button>
            )}
            <Button
              className="flex-1 h-10 font-semibold"
              style={{ background: "oklch(0.28 0.07 250)", color: "oklch(0.98 0.005 240)" }}
              onClick={() => setSmsPreviewOpen(false)}
            >
              확인
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 문자 템플릿 저장 Dialog ─────────────────────────────────────── */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <BookmarkPlus className="w-4 h-4" style={{ color: "oklch(0.38 0.15 155)" }} />
              템플릿 저장
            </DialogTitle>
            <DialogDescription>
              현재 문자 내용을 템플릿으로 저장합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">
                템플릿 이름 <span className="text-destructive">*</span>
              </Label>
              <Input
                className="h-10"
                placeholder="예: 기본 배차 안내"
                value={templateTitle}
                onChange={(e) => setTemplateTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && templateTitle.trim()) {
                    saveSmsTemplate.mutate({ title: templateTitle.trim(), content: templateSaveTarget });
                  }
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">내용 미리보기</Label>
              <pre
                className="text-xs leading-relaxed whitespace-pre-wrap rounded-lg p-3 max-h-32 overflow-y-auto"
                style={{
                  background: "oklch(0.97 0.006 240)",
                  color: "oklch(0.35 0.02 240)",
                  border: "1px solid oklch(0.90 0.01 240)",
                }}
              >
                {templateSaveTarget}
              </pre>
            </div>
            {smsTemplates && smsTemplates.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">저장된 템플릿</Label>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {smsTemplates.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center justify-between px-3 py-2 rounded-lg"
                      style={{ background: "oklch(0.97 0.006 240)", border: "1px solid oklch(0.90 0.01 240)" }}
                    >
                      <span className="text-sm" style={{ color: "oklch(0.25 0.03 240)" }}>{t.title}</span>
                      <button
                        onClick={() => deleteSmsTemplate.mutate({ id: t.id })}
                        className="w-6 h-6 flex items-center justify-center rounded text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 pt-2 border-t" style={{ borderColor: "oklch(0.90 0.01 240)" }}>
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={() => setTemplateDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              className="flex-1 h-10 font-semibold"
              style={{ background: "oklch(0.38 0.15 155)", color: "oklch(0.98 0.005 240)" }}
              disabled={!templateTitle.trim() || saveSmsTemplate.isPending}
              onClick={() => saveSmsTemplate.mutate({ title: templateTitle.trim(), content: templateSaveTarget })}
            >
              {saveSmsTemplate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 차량 사진 라이트박스 ──────────────────────────────────────────────── */}
      {vehicleLightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: "oklch(0.05 0.02 240 / 0.95)" }}
          onClick={() => setVehicleLightbox(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "oklch(0.25 0.03 240)", color: "oklch(0.85 0.01 240)" }}
            onClick={() => setVehicleLightbox(null)}
          >
            <X className="w-5 h-5" />
          </button>
          <div
            className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3 px-4"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={vehicleLightbox.url}
              alt={vehicleLightbox.name}
              className="max-h-[75vh] max-w-full rounded-xl object-contain"
              style={{ boxShadow: "0 8px 40px oklch(0.05 0.02 240 / 0.8)" }}
            />
            <p className="text-sm" style={{ color: "oklch(0.65 0.02 240)" }}>{vehicleLightbox.name}</p>
          </div>
        </div>
      )}

      {/* ─── 정산 드릴다운 Dialog ─────────────────────────────────────────── */}
      <Dialog open={!!drilldownDriver} onOpenChange={(open) => { if (!open) setDrilldownDriver(null); }}>
        <DialogContent className="sm:max-w-2xl rounded-2xl flex flex-col" style={{ maxHeight: '85dvh' }}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ClipboardList className="w-5 h-5" style={{ color: "oklch(0.28 0.07 250)" }} />
              {drilldownDriver?.name} 기사 — {reportYear}년 {reportMonth}월 배차 상세
            </DialogTitle>
            <DialogDescription>
              해당 기사의 이번 달 배차 건별 상세 내역입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1">
            {drilldownLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.28 0.07 250)" }} />
              </div>
            ) : !drilldownOrders || drilldownOrders.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm" style={{ color: "oklch(0.55 0.02 240)" }}>이 달 배차 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {drilldownOrders.map((o, idx) => (
                  <div
                    key={o.id}
                    className="rounded-xl px-4 py-3"
                    style={{
                      background: o.approvalStatus === "cancelled" ? "oklch(0.93 0.005 240 / 0.6)" : "oklch(0.97 0.006 240)",
                      border: "1px solid oklch(0.90 0.01 240)",
                      opacity: o.approvalStatus === "cancelled" ? 0.65 : 1,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold" style={{ color: "oklch(0.55 0.02 240)" }}>#{idx + 1}</span>
                      <span
                        className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold"
                        style={{
                          background: o.approvalStatus === "completed" ? "oklch(0.38 0.12 145 / 0.12)" : o.approvalStatus === "confirmed" ? "oklch(0.28 0.07 250 / 0.12)" : o.approvalStatus === "cancelled" ? "oklch(0.62 0.22 25 / 0.12)" : "oklch(0.65 0.12 75 / 0.12)",
                          color: o.approvalStatus === "completed" ? "oklch(0.38 0.12 145)" : o.approvalStatus === "confirmed" ? "oklch(0.28 0.07 250)" : o.approvalStatus === "cancelled" ? "oklch(0.52 0.22 25)" : "oklch(0.55 0.12 75)",
                        }}
                      >
                        {o.approvalStatus === "cancelled" && <Ban className="w-3 h-3" />}
                        {o.approvalStatus === "completed" ? "완료" : o.approvalStatus === "confirmed" ? "승인" : o.approvalStatus === "cancelled" ? "취소 (정산 제외)" : "대기"}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm mb-1">
                      <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "oklch(0.38 0.12 145)" }} />
                      <span style={{ color: "oklch(0.25 0.03 240)" }}>{o.pickupLocation}</span>
                      <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.65 0.02 240)" }} />
                      <span style={{ color: "oklch(0.25 0.03 240)" }}>{o.dropoffLocation}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>
                      {o.unitPrice != null && <span>단가: {o.unitPrice.toLocaleString()}원</span>}
                      {o.tripCount != null && <span>회차: {o.tripCount}회</span>}
                      {o.totalAmount != null && o.totalAmount > 0 && (
                        <span className="font-bold" style={{ color: "oklch(0.32 0.10 145)" }}>정산: {o.totalAmount.toLocaleString()}원</span>
                      )}
                      <span>{new Date(o.createdAt).toLocaleDateString("ko-KR")}</span>
                    </div>
                    {o.memo && (
                      <p className="mt-1.5 text-xs" style={{ color: "oklch(0.45 0.02 240)" }}>메모: {o.memo}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="pt-3 flex-shrink-0 border-t" style={{ borderColor: "oklch(0.90 0.01 240)" }}>
            <Button
              className="w-full h-10 font-semibold"
              style={{ background: "oklch(0.28 0.07 250)", color: "oklch(0.98 0.005 240)" }}
              onClick={() => setDrilldownDriver(null)}
            >
              닫기
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── 기사 등록 Dialog ─────────────────────────────────────────────── */}
      <Dialog open={driverDialogOpen} onOpenChange={setDriverDialogOpen}>
        <DialogContent className="sm:max-w-lg rounded-2xl flex flex-col" style={{ maxHeight: '85dvh' }}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Users className="w-5 h-5" style={{ color: "oklch(0.28 0.07 250)" }} />
              기사 등록
            </DialogTitle>
            <DialogDescription>
              이름과 연락처는 필수입니다. 나머지는 선택 사항입니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2 overflow-y-auto flex-1 pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  이름 <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="h-10"
                  placeholder="홍길동"
                  value={driverForm.name}
                  onChange={(e) => setDriverForm((p) => ({ ...p, name: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  연락처 <span className="text-destructive">*</span>
                </Label>
                <Input
                  className="h-10"
                  placeholder="010-0000-0000"
                  value={driverForm.phone}
                  onChange={(e) => setDriverForm((p) => ({ ...p, phone: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">차량번호</Label>
                <Input
                  className="h-10"
                  placeholder="12가 3456"
                  value={driverForm.vehicleNumber}
                  onChange={(e) => setDriverForm((p) => ({ ...p, vehicleNumber: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">차종</Label>
                <Input
                  className="h-10"
                  placeholder="1톤 트럭"
                  value={driverForm.vehicleType}
                  onChange={(e) => setDriverForm((p) => ({ ...p, vehicleType: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">소속</Label>
              <Input
                className="h-10"
                placeholder="소속 회사명"
                value={driverForm.affiliation}
                onChange={(e) => setDriverForm((p) => ({ ...p, affiliation: e.target.value }))}
              />
            </div>

            {/* 초기 PIN 설정 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">로그인 PIN <span className="text-xs font-normal" style={{ color: "oklch(0.55 0.02 240)" }}>(선택, 4자리 숫자)</span></Label>
              <Input
                className="h-10"
                placeholder="1234"
                maxLength={4}
                type="password"
                value={driverForm.initialPin}
                onChange={(e) => setDriverForm((p) => ({ ...p, initialPin: e.target.value.replace(/\D/g, "").slice(0, 4) }))}
              />
              <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>기사가 로그인 시 사용할 PIN입니다. 나중에 관리자가 수정할 수 있습니다.</p>
            </div>

            {/* 차량 전면 사진 업로드 */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">차량 전면 사진 <span className="text-xs font-normal" style={{ color: "oklch(0.55 0.02 240)" }}>(선택)</span></Label>
              {vehiclePhotoPreview ? (
                <div className="relative rounded-xl overflow-hidden" style={{ aspectRatio: "16/9" }}>
                  <img
                    src={vehiclePhotoPreview}
                    alt="차량 전면 사진 미리보기"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(vehiclePhotoPreview!);
                      setVehiclePhotoFile(null);
                      setVehiclePhotoPreview(null);
                    }}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                    style={{ background: "oklch(0.15 0.02 240 / 0.75)", color: "white" }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => vehiclePhotoInputRef.current?.click()}
                    className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg text-xs font-medium"
                    style={{ background: "oklch(0.28 0.07 250 / 0.85)", color: "white" }}
                  >
                    교체
                  </button>
                </div>
              ) : (
                <div
                  className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors"
                  style={{
                    minHeight: "120px",
                    borderColor: vehiclePhotoDragOver ? "oklch(0.28 0.07 250)" : "oklch(0.82 0.02 240)",
                    background: vehiclePhotoDragOver ? "oklch(0.28 0.07 250 / 0.06)" : "oklch(0.985 0.004 240)",
                  }}
                  onClick={() => vehiclePhotoInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setVehiclePhotoDragOver(true); }}
                  onDragLeave={() => setVehiclePhotoDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setVehiclePhotoDragOver(false); handleVehiclePhotoSelect(e.dataTransfer.files); }}
                >
                  <Car className="w-8 h-8" style={{ color: "oklch(0.65 0.02 240)" }} />
                  <p className="text-sm font-medium" style={{ color: "oklch(0.45 0.02 240)" }}>차량 전면 사진 업로드</p>
                  <p className="text-xs" style={{ color: "oklch(0.65 0.02 240)" }}>클릭하거나 드래그하세요</p>
                </div>
              )}
              <input
                ref={vehiclePhotoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => e.target.files && handleVehiclePhotoSelect(e.target.files)}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-3 flex-shrink-0 border-t" style={{ borderColor: "oklch(0.90 0.01 240)" }}>
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={() => setDriverDialogOpen(false)}
            >
              취소
            </Button>
            <Button
              className="flex-1 h-10 font-semibold"
              style={{ background: "oklch(0.28 0.07 250)", color: "oklch(0.98 0.005 240)" }}
              onClick={handleCreateDriver}
              disabled={createDriver.isPending || vehiclePhotoUploading}
            >
              {(createDriver.isPending || vehiclePhotoUploading) ? (
                <><Loader2 className="w-4 h-4 animate-spin" /><span className="ml-1.5">{vehiclePhotoUploading ? "사진 업로드중..." : "등록중..."}</span></>
              ) : (
                "기사 등록"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 배차 취소 확인 다이얼로그 */}
      <AlertDialog open={cancelConfirmId !== null} onOpenChange={(open) => { if (!open) setCancelConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5" style={{ color: "oklch(0.52 0.22 25)" }} />
              배차 취소
            </AlertDialogTitle>
            <AlertDialogDescription>
              배차 #{cancelConfirmId !== null ? String(cancelConfirmId).padStart(4, "0") : ""}을 취소하시겠습니까?{"\n"}취소된 배차는 목록에 표시되지만 정산에서 제외됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소 안함</AlertDialogCancel>
            <AlertDialogAction
              style={{ background: "oklch(0.52 0.22 25)", color: "oklch(0.98 0.005 240)" }}
              onClick={() => {
                if (cancelConfirmId !== null) cancelDispatch.mutate({ id: cancelConfirmId });
              }}
              disabled={cancelDispatch.isPending}
            >
              {cancelDispatch.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              취소하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 배차 삭제 확인 다이얼로그 */}
      <AlertDialog open={deleteConfirmId !== null} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              배차 영구 삭제
            </AlertDialogTitle>
            <AlertDialogDescription>
              배차 #{deleteConfirmId !== null ? String(deleteConfirmId).padStart(4, "0") : ""}을 영구 삭제하시겠습니까?{"\n"}이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (deleteConfirmId !== null) deleteDispatch.mutate({ id: deleteConfirmId });
              }}
              disabled={deleteDispatch.isPending}
            >
              {deleteDispatch.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              삭제하기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 배차 수정 모달 */}
      <Dialog open={editDispatchId !== null} onOpenChange={(open) => { if (!open) setEditDispatchId(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Pencil className="w-5 h-5" style={{ color: "oklch(0.38 0.14 250)" }} />
              배차 수정
              {editDispatchId && (
                <span className="text-sm font-normal" style={{ color: "oklch(0.55 0.03 240)" }}>
                  #{String(editDispatchId).padStart(4, "0")}
                </span>
              )}
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: "oklch(0.50 0.03 240)" }}>
              출발지, 도착지, 단가, 메모, 도착 기한을 수정할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          {/* 유효성 검사 로직 */}
          {(() => {
            const pickup = editForm.pickupLocation.trim();
            const dropoff = editForm.dropoffLocation.trim();
            const deadline = editForm.arrivalDeadline;
            const isSameLocation = pickup && dropoff && pickup === dropoff;
            const isPastDeadline = deadline ? new Date(deadline) <= new Date() : false;
            const hasError = isSameLocation || isPastDeadline;
            return null; // 렌더링에는 사용하지 않고 아래 에러 메시지에서 사용
          })()}
          <div className="space-y-4 pt-2">
            {/* 출발지 */}
            {(() => {
              const pickup = editForm.pickupLocation.trim();
              const dropoff = editForm.dropoffLocation.trim();
              const isSame = pickup && dropoff && pickup === dropoff;
              return (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    출발지 <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: isSame ? "oklch(0.52 0.22 25)" : "oklch(0.55 0.18 250)" }} />
                    <Input
                      className="pl-9 h-10"
                      style={isSame ? { borderColor: "oklch(0.52 0.22 25)", background: "oklch(0.52 0.22 25 / 0.04)" } : {}}
                      placeholder="예: 서울시 강남구 테헤란로"
                      value={editForm.pickupLocation}
                      onChange={(e) => setEditForm((p) => ({ ...p, pickupLocation: e.target.value }))}
                    />
                  </div>
                  {isSame && (
                    <p className="text-xs flex items-center gap-1" style={{ color: "oklch(0.52 0.22 25)" }}>
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      출발지와 도착지가 동일합니다.
                    </p>
                  )}
                </div>
              );
            })()}
            {/* 도착지 */}
            {(() => {
              const pickup = editForm.pickupLocation.trim();
              const dropoff = editForm.dropoffLocation.trim();
              const isSame = pickup && dropoff && pickup === dropoff;
              return (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">
                    도착지 <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative">
                    <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: isSame ? "oklch(0.52 0.22 25)" : "oklch(0.55 0.18 155)" }} />
                    <Input
                      className="pl-9 h-10"
                      style={isSame ? { borderColor: "oklch(0.52 0.22 25)", background: "oklch(0.52 0.22 25 / 0.04)" } : {}}
                      placeholder="예: 서울시 마포구 합정동"
                      value={editForm.dropoffLocation}
                      onChange={(e) => setEditForm((p) => ({ ...p, dropoffLocation: e.target.value }))}
                    />
                  </div>
                  {isSame && (
                    <p className="text-xs flex items-center gap-1" style={{ color: "oklch(0.52 0.22 25)" }}>
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      출발지와 도착지가 동일합니다.
                    </p>
                  )}
                </div>
              );
            })()}
            {/* 도착 기한 */}
            {(() => {
              const isPast = editForm.arrivalDeadline ? new Date(editForm.arrivalDeadline) <= new Date() : false;
              return (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium flex items-center gap-1.5">
                    <CalendarClock className="w-4 h-4" style={{ color: isPast ? "oklch(0.52 0.22 25)" : "oklch(0.48 0.16 55)" }} />
                    도착 기한
                    <span className="text-xs font-normal" style={{ color: "oklch(0.55 0.04 240)" }}>(선택)</span>
                  </Label>
                  <Input
                    className="h-10"
                    type="datetime-local"
                    style={isPast ? { borderColor: "oklch(0.52 0.22 25)", background: "oklch(0.52 0.22 25 / 0.04)" } : {}}
                    value={editForm.arrivalDeadline}
                    onChange={(e) => setEditForm((p) => ({ ...p, arrivalDeadline: e.target.value }))}
                  />
                  {isPast && (
                    <p className="text-xs flex items-center gap-1" style={{ color: "oklch(0.52 0.22 25)" }}>
                      <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                      도착 기한이 현재 시간보다 과거입니다.
                    </p>
                  )}
                </div>
              );
            })()}
            {/* 회차 단가 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                회차 단가
                <span className="text-xs font-normal" style={{ color: "oklch(0.55 0.04 240)" }}>원/회 (선택)</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-semibold" style={{ color: "oklch(0.45 0.12 145)" }}>₩</span>
                <Input
                  className="pl-7 h-10"
                  type="number"
                  min="0"
                  step="1000"
                  placeholder="예: 35000"
                  value={editForm.unitPrice}
                  onChange={(e) => setEditForm((p) => ({ ...p, unitPrice: e.target.value }))}
                />
              </div>
              {editForm.unitPrice && (
                <p className="text-xs" style={{ color: "oklch(0.45 0.12 145)" }}>
                  단가: {Number(editForm.unitPrice).toLocaleString()}원/회
                </p>
              )}
            </div>
            {/* 메모 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">메모 (선택)</Label>
              <Input
                className="h-10"
                placeholder="추가 메모 사항"
                value={editForm.memo}
                onChange={(e) => setEditForm((p) => ({ ...p, memo: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2 pt-3 border-t" style={{ borderColor: "oklch(0.88 0.01 240)" }}>
            <Button
              variant="outline"
              className="flex-1 h-10"
              onClick={() => setEditDispatchId(null)}
            >
              취소
            </Button>
            {(() => {
              const pickup = editForm.pickupLocation.trim();
              const dropoff = editForm.dropoffLocation.trim();
              const isSame = pickup && dropoff && pickup === dropoff;
              const isPast = editForm.arrivalDeadline ? new Date(editForm.arrivalDeadline) <= new Date() : false;
              const hasError = Boolean(isSame) || isPast;
              return (
                <Button
                  className="flex-1 h-10 font-semibold gap-2"
                  style={hasError
                    ? { background: "oklch(0.82 0.01 240)", color: "oklch(0.55 0.02 240)", cursor: "not-allowed" }
                    : { background: "linear-gradient(135deg, oklch(0.38 0.14 250), oklch(0.30 0.12 250))", color: "white" }
                  }
                  onClick={handleEditSave}
                  disabled={updateDispatch.isPending || hasError}
                >
                  {updateDispatch.isPending
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><Pencil className="w-4 h-4" />저장하기</>}
                </Button>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── 상태별 기사 목록 Sheet ── */}
      <Sheet open={!!statusSheetKey} onOpenChange={(o) => { if (!o) setStatusSheetKey(null); }}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-md flex flex-col"
          style={{ background: "oklch(0.16 0.05 252)", borderLeft: "1px solid oklch(0.30 0.06 252 / 0.6)" }}
        >
          {statusSheetKey && (() => {
            const cfg = ADMIN_STATUS_CONFIG[statusSheetKey];
            const { Icon } = cfg;
            const filteredDrivers = drivers?.filter((d) => d.status === statusSheetKey) ?? [];
            return (
              <>
                <SheetHeader className="pb-4 border-b" style={{ borderColor: "oklch(0.28 0.06 252 / 0.5)" }}>
                  <SheetTitle className="flex items-center gap-2 text-base" style={{ color: "oklch(0.92 0.005 240)" }}>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-semibold" style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}>
                      <Icon className="w-4 h-4" />
                      {cfg.label}
                    </span>
                    <span style={{ color: "oklch(0.65 0.02 240)" }}>기사 목록</span>
                  </SheetTitle>
                  <SheetDescription style={{ color: "oklch(0.55 0.018 240)" }}>
                    현재 <span style={{ color: cfg.color, fontWeight: 600 }}>{cfg.label}</span> 상태인 기사가 <span style={{ color: "oklch(0.78 0.12 72)", fontWeight: 600 }}>{filteredDrivers.length}명</span>입니다.
                  </SheetDescription>
                </SheetHeader>

                <div className="flex-1 overflow-y-auto py-4 space-y-3">
                  {filteredDrivers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                      <UserCheck className="w-10 h-10" style={{ color: "oklch(0.38 0.06 252)" }} />
                      <p className="text-sm" style={{ color: "oklch(0.50 0.018 240)" }}>{cfg.label} 상태인 기사가 없습니다.</p>
                    </div>
                  ) : (
                    filteredDrivers.map((d, idx) => (
                      <div
                        key={d.id}
                        className="rounded-xl p-4"
                        style={{ background: "oklch(0.20 0.05 252)", border: "1px solid oklch(0.30 0.06 252 / 0.5)" }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: cfg.bg, color: cfg.color }}>{idx + 1}</span>
                            <span className="font-semibold text-sm" style={{ color: "oklch(0.92 0.005 240)" }}>{d.name}</span>
                          </div>
                          {d.affiliation && (
                            <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: "oklch(0.26 0.06 252)", color: "oklch(0.65 0.02 240)" }}>{d.affiliation}</span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 gap-1 text-xs" style={{ color: "oklch(0.60 0.02 240)" }}>
                          {d.phone && (
                            <span className="flex items-center gap-1.5">
                              <Phone className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.55 0.12 250)" }} />
                              {d.phone}
                            </span>
                          )}
                          {d.vehicleNumber && (
                            <span className="flex items-center gap-1.5">
                              <Car className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.55 0.12 250)" }} />
                              {d.vehicleNumber}
                              {d.vehicleType && <span style={{ color: "oklch(0.48 0.02 240)" }}>· {d.vehicleType}</span>}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* ── 기사 정보 편집 Dialog ── */}
      <Dialog open={!!editDriver} onOpenChange={(o) => { if (!o) setEditDriver(null); }}>
        <DialogContent className="max-w-md rounded-2xl flex flex-col max-h-[90vh]" style={{ background: "oklch(0.18 0.05 252)", border: "1px solid oklch(0.32 0.06 252 / 0.6)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "oklch(0.92 0.005 240)" }} className="flex items-center gap-2">
              <Pencil className="w-4 h-4" style={{ color: "oklch(0.65 0.14 250)" }} />
              기사 정보 편집
            </DialogTitle>
            <DialogDescription style={{ color: "oklch(0.58 0.018 240)" }}>
              <span style={{ color: "oklch(0.78 0.12 72)" }}>{editDriver?.name}</span> 기사의 정보를 수정합니다.
            </DialogDescription>
          </DialogHeader>
          {editDriver && (
            <div className="flex flex-col flex-1 min-h-0">
              <div className="space-y-4 pt-2 flex-1 overflow-y-auto">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium" style={{ color: "oklch(0.80 0.01 240)" }}>이름 <span className="text-red-400">*</span></Label>
                  <Input
                    value={editDriver.name}
                    onChange={(e) => setEditDriver((prev) => prev ? { ...prev, name: e.target.value } : prev)}
                    placeholder="홍길동"
                    className="h-10 rounded-xl border-0"
                    style={{ background: "oklch(0.14 0.04 252)", color: "oklch(0.92 0.005 240)", boxShadow: "inset 0 0 0 1px oklch(0.38 0.06 252 / 0.5)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium" style={{ color: "oklch(0.80 0.01 240)" }}>전화번호</Label>
                  <Input
                    value={editDriver.phone}
                    onChange={(e) => setEditDriver((prev) => prev ? { ...prev, phone: e.target.value } : prev)}
                    placeholder="010-0000-0000"
                    className="h-10 rounded-xl border-0"
                    style={{ background: "oklch(0.14 0.04 252)", color: "oklch(0.92 0.005 240)", boxShadow: "inset 0 0 0 1px oklch(0.38 0.06 252 / 0.5)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium" style={{ color: "oklch(0.80 0.01 240)" }}>차량번호</Label>
                  <Input
                    value={editDriver.vehicleNumber}
                    onChange={(e) => setEditDriver((prev) => prev ? { ...prev, vehicleNumber: e.target.value } : prev)}
                    placeholder="12가 3456"
                    className="h-10 rounded-xl border-0"
                    style={{ background: "oklch(0.14 0.04 252)", color: "oklch(0.92 0.005 240)", boxShadow: "inset 0 0 0 1px oklch(0.38 0.06 252 / 0.5)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium" style={{ color: "oklch(0.80 0.01 240)" }}>차종</Label>
                  <Input
                    value={editDriver.vehicleType}
                    onChange={(e) => setEditDriver((prev) => prev ? { ...prev, vehicleType: e.target.value } : prev)}
                    placeholder="1톤 트럭"
                    className="h-10 rounded-xl border-0"
                    style={{ background: "oklch(0.14 0.04 252)", color: "oklch(0.92 0.005 240)", boxShadow: "inset 0 0 0 1px oklch(0.38 0.06 252 / 0.5)" }}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium" style={{ color: "oklch(0.80 0.01 240)" }}>소속</Label>
                  <Input
                    value={editDriver.affiliation}
                    onChange={(e) => setEditDriver((prev) => prev ? { ...prev, affiliation: e.target.value } : prev)}
                    placeholder="소속 회사 또는 팀"
                    className="h-10 rounded-xl border-0"
                    style={{ background: "oklch(0.14 0.04 252)", color: "oklch(0.92 0.005 240)", boxShadow: "inset 0 0 0 1px oklch(0.38 0.06 252 / 0.5)" }}
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-4 flex-shrink-0">
                <Button
                  variant="outline"
                  className="flex-1 h-10"
                  onClick={() => setEditDriver(null)}
                >
                  취소
                </Button>
                <Button
                  className="flex-1 h-10 font-semibold"
                  style={{ background: "oklch(0.55 0.18 250)", color: "white" }}
                  disabled={!editDriver.name.trim() || adminUpdateDriver.isPending}
                  onClick={() => {
                    if (!editDriver.name.trim()) { toast.error("이름은 필수입니다."); return; }
                    adminUpdateDriver.mutate({
                      id: editDriver.id,
                      name: editDriver.name.trim(),
                      phone: editDriver.phone || undefined,
                      vehicleNumber: editDriver.vehicleNumber || null,
                      vehicleType: editDriver.vehicleType || null,
                      affiliation: editDriver.affiliation || null,
                    });
                  }}
                >
                  {adminUpdateDriver.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── 정산 상세 Sheet (기사 행 클릭 시 열림) ── */}
      <Sheet open={!!settlementDetailDriver} onOpenChange={(o) => { if (!o) { setSettlementDetailDriver(null); setShowPaymentForm(false); setPaymentForm({ amount: "", companyName: "", memo: "", paidAt: new Date().toISOString().slice(0, 10) }); } }}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto flex flex-col">
          <SheetHeader className="flex-shrink-0">
            <SheetTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-5 h-5" style={{ color: "oklch(0.38 0.12 250)" }} />
              {settlementDetailDriver?.name} 정산 상세
            </SheetTitle>
            <SheetDescription>총매출 / 지급된 금액 / 남은 금액</SheetDescription>
          </SheetHeader>

          {/* 요약 카드 3개 */}
          {settlementDetailDriver && (() => {
            const summary = settlementSummaryAll?.find((s: any) => s.driverId === settlementDetailDriver.id);
            const totalEarned = settlementDetailDriver.totalAmount;
            const totalPaid = summary?.totalPaid ?? 0;
            const remaining = totalEarned - totalPaid;
            return (
              <div className="grid grid-cols-3 gap-3 mt-4 flex-shrink-0">
                <div className="rounded-xl p-3 text-center" style={{ background: "oklch(0.55 0.18 145 / 0.08)", border: "1px solid oklch(0.55 0.18 145 / 0.20)" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "oklch(0.45 0.04 240)" }}>총매출</p>
                  <p className="text-base font-bold" style={{ color: "oklch(0.32 0.10 145)" }}>{totalEarned > 0 ? totalEarned.toLocaleString() + "원" : "-"}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: "oklch(0.38 0.12 250 / 0.08)", border: "1px solid oklch(0.38 0.12 250 / 0.20)" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "oklch(0.45 0.04 240)" }}>지급된 금액</p>
                  <p className="text-base font-bold" style={{ color: "oklch(0.28 0.10 250)" }}>{totalPaid > 0 ? totalPaid.toLocaleString() + "원" : "-"}</p>
                </div>
                <div className="rounded-xl p-3 text-center" style={{ background: remaining > 0 ? "oklch(0.62 0.22 25 / 0.08)" : "oklch(0.55 0.18 145 / 0.06)", border: remaining > 0 ? "1px solid oklch(0.62 0.22 25 / 0.25)" : "1px solid oklch(0.55 0.18 145 / 0.20)" }}>
                  <p className="text-xs font-medium mb-1" style={{ color: "oklch(0.45 0.04 240)" }}>남은 금액</p>
                  <p className="text-base font-bold" style={{ color: remaining > 0 ? "oklch(0.48 0.22 25)" : "oklch(0.38 0.12 145)" }}>
                    {remaining > 0 ? remaining.toLocaleString() + "원" : totalEarned > 0 ? "✔ 완납" : "-"}
                  </p>
                </div>
              </div>
            );
          })()}

          {/* 계좌정보 */}
          {settlementDetailDriver && (() => {
            const summary = settlementSummaryAll?.find((s: any) => s.driverId === settlementDetailDriver.id);
            return summary?.accountNumber ? (
              <div className="mt-3 flex-shrink-0 rounded-xl px-4 py-3 flex items-center gap-2" style={{ background: "oklch(0.97 0.006 240)", border: "1px solid oklch(0.92 0.006 240)" }}>
                <Wallet className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.55 0.04 240)" }} />
                <span className="text-xs" style={{ color: "oklch(0.45 0.04 240)" }}>
                  {summary.bankName && <span className="font-semibold mr-1">{summary.bankName}</span>}
                  {summary.accountNumber}
                  {summary.accountHolder && <span className="ml-1 text-gray-400">({summary.accountHolder})</span>}
                </span>
              </div>
            ) : null;
          })()}

          {/* 지급 등록 버튼 */}
          <div className="mt-4 flex-shrink-0">
            {!showPaymentForm ? (
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-98"
                style={{ background: "oklch(0.28 0.07 250)", color: "white" }}
                onClick={() => setShowPaymentForm(true)}
              >
                <Banknote className="w-4 h-4" />지급 등록
              </button>
            ) : (
              <div className="rounded-xl p-4 space-y-3" style={{ background: "oklch(0.97 0.006 240)", border: "1px solid oklch(0.92 0.006 240)" }}>
                <p className="text-sm font-semibold" style={{ color: "oklch(0.28 0.07 250)" }}>지급 등록</p>
                <div className="space-y-2">
                  <Input type="number" value={paymentForm.amount} onChange={(e) => setPaymentForm((f) => ({ ...f, amount: e.target.value }))} placeholder="지급 금액 (원)" className="h-9 text-sm" />
                  <Input value={paymentForm.companyName} onChange={(e) => setPaymentForm((f) => ({ ...f, companyName: e.target.value }))} placeholder="업체명 (지급자)" className="h-9 text-sm" />
                  <Input type="date" value={paymentForm.paidAt} onChange={(e) => setPaymentForm((f) => ({ ...f, paidAt: e.target.value }))} className="h-9 text-sm" />
                  <Input value={paymentForm.memo} onChange={(e) => setPaymentForm((f) => ({ ...f, memo: e.target.value }))} placeholder="메모 (선택)" className="h-9 text-sm" />
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => setShowPaymentForm(false)}>취소</Button>
                  <Button size="sm" className="flex-1 font-semibold" style={{ background: "oklch(0.28 0.07 250)", color: "white" }} onClick={handleAddPayment} disabled={addPayment.isPending}>
                    {addPayment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "등록"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* 지급 내역 목록 */}
          <div className="mt-4 flex-1 overflow-y-auto">
            <p className="text-xs font-semibold mb-3" style={{ color: "oklch(0.45 0.04 240)" }}>업체별 지급 내역</p>
            {paymentHistoryLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : !paymentHistory || paymentHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <Wallet className="w-8 h-8" style={{ color: "oklch(0.80 0.01 240)" }} />
                <p className="text-sm" style={{ color: "oklch(0.55 0.02 240)" }}>등록된 지급 내역이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {paymentHistory.map((p: any) => (
                  <div key={p.id} className="rounded-xl p-3" style={{ background: "oklch(0.985 0.004 240)", border: "1px solid oklch(0.92 0.006 240)" }}>
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "oklch(0.28 0.07 250)" }}>{p.companyName}</p>
                        <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.04 240)" }}>{new Date(p.paidAt).toLocaleDateString("ko-KR")}</p>
                        {p.memo && <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.04 240)" }}>{p.memo}</p>}
                      </div>
                      <span className="text-sm font-bold flex-shrink-0" style={{ color: "oklch(0.32 0.10 145)" }}>{p.amount.toLocaleString()}원</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* ── PIN 초기화 Dialog ── */}
      <Dialog open={!!pinResetDriver} onOpenChange={(o) => { if (!o) { setPinResetDriver(null); setPinResetValue(""); } }}>
        <DialogContent className="max-w-sm rounded-2xl" style={{ background: "oklch(0.18 0.05 252)", border: "1px solid oklch(0.32 0.06 252 / 0.6)" }}>
          <DialogHeader>
            <DialogTitle style={{ color: "oklch(0.92 0.005 240)" }} className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" style={{ color: "oklch(0.65 0.14 140)" }} />
              PIN 초기화
            </DialogTitle>
            <DialogDescription style={{ color: "oklch(0.58 0.018 240)" }}>
              <span style={{ color: "oklch(0.78 0.12 72)" }}>{pinResetDriver?.name}</span> 기사의 새 PIN을 설정합니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium" style={{ color: "oklch(0.80 0.01 240)" }}>새 PIN (4~8자리 숫자)</Label>
              <Input
                type="password"
                placeholder="새 PIN 입력"
                maxLength={8}
                value={pinResetValue}
                onChange={(e) => setPinResetValue(e.target.value.replace(/\D/g, "").slice(0, 8))}
                className="h-10 rounded-xl border-0"
                style={{ background: "oklch(0.14 0.04 252)", color: "oklch(0.92 0.005 240)", boxShadow: "inset 0 0 0 1px oklch(0.38 0.06 252 / 0.5)" }}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && pinResetValue.length >= 4 && pinResetDriver) {
                    resetDriverPin.mutate({ driverId: pinResetDriver.id, pin: pinResetValue });
                  }
                }}
              />
              <p className="text-xs" style={{ color: "oklch(0.50 0.018 240)" }}>기사에게 새 PIN을 직접 전달해 주세요.</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-10"
                onClick={() => { setPinResetDriver(null); setPinResetValue(""); }}
              >
                취소
              </Button>
              <Button
                className="flex-1 h-10 font-semibold"
                style={{ background: "oklch(0.65 0.14 140)", color: "white" }}
                disabled={pinResetValue.length < 4 || resetDriverPin.isPending}
                onClick={() => { if (pinResetDriver) resetDriverPin.mutate({ driverId: pinResetDriver.id, pin: pinResetValue }); }}
              >
                {resetDriverPin.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "PIN 설정"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 관리자 비밀번호 변경 다이얼로그 */}
      <Dialog open={changePwOpen} onOpenChange={(open) => { setChangePwOpen(open); if (!open) { setChangePwForm({ current: "", newPw: "", confirm: "" }); setChangePwError(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>관리자 비밀번호 변경</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 240)" }}>현재 비밀번호</label>
              <Input
                type="password"
                placeholder="현재 비밀번호"
                value={changePwForm.current}
                onChange={(e) => setChangePwForm(f => ({ ...f, current: e.target.value }))}
                disabled={changePwLoading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 240)" }}>새 비밀번호</label>
              <Input
                type="password"
                placeholder="새 비밀번호 (4자 이상)"
                value={changePwForm.newPw}
                onChange={(e) => setChangePwForm(f => ({ ...f, newPw: e.target.value }))}
                disabled={changePwLoading}
              />
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium" style={{ color: "oklch(0.30 0.02 240)" }}>새 비밀번호 확인</label>
              <Input
                type="password"
                placeholder="새 비밀번호 다시 입력"
                value={changePwForm.confirm}
                onChange={(e) => setChangePwForm(f => ({ ...f, confirm: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && handleChangePassword()}
                disabled={changePwLoading}
              />
            </div>
            {changePwError && (
              <p className="text-sm text-red-500">{changePwError}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setChangePwOpen(false)}
              disabled={changePwLoading}
            >
              취소
            </Button>
            <Button
              className="flex-1 font-semibold"
              style={{ background: "oklch(0.20 0.04 250)", color: "white" }}
              onClick={handleChangePassword}
              disabled={changePwLoading || !changePwForm.current || !changePwForm.newPw || !changePwForm.confirm}
            >
              {changePwLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "비밀번호 변경"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
