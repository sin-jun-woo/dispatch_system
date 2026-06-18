import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import {
  NAV_STYLE,
  CARD_STYLE,
  DRIVER_STATUS_CONFIG as BASE_DRIVER_STATUS_CONFIG,
  formatArrivalDeadlineKorean,
  getDeadlineUrgency,
} from "@/lib/design";
import { trpc } from "@/lib/trpc";
import { removeDriverToken } from "@/lib/driverAuth";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Truck, LogOut, MapPin, Clock, CheckCircle2, Loader2,
  ClipboardList, ArrowRight, RefreshCw, AlertCircle,
  Car, Phone, Building2, Camera, Upload, X, Image,
  FileText, Eye, ChevronLeft, ChevronRight, ZoomIn,
  Wrench, PlayCircle, PauseCircle, CalendarClock, Bell,
  Wallet, TrendingUp, CreditCard, BadgeCheck, CalendarDays,
} from "lucide-react";

// ─── 상태 설정 (design.ts 기반 + activeBg/Icon 확장) ──────────────────────────────────────
const DRIVER_STATUS_CONFIG = {
  idle: {
    ...BASE_DRIVER_STATUS_CONFIG.idle,
    activeBg: "linear-gradient(135deg, oklch(0.42 0.18 250), oklch(0.35 0.15 255))",
    Icon: PauseCircle,
  },
  driving: {
    ...BASE_DRIVER_STATUS_CONFIG.driving,
    activeBg: "linear-gradient(135deg, oklch(0.38 0.18 145), oklch(0.32 0.15 150))",
    Icon: PlayCircle,
  },
  repair: {
    ...BASE_DRIVER_STATUS_CONFIG.repair,
    activeBg: "linear-gradient(135deg, oklch(0.48 0.22 25), oklch(0.42 0.20 30))",
    Icon: Wrench,
  },
} as const;
type DriverStatus = keyof typeof DRIVER_STATUS_CONFIG;

// ─── 사진 미리보기 타입 ────────────────────────────────────────────────────
interface PreviewFile {
  file: File;
  previewUrl: string;
  id: string;
}

// ─── 라이트박스 ────────────────────────────────────────────────────────────
function Lightbox({
  photos,
  initialIndex,
  onClose,
}: {
  photos: { url: string; originalName?: string | null }[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(initialIndex);
  const prev = () => setIdx((i) => (i - 1 + photos.length) % photos.length);
  const next = () => setIdx((i) => (i + 1) % photos.length);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

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
            onClick={(e) => { e.stopPropagation(); prev(); }}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            className="absolute right-4 w-10 h-10 rounded-full flex items-center justify-center z-10"
            style={{ background: "oklch(0.25 0.03 240)", color: "oklch(0.85 0.01 240)" }}
            onClick={(e) => { e.stopPropagation(); next(); }}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}
      <div
        className="max-w-4xl max-h-[85vh] flex flex-col items-center gap-3"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={photos[idx].url}
          alt={photos[idx].originalName ?? "사진"}
          className="max-h-[75vh] max-w-full rounded-xl object-contain"
          style={{ boxShadow: "0 8px 40px oklch(0.05 0.02 240 / 0.8)" }}
        />
        <p className="text-sm" style={{ color: "oklch(0.65 0.02 240)" }}>
          {photos[idx].originalName ?? `사진 ${idx + 1}`}
          {photos.length > 1 && (
            <span className="ml-3 opacity-60">
              {idx + 1} / {photos.length}
            </span>
          )}
        </p>
      </div>
    </div>
  );
}

// ─── 작업일지 업로드 모달 ──────────────────────────────────────────────────
function WorkLogUploadDialog({
  open,
  onClose,
  dispatchOrderId,
  driverId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  dispatchOrderId: number;
  driverId: number;
  onSuccess: () => void;
}) {
  const [previews, setPreviews] = useState<PreviewFile[]>([]);
  const [memo, setMemo] = useState("");
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) {
      toast.error("이미지 파일만 선택할 수 있습니다.");
      return;
    }
    // 자동 리사이징 적용
    let totalOriginal = 0;
    let totalCompressed = 0;
    const { resizeImages, resizeResultToFile } = await import("@/lib/imageResize");
    const results = await resizeImages(arr, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 });
    const newPreviews: PreviewFile[] = results.map((result, i) => {
      totalOriginal += result.originalSize;
      totalCompressed += result.compressedSize;
      return {
        file: resizeResultToFile(result, arr[i]),
        previewUrl: URL.createObjectURL(result.blob),
        id: `${Date.now()}_${Math.random()}`,
      };
    });
    if (totalOriginal > totalCompressed) {
      const ratio = Math.round((1 - totalCompressed / totalOriginal) * 100);
      const origMB = (totalOriginal / (1024 * 1024)).toFixed(1);
      const compMB = (totalCompressed / (1024 * 1024)).toFixed(1);
      toast.info(`${arr.length}장 사진 자동 압축: ${origMB}MB → ${compMB}MB (${ratio}% 감소)`);
    }
    setPreviews((prev) => {
      const combined = [...prev, ...newPreviews];
      if (combined.length > 20) {
        toast.warning("최대 20장까지 업로드할 수 있습니다.");
        return combined.slice(0, 20);
      }
      return combined;
    });
  }, []);

  const removePreview = (id: string) => {
    setPreviews((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const handleUpload = async () => {
    if (previews.length === 0) {
      toast.error("사진을 1장 이상 선택해 주세요.");
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("dispatchOrderId", String(dispatchOrderId));
      formData.append("driverId", String(driverId));
      formData.append("memo", memo);
      previews.forEach((p) => formData.append("photos", p.file));

      const res = await fetch("/api/worklog/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "업로드 실패");

      toast.success(`사진 ${json.photos.length}장이 성공적으로 등록되었습니다.`, { duration: 4000 });
      previews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      setPreviews([]);
      setMemo("");
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err.message ?? "업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (uploading) return;
    previews.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    setPreviews([]);
    setMemo("");
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="sm:max-w-2xl rounded-2xl flex flex-col"
        style={{ background: "oklch(0.98 0.005 240)", border: "1px solid oklch(0.88 0.01 240)", maxHeight: '85dvh' }}
      >
        <DialogHeader className="flex-shrink-0">
          <DialogTitle
            className="text-xl font-bold flex items-center gap-2"
            style={{ color: "oklch(0.15 0.02 240)" }}
          >
            <Camera className="w-5 h-5" style={{ color: "oklch(0.28 0.07 250)" }} />
            작업일지 사진 등록
          </DialogTitle>
          <DialogDescription style={{ color: "oklch(0.52 0.02 240)" }}>
            송장, 작업 현장 사진 등을 여러 장 업로드할 수 있습니다. (최대 20장, 장당 16MB)
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 overflow-y-auto flex-1 pr-1">
          {/* 드래그앤드롭 업로드 영역 */}
          <div
            className="relative rounded-xl border-2 border-dashed transition-all duration-200 cursor-pointer"
            style={{
              borderColor: dragOver
                ? "oklch(0.28 0.07 250)"
                : "oklch(0.78 0.02 240)",
              background: dragOver
                ? "oklch(0.28 0.07 250 / 0.05)"
                : "oklch(0.96 0.005 240)",
            }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => e.target.files && addFiles(e.target.files)}
            />
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{
                  background: dragOver
                    ? "oklch(0.28 0.07 250 / 0.15)"
                    : "oklch(0.90 0.01 240)",
                }}
              >
                <Upload
                  className="w-7 h-7 transition-colors"
                  style={{ color: dragOver ? "oklch(0.28 0.07 250)" : "oklch(0.55 0.02 240)" }}
                />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold" style={{ color: "oklch(0.25 0.03 240)" }}>
                  사진을 드래그하거나 클릭하여 선택
                </p>
                <p className="text-xs mt-1" style={{ color: "oklch(0.55 0.02 240)" }}>
                  JPG, PNG, HEIC 등 이미지 파일 · 여러 장 동시 선택 가능
                </p>
              </div>
              {previews.length > 0 && (
                <span
                  className="text-xs font-semibold px-3 py-1 rounded-full"
                  style={{ background: "oklch(0.28 0.07 250 / 0.1)", color: "oklch(0.28 0.07 250)" }}
                >
                  {previews.length}장 선택됨
                </span>
              )}
            </div>
          </div>

          {/* 사진 미리보기 그리드 */}
          {previews.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: "oklch(0.35 0.03 240)" }}>
                선택된 사진 ({previews.length}장)
              </p>
              <div className="grid grid-cols-4 gap-2">
                {previews.map((p) => (
                  <div key={p.id} className="relative group aspect-square rounded-lg overflow-hidden">
                    <img
                      src={p.previewUrl}
                      alt={p.file.name}
                      className="w-full h-full object-cover"
                    />
                    {/* 오버레이 */}
                    <div
                      className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex items-center justify-center"
                      style={{ background: "oklch(0.05 0.02 240 / 0.55)" }}
                    >
                      <button
                        onClick={(e) => { e.stopPropagation(); removePreview(p.id); }}
                        className="w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-90"
                        style={{ background: "oklch(0.65 0.22 25)", color: "white" }}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {/* 파일명 */}
                    <div
                      className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[10px] truncate"
                      style={{
                        background: "linear-gradient(transparent, oklch(0.05 0.02 240 / 0.7))",
                        color: "white",
                      }}
                    >
                      {p.file.name}
                    </div>
                  </div>
                ))}
                {/* 추가 버튼 */}
                {previews.length < 20 && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors"
                    style={{
                      borderColor: "oklch(0.78 0.02 240)",
                      color: "oklch(0.55 0.02 240)",
                    }}
                  >
                    <Image className="w-5 h-5" />
                    <span className="text-[10px]">추가</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {/* 메모 입력 */}
          <div>
            <label className="text-xs font-semibold mb-1.5 block" style={{ color: "oklch(0.35 0.03 240)" }}>
              작업 메모 (선택)
            </label>
            <Textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="작업 내용, 특이사항 등을 입력하세요..."
              rows={3}
              className="resize-none text-sm"
              style={{ borderColor: "oklch(0.82 0.01 240)" }}
            />
          </div>

        </div>
        {/* 버튼 - 스크롤 영역 밖 고정 */}
        <div className="flex gap-3 pt-3 flex-shrink-0 border-t" style={{ borderColor: "oklch(0.88 0.01 240)" }}>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={uploading}
              className="flex-1 h-11"
            >
              취소
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || previews.length === 0}
              className="flex-1 h-11 font-semibold gap-2"
              style={
                previews.length > 0 && !uploading
                  ? {
                      background: "linear-gradient(135deg, oklch(0.28 0.07 250), oklch(0.35 0.09 255))",
                      color: "oklch(0.98 0.005 240)",
                      boxShadow: "0 2px 8px oklch(0.28 0.07 250 / 0.35)",
                    }
                  : {}
              }
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  업로드 중...
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  {previews.length > 0 ? `${previews.length}장 등록하기` : "사진을 선택하세요"}
                </>
              )}
            </Button>
          </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── 등록된 작업일지 뷰어 ──────────────────────────────────────────────────
function WorkLogViewer({
  dispatchOrderId,
  driverId,
}: {
  dispatchOrderId: number;
  driverId: number;
}) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const { data: workLog, refetch } = trpc.workLog.getByDispatchOrder.useQuery(
    { dispatchOrderId },
    { refetchInterval: 5000 }
  );

  if (!workLog) return null;

  const photos = workLog.photos ?? [];

  return (
    <div
      className="mt-3 rounded-xl p-4"
      style={{
        background: "oklch(0.96 0.008 240)",
        border: "1px solid oklch(0.85 0.01 240)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <FileText className="w-4 h-4" style={{ color: "oklch(0.28 0.07 250)" }} />
        <span className="text-xs font-bold" style={{ color: "oklch(0.25 0.03 240)" }}>
          등록된 작업일지
        </span>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ background: "oklch(0.28 0.07 250 / 0.1)", color: "oklch(0.28 0.07 250)" }}
        >
          사진 {photos.length}장
        </span>
        <span className="text-xs ml-auto" style={{ color: "oklch(0.55 0.02 240)" }}>
          {new Date(workLog.createdAt).toLocaleString("ko-KR", {
            month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
          })}
        </span>
      </div>
      {workLog.memo && (
        <p className="text-xs mb-3 p-2 rounded-lg" style={{ background: "oklch(0.92 0.01 240)", color: "oklch(0.35 0.03 240)" }}>
          {workLog.memo}
        </p>
      )}
      {photos.length > 0 && (
        <div className="grid grid-cols-5 gap-1.5">
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
      )}
      {lightboxIdx !== null && (
        <Lightbox
          photos={photos.map((p) => ({ url: p.storageUrl, originalName: p.originalName }))}
          initialIndex={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

// ─── 프로필 수정 모달 ─────────────────────────────────────────────────────
function ProfileEditDialog({
  open,
  onClose,
  driver,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  driver: {
    id: number;
    name: string;
    vehicleNumber?: string | null;
    vehicleType?: string | null;
    affiliation?: string | null;
    phone: string;
    vehiclePhotoUrl?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
  };
  onSuccess: () => void;
}) {
  const [tab, setTab] = useState<"basic" | "vehicle" | "bank" | "pin">("basic");
  // 기본정보 탭
  const [name, setName] = useState(driver.name ?? "");
  const [phone, setPhone] = useState(driver.phone ?? "");
  const [affiliation, setAffiliation] = useState(driver.affiliation ?? "");
  // 차량정보 탭
  const [vehicleNumber, setVehicleNumber] = useState(driver.vehicleNumber ?? "");
  const [vehicleType, setVehicleType] = useState(driver.vehicleType ?? "");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(driver.vehiclePhotoUrl ?? null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoResizing, setPhotoResizing] = useState(false);
  const [photoSizeInfo, setPhotoSizeInfo] = useState<{ original: string; compressed: string; ratio: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // 계좌정보 탭
  const [bankName, setBankName] = useState(driver.bankName ?? "");
  const [accountNumber, setAccountNumber] = useState(driver.accountNumber ?? "");
  const [accountHolder, setAccountHolder] = useState(driver.accountHolder ?? "");
  // PIN 변경 탭
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const utils = trpc.useUtils();

  const updateProfile = trpc.driver.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("정보가 저장되었습니다.");
      utils.driver.me.invalidate();
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const changePin = trpc.driver.changePin.useMutation({
    onSuccess: () => {
      toast.success("PIN이 변경되었습니다.");
      setCurrentPin(""); setNewPin(""); setConfirmPin("");
      onClose();
    },
    onError: (e) => toast.error(e.message),
  });

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("이미지 파일만 업로드 가능합니다."); return; }
    setPhotoResizing(true);
    setPhotoSizeInfo(null);
    try {
      const { resizeImage, resizeResultToFile, formatFileSize } = await import("@/lib/imageResize");
      const result = await resizeImage(file, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 });
      const resizedFile = resizeResultToFile(result, file);
      setPhotoFile(resizedFile);
      const url = URL.createObjectURL(result.blob);
      setPhotoPreview(url);
      setPhotoSizeInfo({
        original: formatFileSize(result.originalSize),
        compressed: formatFileSize(result.compressedSize),
        ratio: result.compressionRatio,
      });
    } catch {
      // 리사이징 실패 시 원본 사용
      setPhotoFile(file);
      const url = URL.createObjectURL(file);
      setPhotoPreview(url);
    } finally {
      setPhotoResizing(false);
    }
  };

  const handleSaveBasic = () => {
    if (!name.trim()) { toast.error("이름은 필수입니다."); return; }
    updateProfile.mutate({
      name: name.trim(),
      phone: phone || undefined,
      affiliation: affiliation || undefined,
    }, { onSuccess: onClose });
  };

  const handleSaveVehicle = async () => {
    setPhotoUploading(true);
    try {
      // 1. 차량정보 텍스트 저장
      await updateProfile.mutateAsync({
        vehicleNumber: vehicleNumber || undefined,
        vehicleType: vehicleType || undefined,
      });
      // 2. 사진 업로드 (선택적)
      if (photoFile) {
        const { getDriverToken } = await import("@/lib/driverAuth");
        const token = getDriverToken();
        const formData = new FormData();
        formData.append("driverId", String(driver.id));
        formData.append("photo", photoFile);
        const res = await fetch("/api/driver/upload-vehicle-photo", {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
          credentials: "include",
        });
        if (!res.ok) {
          const json = await res.json();
          toast.warning(`차량정보는 저장되었지만 사진 업로드에 실패했습니다: ${json.error}`);
        } else {
          toast.success("차량 정보와 사진이 저장되었습니다.");
        }
        utils.driver.me.invalidate();
      } else {
        toast.success("차량 정보가 저장되었습니다.");
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? "저장에 실패했습니다.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const handlePinChange = () => {
    if (newPin.length < 4) return toast.error("PIN은 4자리 이상이어야 합니다.");
    if (newPin !== confirmPin) return toast.error("새 PIN이 일치하지 않습니다.");
    changePin.mutate({ currentPin, newPin });
  };

  const updateBankInfo = trpc.driver.updateBankInfo.useMutation({
    onSuccess: () => {
      toast.success("계좌정보가 저장되었습니다.");
      utils.driver.me.invalidate();
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  const handleSaveBank = () => {
    updateBankInfo.mutate({
      driverId: driver.id,
      bankName: bankName || undefined,
      accountNumber: accountNumber || undefined,
      accountHolder: accountHolder || undefined,
    });
  };

  const TABS = [
    { key: "basic" as const, label: "기본정보" },
    { key: "vehicle" as const, label: "차량정보" },
    { key: "bank" as const, label: "계좌정보" },
    { key: "pin" as const, label: "PIN변경" },
  ];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md rounded-2xl flex flex-col max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">내 정보 수정</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">로그인 후 본인이 직접 수정할 수 있습니다.</DialogDescription>
        </DialogHeader>

        {/* 탭 선택 */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg flex-shrink-0">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`flex-1 py-1.5 text-sm rounded-md font-medium transition-colors ${
                tab === t.key ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 기본정보 탭 */}
        {tab === "basic" && (
          <div className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">이름 <span className="text-red-500">*</span></Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">전화번호</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010-0000-0000" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">소속</Label>
              <Input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} placeholder="소속 회사 또는 팀" className="h-10" />
            </div>
            </div>
            <div className="flex gap-2 pt-3 flex-shrink-0">
              <Button variant="outline" className="flex-1 h-10" onClick={onClose}>취소</Button>
              <Button
                className="flex-1 h-10 font-semibold"
                onClick={handleSaveBasic}
                disabled={updateProfile.isPending}
              >
                {updateProfile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
              </Button>
            </div>
          </div>
        )}

        {/* 차량정보 탭 */}
        {tab === "vehicle" && (
          <div className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">차량번호</Label>
              <Input value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} placeholder="12가 3456" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">차종</Label>
              <Input value={vehicleType} onChange={(e) => setVehicleType(e.target.value)} placeholder="1톤 트럭" className="h-10" />
            </div>
            {/* 차량 사진 업로드 */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">차량 사진</Label>
              <div
                className="relative border-2 border-dashed rounded-xl overflow-hidden cursor-pointer transition-colors hover:border-primary/50"
                style={{ minHeight: 140, borderColor: "oklch(0.85 0.02 240)" }}
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? (
                  <>
                    <img src={photoPreview} alt="차량 사진" className="w-full h-36 object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: "rgba(0,0,0,0.4)" }}>
                      <span className="text-white text-sm font-medium flex items-center gap-1"><Camera className="w-4 h-4" /> 사진 변경</span>
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-36 gap-2" style={{ color: "oklch(0.60 0.02 240)" }}>
                    <Upload className="w-8 h-8" />
                    <span className="text-sm">클릭하여 차량 사진 업로드</span>
                    <span className="text-xs">JPG, PNG, WEBP · 최대 10MB</span>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoChange} />
              {photoResizing && (
                <p className="text-xs text-blue-500 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" /> 이미지 최적화 중...
                </p>
              )}
              {photoFile && !photoResizing && (
                <div className="text-xs text-muted-foreground space-y-0.5">
                  <p className="flex items-center gap-1">
                    <Image className="w-3 h-3" /> {photoFile.name}
                  </p>
                  {photoSizeInfo && (
                    <p className="text-green-600">
                      {photoSizeInfo.original} → {photoSizeInfo.compressed}
                      {photoSizeInfo.ratio > 0 && ` (${photoSizeInfo.ratio}% 압축)`}
                    </p>
                  )}
                </div>
              )}
            </div>
            </div>
            <div className="flex gap-2 pt-3 flex-shrink-0">
              <Button variant="outline" className="flex-1 h-10" onClick={onClose}>취소</Button>
              <Button
                className="flex-1 h-10 font-semibold"
                onClick={handleSaveVehicle}
                disabled={updateProfile.isPending || photoUploading}
              >
                {(updateProfile.isPending || photoUploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
              </Button>
            </div>
          </div>
        )}

        {/* 계좌정보 탭 */}
        {tab === "bank" && (
          <div className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">은행명</Label>
              <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="예: 국민은행, 신한은행" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">계좌번호</Label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="예: 110-123-456789" className="h-10" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">예금주</Label>
              <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="예금주 성명" className="h-10" />
            </div>
            <p className="text-xs text-muted-foreground">관리자가 정산 지급 시 사용하는 계좌정보입니다.</p>
            </div>
            <div className="flex gap-2 pt-3 flex-shrink-0">
              <Button variant="outline" className="flex-1 h-10" onClick={onClose}>취소</Button>
              <Button
                className="flex-1 h-10 font-semibold"
                onClick={handleSaveBank}
                disabled={updateBankInfo.isPending}
              >
                {updateBankInfo.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "저장"}
              </Button>
            </div>
          </div>
        )}

        {/* PIN 변경 탭 */}
        {tab === "pin" && (
          <div className="flex flex-col flex-1 min-h-0">
          <div className="space-y-4 py-2 flex-1 overflow-y-auto">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">현재 PIN</Label>
              <Input type="password" value={currentPin} onChange={(e) => setCurrentPin(e.target.value)} placeholder="현재 PIN 입력" className="h-10" maxLength={8} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">새 PIN</Label>
              <Input type="password" value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="새 PIN (4~8자리)" className="h-10" maxLength={8} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">새 PIN 확인</Label>
              <Input type="password" value={confirmPin} onChange={(e) => setConfirmPin(e.target.value)} placeholder="새 PIN 다시 입력" className="h-10" maxLength={8} />
            </div>
            </div>
            <div className="flex gap-2 pt-3 flex-shrink-0">
              <Button variant="outline" className="flex-1 h-10" onClick={onClose}>취소</Button>
              <Button
                className="flex-1 h-10 font-semibold"
                onClick={handlePinChange}
                disabled={changePin.isPending || !currentPin || !newPin || !confirmPin}
              >
                {changePin.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "PIN 변경"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── 메인 컴포넌트 ────────────────────────────────────────────────────────
export default function DriverDashboard() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [confirmingIds, setConfirmingIds] = useState<Set<number>>(new Set());
  const [uploadDialogDispatchId, setUploadDialogDispatchId] = useState<number | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);
  // 메인 탭 (현재배차 / 이력 / 정산현황)
  const [mainTab, setMainTab] = useState<"current" | "history" | "settlement">("current");
  // 이력 탭 월 선택
  const now = new Date();
  const [histYear, setHistYear] = useState(now.getFullYear());
  const [histMonth, setHistMonth] = useState(now.getMonth() + 1);
  // 정산 탭 월 선택
  const [settlYear, setSettlYear] = useState(now.getFullYear());
  const [settlMonth, setSettlMonth] = useState(now.getMonth() + 1);
  // 운행 완료 모달
  const [completeDialogId, setCompleteDialogId] = useState<number | null>(null);
  const [tripCountInput, setTripCountInput] = useState("1");
  const [completingIds, setCompletingIds] = useState<Set<number>>(new Set());

  // ─ 로그인 세션 기반 기사 정보 조회 ─
  const { data: driver, isLoading: driverLoading } = trpc.driver.me.useQuery(undefined, {
    retry: false,
  });
  const driverId = driver?.id ?? null;

  const logoutMutation = trpc.driver.logout.useMutation({
    onSuccess: () => {
      // localStorage 토큰 삭제
      removeDriverToken();
      utils.driver.me.invalidate();
      navigate("/driver/login");
    },
  });

  // 미로그인 리다이렉트
  useEffect(() => {
    if (!driverLoading && !driver) navigate("/driver/login");
  }, [driver, driverLoading, navigate]);

  const updateStatus = trpc.driver.updateStatus.useMutation({
    onMutate: () => setStatusUpdating(true),
    onSuccess: () => {
      utils.driver.me.invalidate();
      utils.driver.list.invalidate();
      toast.success("상태가 변경되었습니다.", { duration: 2500 });
    },
    onError: (e) => toast.error(e.message),
    onSettled: () => setStatusUpdating(false),
  });

  const handleStatusChange = (status: DriverStatus) => {
    if (!driverId || statusUpdating) return;
    if (driver?.status === status) return;
    updateStatus.mutate({ id: driverId, status });
  };

  const completeDispatch = trpc.dispatch.complete.useMutation({
    onMutate: async ({ id }) => {
      setCompletingIds((prev) => new Set(prev).add(id));
    },
    onSuccess: (data, { id }) => {
      setCompletingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      setCompleteDialogId(null);
      setTripCountInput("1");
      if (data.alreadyCompleted) toast.info("이미 완료된 배차입니다.");
      else {
        const amt = data.totalAmount ?? 0;
        toast.success(
          amt > 0
            ? `운행 완료! 정산 금액: ${amt.toLocaleString()}원`
            : "운행이 완료되었습니다.",
          { duration: 5000 }
        );
      }
      utils.dispatch.listByDriver.invalidate({ driverId: driverId! });
      utils.driver.me.invalidate();
    },
    onError: (e, { id }) => {
      setCompletingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      toast.error(e.message);
    },
  });

  const handleComplete = () => {
    if (!completeDialogId || !driverId) return;
    const count = parseInt(tripCountInput, 10);
    if (isNaN(count) || count < 1) { toast.error("회차 수를 1 이상 입력해주세요."); return; }
    completeDispatch.mutate({ id: completeDialogId, driverId, tripCount: count });
  };

  const { data: dispatches, isLoading, refetch } = trpc.dispatch.listByDriver.useQuery(
    { driverId: driverId! },
    { enabled: !!driverId, refetchInterval: 3000 }
  );

  // ─ 알림 팝업 상태 ─
  const [notifIndex, setNotifIndex] = useState(0); // 현재 표시 중인 알림 인덱스

  const { data: unreadNotifs, refetch: refetchNotifs } = trpc.notification.getUnread.useQuery(
    { driverId: driverId! },
    { enabled: !!driverId, refetchInterval: 10000 }
  );

  const markNotifRead = trpc.notification.markRead.useMutation({
    onSuccess: () => {
      refetchNotifs();
    },
  });

  const markAllNotifsRead = trpc.notification.markAllRead.useMutation({
    onSuccess: () => {
      refetchNotifs();
    },
  });

  // 현재 표시할 알림
  const currentNotif = unreadNotifs && unreadNotifs.length > 0 ? unreadNotifs[notifIndex] ?? unreadNotifs[0] : null;

  const handleCloseNotif = () => {
    if (!currentNotif || !driverId) return;
    markNotifRead.mutate({ notificationId: currentNotif.id, driverId });
    // 다음 알림으로 이동 (refetch 후 자동 갱신)
    setNotifIndex(0);
  };

  // ─ 정산 탭 쿼리 ─
  const { data: settlementData, isLoading: settlLoading } = trpc.driver.mySettlement.useQuery(
    { driverId: driverId!, year: settlYear, month: settlMonth },
    { enabled: !!driverId && mainTab === "settlement", refetchInterval: 10000 }
  );
  const { data: settlAllTime } = trpc.driver.mySettlementAllTime.useQuery(
    { driverId: driverId! },
    { enabled: !!driverId && mainTab === "settlement" }
  );

  // ─ 이력 탭 쿼리 ─
  const { data: historyItems, isLoading: histLoading } = trpc.driver.completedHistory.useQuery(
    { year: histYear, month: histMonth },
    { enabled: !!driverId && mainTab === "history" }
  );
  const { data: monthlyEarnings } = trpc.driver.monthlyEarnings.useQuery(
    undefined,
    { enabled: !!driverId && mainTab === "history" }
  );
  const thisMonthEarnings = monthlyEarnings?.find(
    (e) => e.year === histYear && e.month === histMonth
  );

  const confirmDispatch = trpc.dispatch.confirm.useMutation({
    onMutate: async ({ id }) => {
      setConfirmingIds((prev) => new Set(prev).add(id));
      await utils.dispatch.listByDriver.cancel({ driverId: driverId! });
      const prev = utils.dispatch.listByDriver.getData({ driverId: driverId! });
      utils.dispatch.listByDriver.setData({ driverId: driverId! }, (old) =>
        old?.map((d) => d.id === id ? { ...d, approvalStatus: "confirmed" as const } : d)
      );
      return { prev };
    },
    onSuccess: (data, { id }) => {
      setConfirmingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (data.alreadyConfirmed) toast.info("이미 승인된 배차입니다.");
      else toast.success("배차를 승인했습니다. 관리자 페이지에 즉시 반영됩니다.", { duration: 4000 });
      utils.dispatch.listByDriver.invalidate({ driverId: driverId! });
    },
    onError: (e, { id }, ctx) => {
      setConfirmingIds((prev) => { const n = new Set(prev); n.delete(id); return n; });
      if (ctx?.prev) utils.dispatch.listByDriver.setData({ driverId: driverId! }, ctx.prev);
      toast.error(e.message);
    },
  });

  const handleLogout = () => logoutMutation.mutate();

  const pendingCount = dispatches?.filter((d) => d.approvalStatus === "pending").length ?? 0;
  const confirmedCount = dispatches?.filter((d) => d.approvalStatus === "confirmed").length ?? 0;
  const totalCount = dispatches?.length ?? 0;

  // 로딩 중
  if (driverLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "oklch(0.97 0.006 240)" }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: "oklch(0.28 0.07 250)" }} />
      </div>
    );
  }

  if (!driver) return null;

  return (
    <div
      className="min-h-screen"
      style={{ background: "oklch(0.97 0.006 240)", fontFamily: "'Noto Sans KR', 'Inter', sans-serif" }}
    >
      {/* Nav */}
      <nav className="sticky top-0 z-40 flex items-center justify-between px-6 py-4" style={NAV_STYLE}>
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "oklch(0.55 0.18 250 / 0.2)", border: "1px solid oklch(0.55 0.18 250 / 0.3)" }}
          >
            <Truck className="w-4 h-4" style={{ color: "oklch(0.65 0.15 250)" }} />
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: "oklch(0.96 0.005 240)" }}>기사 대시보드</span>
            {driver && (
              <span
                className="ml-2 text-xs px-2 py-0.5 rounded-full"
                style={{ background: "oklch(0.55 0.18 250 / 0.15)", color: "oklch(0.65 0.15 250)" }}
              >
                {driver.name}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* 미확인 배차 알림 배지 */}
          {pendingCount > 0 && (
            <div className="relative flex items-center">
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold animate-pulse"
                style={{
                  background: "oklch(0.55 0.18 250 / 0.2)",
                  border: "1px solid oklch(0.55 0.18 250 / 0.5)",
                  color: "oklch(0.75 0.15 250)",
                }}
              >
                <Bell className="w-3.5 h-3.5" />
                <span>새 배차 {pendingCount}건</span>
              </div>
            </div>
          )}
          <Button variant="ghost" size="sm" onClick={() => refetch()} className="gap-1 sm:gap-2" style={{ color: "oklch(0.68 0.02 240)" }}>
            <RefreshCw className="w-4 h-4" /><span className="hidden sm:inline">새로고침</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setProfileEditOpen(true)} className="gap-1 sm:gap-2" style={{ color: "oklch(0.68 0.02 240)" }}>
            <Car className="w-4 h-4" /><span className="hidden sm:inline">내 정보</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-1 sm:gap-2" style={{ color: "oklch(0.68 0.02 240)" }}>
            <LogOut className="w-4 h-4" /><span className="hidden sm:inline">로그아웃</span>
          </Button>
        </div>
      </nav>

      <div className="max-w-4xl mx-auto px-3 sm:px-6 py-5 sm:py-8">
        {/* Driver Info Card */}
        {driver && (
          <div
            className="rounded-2xl p-5 mb-5"
            style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.90 0.008 240)", boxShadow: "0 1px 4px oklch(0.15 0.02 240 / 0.06)" }}
          >
            <div className="flex items-center gap-4">
              {/* 차량 사진 또는 이니셜 아바타 */}
              {driver.vehiclePhotoUrl ? (
                <div
                  className="w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer"
                  style={{ border: "1.5px solid oklch(0.88 0.01 240)" }}
                  onClick={() => setProfileEditOpen(true)}
                  title="내 정보 수정"
                >
                  <img src={driver.vehiclePhotoUrl} alt="차량 사진" className="w-full h-full object-cover" />
                </div>
              ) : (
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center text-base font-bold flex-shrink-0 cursor-pointer"
                  style={{ background: "oklch(0.28 0.07 250 / 0.08)", color: "oklch(0.28 0.07 250)" }}
                  onClick={() => setProfileEditOpen(true)}
                  title="내 정보 수정"
                >
                  {driver.name[0]}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold" style={{ color: "oklch(0.12 0.02 240)" }}>{driver.name}</p>
                <div className="flex flex-wrap gap-2 mt-0.5">
                  {driver.vehicleNumber && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>
                      <Car className="w-3 h-3" /> {driver.vehicleNumber}
                    </span>
                  )}
                  {driver.vehicleType && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>
                      <Truck className="w-3 h-3" /> {driver.vehicleType}
                    </span>
                  )}
                  <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>
                    <Phone className="w-3 h-3" /> {driver.phone}
                  </span>
                  {driver.affiliation && (
                    <span className="flex items-center gap-1 text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>
                      <Building2 className="w-3 h-3" /> {driver.affiliation}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-4 text-center flex-shrink-0">
                <div>
                  <p className="text-xl font-bold" style={{ color: "oklch(0.12 0.02 240)" }}>{totalCount}</p>
                  <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>전체</p>
                </div>
                <div className="w-px" style={{ background: "oklch(0.90 0.008 240)" }} />
                <div>
                  <p className="text-xl font-bold" style={{ color: "oklch(0.48 0.16 55)" }}>{pendingCount}</p>
                  <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>대기</p>
                </div>
                <div className="w-px" style={{ background: "oklch(0.90 0.008 240)" }} />
                <div>
                  <p className="text-xl font-bold" style={{ color: "oklch(0.38 0.15 155)" }}>{confirmedCount}</p>
                  <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>확인</p>
                </div>
              </div>
            </div>
            {/* ─ 상태 선택 버튼 ─ */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid oklch(0.92 0.008 240)" }}>
              <p className="text-xs font-medium mb-2.5" style={{ color: "oklch(0.55 0.02 240)" }}>내 현재 상태</p>
              <div className="flex gap-2">
                {(Object.keys(DRIVER_STATUS_CONFIG) as DriverStatus[]).map((s) => {
                  const cfg = DRIVER_STATUS_CONFIG[s];
                  const isActive = driver?.status === s;
                  const { Icon } = cfg;
                  return (
                    <button
                      key={s}
                      onClick={() => handleStatusChange(s)}
                      disabled={statusUpdating}
                      className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 active:scale-95"
                      style={isActive
                        ? { background: cfg.activeBg, color: "white" }
                        : { background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }
                      }
                    >
                      {statusUpdating && driver?.status !== s ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Icon className="w-3.5 h-3.5" />
                      )}
                      {cfg.label}
                      {isActive && <span className="text-[9px] opacity-75">현재</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* 대기 알림 배너 */}
        {pendingCount > 0 && (
          <div
            className="rounded-xl p-4 mb-5 flex items-center gap-3"
            style={{ background: "oklch(0.65 0.18 55 / 0.08)", border: "1px solid oklch(0.65 0.18 55 / 0.3)" }}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" style={{ color: "oklch(0.55 0.18 55)" }} />
            <p className="text-sm font-medium" style={{ color: "oklch(0.45 0.14 55)" }}>
              승인 대기 중인 직접배차가 <strong>{pendingCount}건</strong> 있습니다.
            </p>
          </div>
        )}

        {/* ─ 메인 탭 헤더 ─ */}
        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: "oklch(0.92 0.008 240)" }}>
          {[
            { key: "current" as const, label: "현재 배차", icon: ClipboardList },
            { key: "history" as const, label: "운행 이력", icon: CalendarClock },
            { key: "settlement" as const, label: "정산 현황", icon: Wallet },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setMainTab(key)}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium rounded-lg transition-all duration-150"
              style={mainTab === key
                ? { background: "oklch(1 0 0)", color: "oklch(0.15 0.02 240)", boxShadow: "0 1px 4px oklch(0.15 0.02 240 / 0.10)" }
                : { color: "oklch(0.50 0.02 240)" }}
            >
              <Icon className="w-4 h-4" />{label}
            </button>
          ))}
        </div>

        {/* ─ 현재 배차 탭 ─ */}
        {mainTab === "current" && (
          <>
            {/* 자동 갱신 안내 */}
            <div className="mb-4 flex items-center justify-end">
              <span className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>3초마다 자동 갱신</span>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.28 0.07 250)" }} />
              </div>
            ) : !dispatches || dispatches.length === 0 ? (
              <div className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3" style={CARD_STYLE}>
                <ClipboardList className="w-10 h-10" style={{ color: "oklch(0.75 0.01 240)" }} />
                <p className="text-sm font-medium" style={{ color: "oklch(0.35 0.02 240)" }}>배차된 내역이 없습니다.</p>
                <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>관리자가 배차를 생성하면 여기에 표시됩니다.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {dispatches.map((d) => {
              const isPending = d.approvalStatus === "pending";
              const isConfirmed = d.approvalStatus === "confirmed";
              const isCompleted = d.approvalStatus === "completed";
              const isForced = d.dispatchType === "forced";
              const isConfirming = confirmingIds.has(d.id);
              const isCompleting = completingIds.has(d.id);

              return (
                <div
                  key={d.id}
                  className="rounded-2xl p-5 transition-all duration-300"
                  style={{
                    ...CARD_STYLE,
                    ...(isPending && isForced
                      ? { border: "1px solid oklch(0.65 0.18 55 / 0.35)", boxShadow: "0 2px 16px oklch(0.65 0.18 55 / 0.10)" }
                      : isCompleted
                      ? { border: "1px solid oklch(0.55 0.18 250 / 0.25)", boxShadow: "0 1px 8px oklch(0.55 0.18 250 / 0.06)", opacity: 0.85 }
                      : isConfirmed
                      ? { border: "1px solid oklch(0.55 0.18 155 / 0.25)", boxShadow: "0 1px 8px oklch(0.55 0.18 155 / 0.06)" }
                      : {}),
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                    {/* 좌측: 정보 */}
                    <div className="flex-1 min-w-0">
                      {/* 배지 */}
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span
                          className="text-xs font-mono font-semibold px-2 py-0.5 rounded"
                          style={{ background: "oklch(0.94 0.01 240)", color: "oklch(0.35 0.04 250)" }}
                        >
                          #{String(d.id).padStart(4, "0")}
                        </span>
                        {isForced && (
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ background: "oklch(0.28 0.07 250 / 0.1)", color: "oklch(0.28 0.07 250)", border: "1px solid oklch(0.28 0.07 250 / 0.2)" }}
                          >
                            직접배차
                          </span>
                        )}
                        {isPending ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ background: "oklch(0.65 0.18 55 / 0.12)", color: "oklch(0.50 0.16 55)", border: "1px solid oklch(0.65 0.18 55 / 0.3)" }}
                          >
                            <Clock className="w-3 h-3" />대기
                          </span>
                        ) : isCompleted ? (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ background: "oklch(0.55 0.18 250 / 0.12)", color: "oklch(0.35 0.12 250)", border: "1px solid oklch(0.55 0.18 250 / 0.3)" }}
                          >
                            <CheckCircle2 className="w-3 h-3" />완료
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full"
                            style={{ background: "oklch(0.55 0.18 155 / 0.12)", color: "oklch(0.40 0.15 155)", border: "1px solid oklch(0.55 0.18 155 / 0.3)" }}
                          >
                            <CheckCircle2 className="w-3 h-3" />확인
                          </span>
                        )}
                      </div>

                      {/* 경로 */}
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.55 0.18 250 / 0.12)" }}>
                            <MapPin className="w-3.5 h-3.5" style={{ color: "oklch(0.55 0.18 250)" }} />
                          </div>
                          <span className="text-sm font-medium" style={{ color: "oklch(0.25 0.03 240)" }}>{d.pickupLocation}</span>
                        </div>
                        <ArrowRight className="w-4 h-4 flex-shrink-0" style={{ color: "oklch(0.65 0.02 240)" }} />
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.55 0.18 155 / 0.12)" }}>
                            <MapPin className="w-3.5 h-3.5" style={{ color: "oklch(0.55 0.18 155)" }} />
                          </div>
                          <span className="text-sm font-medium" style={{ color: "oklch(0.25 0.03 240)" }}>{d.dropoffLocation}</span>
                        </div>
                      </div>

                      {d.memo && (
                        <p className="text-xs mb-1" style={{ color: "oklch(0.55 0.02 240)" }}>메모: {d.memo}</p>
                      )}
                      {/* 도착 기한 urgency 표시 */}
                      {(d as any).arrivalDeadline && !isCompleted && (() => {
                        const urgency = getDeadlineUrgency((d as any).arrivalDeadline);
                        const deadlineColor = urgency === "overdue" ? "oklch(0.52 0.22 25)" : urgency === "urgent" ? "oklch(0.48 0.18 55)" : "oklch(0.55 0.04 240)";
                        const deadlineBg = urgency === "overdue" ? "oklch(0.62 0.22 25 / 0.10)" : urgency === "urgent" ? "oklch(0.65 0.18 55 / 0.10)" : "transparent";
                        return (
                          <p className="text-xs mb-1 flex items-center gap-1 px-1.5 py-0.5 rounded-md font-medium inline-flex" style={{ color: deadlineColor, background: deadlineBg }}>
                            <CalendarClock className="w-3 h-3 flex-shrink-0" />
                            {urgency === "overdue" && <span className="font-bold">⚠ 기한초과 </span>}
                            {urgency === "urgent" && <span className="font-bold">⏰ 임박 </span>}
                            {formatArrivalDeadlineKorean(new Date((d as any).arrivalDeadline).toISOString())}까지
                          </p>
                        );
                      })()}
                      {/* 회차 단가 표시 */}
                      {d.unitPrice != null && d.unitPrice > 0 && (
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span
                            className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
                            style={{ background: "oklch(0.45 0.12 145 / 0.10)", color: "oklch(0.38 0.12 145)", border: "1px solid oklch(0.45 0.12 145 / 0.25)" }}
                          >
                            ₩ 회차 단가: {d.unitPrice.toLocaleString()}원/회
                          </span>
                          {isCompleted && d.tripCount != null && (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded"
                              style={{ background: "oklch(0.55 0.18 250 / 0.10)", color: "oklch(0.35 0.12 250)", border: "1px solid oklch(0.55 0.18 250 / 0.25)" }}
                            >
                              {d.tripCount}회 × {d.unitPrice.toLocaleString()}원 = <strong className="ml-1">{(d.totalAmount ?? 0).toLocaleString()}원</strong>
                            </span>
                          )}
                        </div>
                      )}
                      <p className="text-xs" style={{ color: "oklch(0.62 0.02 240)" }}>
                        배차: {new Date(d.createdAt).toLocaleString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                        {d.confirmedAt && (
                          <span className="ml-3 font-medium" style={{ color: "oklch(0.40 0.15 155)" }}>
                            승인: {new Date(d.confirmedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                        {d.completedAt && (
                          <span className="ml-3 font-medium" style={{ color: "oklch(0.35 0.12 250)" }}>
                            완료: {new Date(d.completedAt).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                          </span>
                        )}
                      </p>
                    </div>

                    {/* 우측: 버튼 */}
                    <div className="flex sm:flex-col flex-row flex-wrap items-stretch sm:items-end gap-2">
                      {/* 직접배차 승인 버튼 */}
                      {isForced && (
                        <Button
                          onClick={() => { if (!isPending) return; confirmDispatch.mutate({ id: d.id }); }}
                          disabled={!isPending || isConfirming}
                          className="h-12 sm:h-10 flex-1 sm:flex-none px-5 font-semibold text-sm rounded-xl transition-all duration-200 active:scale-95"
                          style={
                            isPending && !isConfirming
                              ? { background: "linear-gradient(135deg, oklch(0.28 0.07 250), oklch(0.35 0.09 255))", color: "oklch(0.98 0.005 240)", boxShadow: "0 2px 8px oklch(0.28 0.07 250 / 0.35)", cursor: "pointer" }
                              : { background: "oklch(0.55 0.18 155 / 0.12)", color: "oklch(0.40 0.15 155)", border: "1px solid oklch(0.55 0.18 155 / 0.3)", cursor: "not-allowed", opacity: 1 }
                          }
                        >
                          {isConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : isPending ? <><CheckCircle2 className="w-4 h-4 mr-1.5" />승인</> : <><CheckCircle2 className="w-4 h-4 mr-1.5" />승인 완료</>}
                        </Button>
                      )}
                      {/* 운행 완료 버튼 - 승인된 배차에만 표시 */}
                      {isConfirmed && (
                        <Button
                          onClick={() => { setCompleteDialogId(d.id); setTripCountInput("1"); }}
                          disabled={isCompleting}
                          className="h-12 sm:h-10 flex-1 sm:flex-none px-5 font-semibold text-sm rounded-xl transition-all duration-200 active:scale-95 gap-1.5"
                          style={{ background: "linear-gradient(135deg, oklch(0.52 0.22 25), oklch(0.44 0.20 20))", color: "white", boxShadow: "0 2px 8px oklch(0.52 0.22 25 / 0.40)" }}
                        >
                          {isCompleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle2 className="w-4 h-4" />운행 완료</>}
                        </Button>
                      )}
                      {isCompleted && (
                        <span
                          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl"
                          style={{ background: "oklch(0.55 0.18 250 / 0.10)", color: "oklch(0.35 0.12 250)", border: "1px solid oklch(0.55 0.18 250 / 0.25)" }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />운행 완료
                        </span>
                      )}

                      {/* 작업일지 등록 버튼 */}
                      <Button
                        onClick={() => setUploadDialogDispatchId(d.id)}
                        variant="outline"
                        className="h-12 sm:h-10 flex-1 sm:flex-none px-4 font-semibold text-sm rounded-xl gap-2 transition-all duration-200 active:scale-95"
                        style={{
                          borderColor: "oklch(0.78 0.12 75 / 0.5)",
                          color: "oklch(0.55 0.10 75)",
                          background: "oklch(0.78 0.12 75 / 0.06)",
                        }}
                      >
                        <Camera className="w-4 h-4" />
                        작업일지
                      </Button>
                    </div>
                  </div>

                  {/* 등록된 작업일지 뷰어 */}
                  <WorkLogViewer dispatchOrderId={d.id} driverId={driverId!} />
                </div>
              );
            })}
              </div>
            )}
          </>
        )}

        {/* ─ 운행 이력 탭 ─ */}
        {mainTab === "history" && (
          <>
            {/* 월 선택 네비게이션 */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => {
                  const d = new Date(histYear, histMonth - 2);
                  setHistYear(d.getFullYear()); setHistMonth(d.getMonth() + 1);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white"
                style={{ border: "1px solid oklch(0.88 0.01 240)" }}
              >
                <ChevronLeft className="w-4 h-4" style={{ color: "oklch(0.35 0.04 250)" }} />
              </button>
              <div className="text-center">
                <p className="text-base font-bold" style={{ color: "oklch(0.15 0.02 240)" }}>{histYear}년 {histMonth}월</p>
                {thisMonthEarnings && thisMonthEarnings.total > 0 && (
                  <p className="text-xs mt-0.5" style={{ color: "oklch(0.38 0.15 155)" }}>
                    이달 정산 합계 <strong>{thisMonthEarnings.total.toLocaleString()}원</strong> ({thisMonthEarnings.count}건)
                  </p>
                )}
              </div>
              <button
                onClick={() => {
                  const d = new Date(histYear, histMonth);
                  setHistYear(d.getFullYear()); setHistMonth(d.getMonth() + 1);
                }}
                disabled={histYear === now.getFullYear() && histMonth === now.getMonth() + 1}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white disabled:opacity-30"
                style={{ border: "1px solid oklch(0.88 0.01 240)" }}
              >
                <ChevronRight className="w-4 h-4" style={{ color: "oklch(0.35 0.04 250)" }} />
              </button>
            </div>

            {/* 월별 정산 요약 카드 */}
            {monthlyEarnings && monthlyEarnings.length > 0 && (
              <div className="mb-5 overflow-x-auto">
                <div className="flex gap-2 pb-1" style={{ minWidth: "max-content" }}>
                  {monthlyEarnings.slice().reverse().map((m) => (
                    <button
                      key={`${m.year}-${m.month}`}
                      onClick={() => { setHistYear(m.year); setHistMonth(m.month); }}
                      className="flex-shrink-0 rounded-xl px-3 py-2 text-center transition-all duration-150"
                      style={histYear === m.year && histMonth === m.month
                        ? { background: "oklch(0.28 0.07 250)", color: "white", boxShadow: "0 2px 8px oklch(0.28 0.07 250 / 0.25)" }
                        : { background: "oklch(1 0 0)", border: "1px solid oklch(0.90 0.008 240)", color: "oklch(0.35 0.04 250)" }}
                    >
                      <p className="text-xs font-medium">{m.month}월</p>
                      <p className="text-sm font-bold mt-0.5">{m.total > 0 ? `${(m.total / 10000).toFixed(0)}만` : "-"}</p>
                      <p className="text-[10px] mt-0.5 opacity-70">{m.count}건</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 이력 목록 */}
            {histLoading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.28 0.07 250)" }} />
              </div>
            ) : !historyItems || historyItems.length === 0 ? (
              <div className="rounded-2xl flex flex-col items-center justify-center py-16 gap-3" style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.90 0.008 240)" }}>
                <CalendarClock className="w-10 h-10" style={{ color: "oklch(0.75 0.01 240)" }} />
                <p className="text-sm font-medium" style={{ color: "oklch(0.35 0.02 240)" }}>이 달에 완료된 운행이 없습니다.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {historyItems.map((h) => (
                  <div
                    key={h.id}
                    className="rounded-xl p-4"
                    style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.90 0.008 240)" }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span
                            className="text-xs font-mono font-semibold px-2 py-0.5 rounded"
                            style={{ background: "oklch(0.94 0.01 240)", color: "oklch(0.35 0.04 250)" }}
                          >#{String(h.id).padStart(4, "0")}</span>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "oklch(0.45 0.12 145 / 0.10)", color: "oklch(0.38 0.10 145)", border: "1px solid oklch(0.45 0.12 145 / 0.20)" }}
                          >운행완료</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-sm font-medium mb-1" style={{ color: "oklch(0.20 0.02 240)" }}>
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0" style={{ color: "oklch(0.55 0.18 250)" }} />
                          <span className="truncate">{h.pickupLocation}</span>
                          <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.60 0.02 240)" }} />
                          <span className="truncate">{h.dropoffLocation}</span>
                        </div>
                        {h.memo && (
                          <p className="text-xs mt-1 truncate" style={{ color: "oklch(0.55 0.02 240)" }}>{h.memo}</p>
                        )}
                        <p className="text-xs mt-1.5" style={{ color: "oklch(0.60 0.02 240)" }}>
                          완료: {h.completedAt ? new Date(h.completedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {h.totalAmount != null && h.totalAmount > 0 ? (
                          <>
                            <p className="text-lg font-bold" style={{ color: "oklch(0.32 0.12 145)" }}>{h.totalAmount.toLocaleString()}원</p>
                            {h.tripCount != null && h.tripCount > 1 && (
                              <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>{h.tripCount}회차</p>
                            )}
                          </>
                        ) : (
                          <p className="text-sm font-medium" style={{ color: "oklch(0.60 0.02 240)" }}>정산 없음</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ─ 정산 현황 탭 ─ */}
        {mainTab === "settlement" && (
          <>
            {/* 월 선택 네비게이션 */}
            <div className="flex items-center justify-between mb-5">
              <button
                onClick={() => {
                  const d = new Date(settlYear, settlMonth - 2);
                  setSettlYear(d.getFullYear()); setSettlMonth(d.getMonth() + 1);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white"
                style={{ border: "1px solid oklch(0.88 0.01 240)" }}
              >
                <ChevronLeft className="w-4 h-4" style={{ color: "oklch(0.35 0.04 250)" }} />
              </button>
              <div className="text-center">
                <p className="text-base font-bold" style={{ color: "oklch(0.15 0.02 240)" }}>{settlYear}년 {settlMonth}월</p>
                <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.02 240)" }}>월별 정산 현황</p>
              </div>
              <button
                onClick={() => {
                  const d = new Date(settlYear, settlMonth);
                  setSettlYear(d.getFullYear()); setSettlMonth(d.getMonth() + 1);
                }}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white"
                style={{ border: "1px solid oklch(0.88 0.01 240)" }}
              >
                <ChevronRight className="w-4 h-4" style={{ color: "oklch(0.35 0.04 250)" }} />
              </button>
            </div>

            {settlLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "oklch(0.55 0.02 240)" }} />
              </div>
            ) : (
              <>
                {/* 요약 카드 4개 */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  {/* 총 근무일수 */}
                  <div className="rounded-2xl p-4" style={{ background: "oklch(0.97 0.015 250)", border: "1px solid oklch(0.88 0.02 250)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.42 0.18 250 / 0.12)" }}>
                        <CalendarDays className="w-3.5 h-3.5" style={{ color: "oklch(0.42 0.18 250)" }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: "oklch(0.42 0.18 250)" }}>이번달 근무일수</span>
                    </div>
                    <p className="text-2xl font-bold" style={{ color: "oklch(0.20 0.04 250)" }}>
                      {settlementData?.workDays ?? 0}<span className="text-sm font-normal ml-1">일</span>
                    </p>
                    <p className="text-xs mt-1" style={{ color: "oklch(0.55 0.02 240)" }}>완료 배차 {settlementData?.completedCount ?? 0}건</p>
                  </div>

                  {/* 총 매출 */}
                  <div className="rounded-2xl p-4" style={{ background: "oklch(0.97 0.015 145)", border: "1px solid oklch(0.88 0.02 145)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.45 0.18 145 / 0.12)" }}>
                        <TrendingUp className="w-3.5 h-3.5" style={{ color: "oklch(0.45 0.18 145)" }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: "oklch(0.45 0.18 145)" }}>총 매출</span>
                    </div>
                    <p className="text-xl font-bold" style={{ color: "oklch(0.20 0.04 145)" }}>
                      {(settlementData?.totalEarned ?? 0).toLocaleString()}<span className="text-sm font-normal ml-0.5">원</span>
                    </p>
                  </div>

                  {/* 결제된 금액 */}
                  <div className="rounded-2xl p-4" style={{ background: "oklch(0.97 0.01 220)", border: "1px solid oklch(0.88 0.01 220)" }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "oklch(0.45 0.12 220 / 0.12)" }}>
                        <BadgeCheck className="w-3.5 h-3.5" style={{ color: "oklch(0.45 0.12 220)" }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: "oklch(0.45 0.12 220)" }}>결제된 금액</span>
                    </div>
                    <p className="text-xl font-bold" style={{ color: "oklch(0.20 0.04 220)" }}>
                      {(settlementData?.totalPaid ?? 0).toLocaleString()}<span className="text-sm font-normal ml-0.5">원</span>
                    </p>
                  </div>

                  {/* 미지급 잔액 */}
                  <div className="rounded-2xl p-4" style={{
                    background: (settlementData?.remaining ?? 0) > 0 ? "oklch(0.97 0.015 35)" : "oklch(0.97 0.005 240)",
                    border: (settlementData?.remaining ?? 0) > 0 ? "1px solid oklch(0.88 0.02 35)" : "1px solid oklch(0.88 0.01 240)",
                  }}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: (settlementData?.remaining ?? 0) > 0 ? "oklch(0.55 0.20 35 / 0.12)" : "oklch(0.45 0.02 240 / 0.12)" }}>
                        <CreditCard className="w-3.5 h-3.5" style={{ color: (settlementData?.remaining ?? 0) > 0 ? "oklch(0.55 0.20 35)" : "oklch(0.45 0.02 240)" }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: (settlementData?.remaining ?? 0) > 0 ? "oklch(0.55 0.20 35)" : "oklch(0.45 0.02 240)" }}>미지급 잔액</span>
                    </div>
                    <p className="text-xl font-bold" style={{ color: (settlementData?.remaining ?? 0) > 0 ? "oklch(0.40 0.18 35)" : "oklch(0.35 0.02 240)" }}>
                      {(settlementData?.remaining ?? 0).toLocaleString()}<span className="text-sm font-normal ml-0.5">원</span>
                    </p>
                    {(settlementData?.remaining ?? 0) === 0 && (settlementData?.totalEarned ?? 0) > 0 && (
                      <p className="text-xs mt-1" style={{ color: "oklch(0.45 0.18 145)" }}>✓ 전액 지급 완료</p>
                    )}
                  </div>
                </div>

                {/* 전체 누적 요약 */}
                {settlAllTime && (
                  <div className="rounded-2xl p-4 mb-5" style={{ background: "oklch(0.20 0.04 250)", color: "white" }}>
                    <p className="text-xs font-semibold mb-3" style={{ color: "oklch(0.78 0.12 75)" }}>전체 누적 정산</p>
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-xs mb-1" style={{ color: "oklch(0.75 0.03 240)" }}>총 매출</p>
                        <p className="text-base font-bold text-white">{settlAllTime.totalEarned.toLocaleString()}원</p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: "oklch(0.75 0.03 240)" }}>지급된 금액</p>
                        <p className="text-base font-bold" style={{ color: "oklch(0.78 0.18 145)" }}>{settlAllTime.totalPaid.toLocaleString()}원</p>
                      </div>
                      <div>
                        <p className="text-xs mb-1" style={{ color: "oklch(0.75 0.03 240)" }}>남은 잔액</p>
                        <p className="text-base font-bold" style={{ color: settlAllTime.remaining > 0 ? "oklch(0.85 0.18 60)" : "oklch(0.78 0.18 145)" }}>
                          {settlAllTime.remaining.toLocaleString()}원
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 지급 내역 목록 */}
                <div>
                  <p className="text-sm font-semibold mb-3" style={{ color: "oklch(0.20 0.02 240)" }}>
                    {settlYear}년 {settlMonth}월 지급 내역
                    {settlementData?.payments && settlementData.payments.length > 0 && (
                      <span className="ml-2 text-xs font-normal" style={{ color: "oklch(0.55 0.02 240)" }}>
                        ({settlementData.payments.length}건)
                      </span>
                    )}
                  </p>
                  {!settlementData?.payments || settlementData.payments.length === 0 ? (
                    <div className="text-center py-10 rounded-2xl" style={{ background: "oklch(0.97 0.005 240)", border: "1px dashed oklch(0.85 0.01 240)" }}>
                      <CreditCard className="w-8 h-8 mx-auto mb-2" style={{ color: "oklch(0.75 0.02 240)" }} />
                      <p className="text-sm" style={{ color: "oklch(0.55 0.02 240)" }}>이번 달 지급 내역이 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {settlementData.payments.map((p) => (
                        <div
                          key={p.id}
                          className="rounded-xl p-4"
                          style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.91 0.008 240)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "oklch(0.45 0.12 220 / 0.10)" }}>
                                <BadgeCheck className="w-4 h-4" style={{ color: "oklch(0.45 0.12 220)" }} />
                              </div>
                              <div className="min-w-0">
                                {/* 지급 회사명 */}
                                <p className="text-sm font-semibold truncate" style={{ color: "oklch(0.15 0.02 240)" }}>
                                  {p.companyName}
                                </p>
                                <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.02 240)" }}>
                                  {new Date(p.paidAt).toLocaleDateString("ko-KR", { year: "numeric", month: "long", day: "numeric" })}
                                </p>
                                {p.memo && (
                                  <p className="text-xs mt-0.5 truncate" style={{ color: "oklch(0.60 0.02 240)" }}>
                                    {p.memo}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-base font-bold" style={{ color: "oklch(0.32 0.12 145)" }}>
                                +{p.amount.toLocaleString()}원
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 배차별 상세 내역 */}
                <div className="mt-5">
                  <p className="text-sm font-semibold mb-3" style={{ color: "oklch(0.20 0.02 240)" }}>
                    {settlYear}년 {settlMonth}월 완료 배차 내역
                    {settlementData?.orders && settlementData.orders.length > 0 && (
                      <span className="ml-2 text-xs font-normal" style={{ color: "oklch(0.55 0.02 240)" }}>
                        ({settlementData.orders.length}건)
                      </span>
                    )}
                  </p>
                  {!settlementData?.orders || settlementData.orders.length === 0 ? (
                    <div className="text-center py-8 rounded-2xl" style={{ background: "oklch(0.97 0.005 240)", border: "1px dashed oklch(0.85 0.01 240)" }}>
                      <Truck className="w-8 h-8 mx-auto mb-2" style={{ color: "oklch(0.75 0.02 240)" }} />
                      <p className="text-sm" style={{ color: "oklch(0.55 0.02 240)" }}>이번 달 완료된 배차가 없습니다</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {settlementData.orders.map((o, idx) => (
                        <div
                          key={o.id}
                          className="rounded-xl p-4"
                          style={{ background: "oklch(1 0 0)", border: "1px solid oklch(0.91 0.008 240)" }}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold"
                                style={{ background: "oklch(0.42 0.18 250 / 0.10)", color: "oklch(0.42 0.18 250)" }}
                              >
                                {idx + 1}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 mb-1">
                                  <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.55 0.18 25)" }} />
                                  <p className="text-xs font-medium truncate" style={{ color: "oklch(0.30 0.02 240)" }}>{o.pickupLocation}</p>
                                </div>
                                <div className="flex items-center gap-1.5 mb-1">
                                  <ArrowRight className="w-3 h-3 flex-shrink-0" style={{ color: "oklch(0.55 0.02 240)" }} />
                                  <p className="text-xs truncate" style={{ color: "oklch(0.45 0.02 240)" }}>{o.dropoffLocation}</p>
                                </div>
                                <p className="text-xs" style={{ color: "oklch(0.60 0.02 240)" }}>
                                  {o.completedAt ? new Date(o.completedAt).toLocaleDateString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "-"}
                                  {o.tripCount && o.tripCount > 1 && <span className="ml-1.5">· {o.tripCount}회차</span>}
                                </p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              {o.totalAmount != null && o.totalAmount > 0 ? (
                                <p className="text-base font-bold" style={{ color: "oklch(0.32 0.12 145)" }}>
                                  {o.totalAmount.toLocaleString()}원
                                </p>
                              ) : (
                                <p className="text-sm" style={{ color: "oklch(0.65 0.02 240)" }}>정산 없음</p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* 내 정보 수정 모달 */}
      {driver && profileEditOpen && (
        <ProfileEditDialog
          open={profileEditOpen}
          onClose={() => setProfileEditOpen(false)}
          driver={{
            ...driver,
            vehiclePhotoUrl: driver.vehiclePhotoUrl ?? null,
          }}
          onSuccess={() => {}}
        />
      )}

      {/* 작업일지 업로드 모달 */}
      {uploadDialogDispatchId !== null && (
        <WorkLogUploadDialog
          open={true}
          onClose={() => setUploadDialogDispatchId(null)}
          dispatchOrderId={uploadDialogDispatchId}
          driverId={driverId!}
          onSuccess={() => {
            utils.workLog.getByDispatchOrder.invalidate({ dispatchOrderId: uploadDialogDispatchId });
          }}
        />
      )}

      {/* 운행 완료 모달 - 회차 수 입력 */}
      <Dialog
        open={completeDialogId !== null}
        onOpenChange={(open) => { if (!open) { setCompleteDialogId(null); setTripCountInput("1"); } }}
      >
        <DialogContent className="sm:max-w-md rounded-2xl flex flex-col" style={{ maxHeight: '85dvh' }}>
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" style={{ color: "oklch(0.45 0.12 145)" }} />
              운행 완료 체크
            </DialogTitle>
            <DialogDescription className="text-sm" style={{ color: "oklch(0.50 0.03 240)" }}>
              이번 운행에서 완료한 회차 수를 입력해주세요.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 overflow-y-auto flex-1">
            {/* 단가 표시 */}
            {(() => {
              const dispatch = dispatches?.find((d) => d.id === completeDialogId);
              const unitPrice = dispatch?.unitPrice;
              const count = parseInt(tripCountInput, 10);
              const total = unitPrice && !isNaN(count) && count > 0 ? unitPrice * count : 0;
              return (
                <>
                  {unitPrice != null && unitPrice > 0 && (
                    <div
                      className="rounded-xl p-3"
                      style={{ background: "oklch(0.45 0.12 145 / 0.07)", border: "1px solid oklch(0.45 0.12 145 / 0.20)" }}
                    >
                      <p className="text-xs font-medium mb-1" style={{ color: "oklch(0.38 0.10 145)" }}>회차 단가</p>
                      <p className="text-lg font-bold" style={{ color: "oklch(0.32 0.10 145)" }}>
                        {unitPrice.toLocaleString()}원 / 회
                      </p>
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">
                      회차 수 <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        className="w-10 h-10 p-0 text-lg font-bold rounded-xl"
                        onClick={() => setTripCountInput((v) => String(Math.max(1, parseInt(v, 10) - 1)))}
                        disabled={parseInt(tripCountInput, 10) <= 1}
                      >-</Button>
                      <Input
                        type="number"
                        min="1"
                        max="999"
                        className="h-10 text-center text-lg font-bold"
                        value={tripCountInput}
                        onChange={(e) => setTripCountInput(e.target.value)}
                      />
                      <Button
                        variant="outline"
                        className="w-10 h-10 p-0 text-lg font-bold rounded-xl"
                        onClick={() => setTripCountInput((v) => String(parseInt(v, 10) + 1))}
                      >+</Button>
                    </div>
                    <p className="text-xs" style={{ color: "oklch(0.55 0.02 240)" }}>오늘 운행한 전체 회차 수를 입력해주세요.</p>
                  </div>
                  {unitPrice != null && unitPrice > 0 && !isNaN(count) && count > 0 && (
                    <div
                      className="rounded-xl p-4 flex items-center justify-between"
                      style={{ background: "linear-gradient(135deg, oklch(0.45 0.12 145 / 0.10), oklch(0.38 0.10 150 / 0.08))", border: "1px solid oklch(0.45 0.12 145 / 0.25)" }}
                    >
                      <div>
                        <p className="text-xs font-medium" style={{ color: "oklch(0.45 0.08 145)" }}>정산 금액</p>
                        <p className="text-xs mt-0.5" style={{ color: "oklch(0.55 0.05 145)" }}>
                          {unitPrice.toLocaleString()}원 × {count}회
                        </p>
                      </div>
                      <p className="text-2xl font-bold" style={{ color: "oklch(0.32 0.12 145)" }}>
                        {total.toLocaleString()}원
                      </p>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
          <div className="flex gap-2 pt-3 flex-shrink-0 border-t" style={{ borderColor: "oklch(0.88 0.01 240)" }}>
              <Button
                variant="outline"
                className="flex-1 h-10"
                onClick={() => { setCompleteDialogId(null); setTripCountInput("1"); }}
              >
                취소
              </Button>
              <Button
                className="flex-1 h-10 font-semibold gap-2"
                style={{ background: "linear-gradient(135deg, oklch(0.52 0.22 25), oklch(0.44 0.20 20))", color: "white" }}
                onClick={handleComplete}
                disabled={completeDispatch.isPending}
              >
                {completeDispatch.isPending
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><CheckCircle2 className="w-4 h-4" />운행 완료</>}
              </Button>
            </div>
        </DialogContent>
      </Dialog>

      {/* ─── 관리자 알림 팝업 ────────────────────────────────────────────────────── */}
      <Dialog open={!!currentNotif} onOpenChange={(open) => { if (!open) handleCloseNotif(); }}>
        <DialogContent
          className="sm:max-w-sm rounded-2xl"
          style={{
            background: "oklch(0.12 0.04 250)",
            border: "1px solid oklch(0.30 0.10 250)",
            boxShadow: "0 20px 60px oklch(0.05 0.05 250 / 0.80)",
          }}
        >
          {/* 알림 배지 */}
          <div className="flex items-center gap-3 mb-1">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "oklch(0.42 0.18 250)" }}
            >
              <Bell className="w-5 h-5" style={{ color: "white" }} />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold" style={{ color: "oklch(0.65 0.10 250)" }}>관리자 알림</p>
              <p className="text-base font-bold truncate" style={{ color: "oklch(0.96 0.01 240)" }}>
                {currentNotif?.title}
              </p>
            </div>
            {unreadNotifs && unreadNotifs.length > 1 && (
              <span
                className="ml-auto flex-shrink-0 text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: "oklch(0.42 0.18 250)", color: "white" }}
              >
                {notifIndex + 1}/{unreadNotifs.length}
              </span>
            )}
          </div>

          {/* 메시지 내용 */}
          <div
            className="rounded-xl p-4 my-2"
            style={{ background: "oklch(0.18 0.04 250)", border: "1px solid oklch(0.28 0.08 250)" }}
          >
            <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "oklch(0.88 0.02 240)" }}>
              {currentNotif?.message}
            </p>
          </div>

          {/* 시간 */}
          <p className="text-xs mb-3" style={{ color: "oklch(0.55 0.04 250)" }}>
            {currentNotif?.createdAt && new Date(currentNotif.createdAt).toLocaleString("ko-KR", {
              year: "numeric", month: "short", day: "numeric",
              hour: "2-digit", minute: "2-digit"
            })}
          </p>

          {/* 버튼 */}
          <div className="flex gap-2">
            {unreadNotifs && unreadNotifs.length > 1 && (
              <Button
                variant="outline"
                className="flex-1 text-sm"
                style={{ borderColor: "oklch(0.35 0.08 250)", color: "oklch(0.75 0.05 250)", background: "transparent" }}
                onClick={() => {
                  if (!currentNotif || !driverId) return;
                  markNotifRead.mutate({ notificationId: currentNotif.id, driverId });
                  setNotifIndex(0);
                }}
              >
                다음 알림
              </Button>
            )}
            <Button
              className="flex-1 font-bold text-sm"
              style={{ background: "oklch(0.42 0.18 250)", color: "white" }}
              onClick={handleCloseNotif}
              disabled={markNotifRead.isPending}
            >
              {markNotifRead.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "확인"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
