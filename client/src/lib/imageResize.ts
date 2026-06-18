/**
 * 이미지 자동 리사이징 유틸리티
 * Canvas API를 사용하여 업로드 전 클라이언트 측에서 이미지를 압축·리사이징합니다.
 */

export interface ResizeOptions {
  /** 최대 너비 (px). 기본값: 1920 */
  maxWidth?: number;
  /** 최대 높이 (px). 기본값: 1920 */
  maxHeight?: number;
  /** JPEG 품질 (0~1). 기본값: 0.85 */
  quality?: number;
  /** 출력 MIME 타입. 기본값: image/jpeg */
  outputType?: "image/jpeg" | "image/webp" | "image/png";
}

export interface ResizeResult {
  blob: Blob;
  /** 원본 파일 크기 (bytes) */
  originalSize: number;
  /** 압축 후 크기 (bytes) */
  compressedSize: number;
  /** 압축률 (%) */
  compressionRatio: number;
  width: number;
  height: number;
}

/**
 * 파일을 읽어 HTMLImageElement로 변환
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 불러올 수 없습니다."));
    };
    img.src = url;
  });
}

/**
 * 이미지 파일을 리사이징·압축하여 Blob으로 반환합니다.
 *
 * - PNG/GIF/WebP 등 모든 포맷 지원 (출력은 JPEG로 통일)
 * - EXIF 회전 정보는 Canvas 렌더링 시 자동 반영됨 (Chrome/Safari 최신 버전)
 * - 이미 작은 이미지는 원본 크기 유지
 */
export async function resizeImage(
  file: File,
  options: ResizeOptions = {}
): Promise<ResizeResult> {
  const {
    maxWidth = 1920,
    maxHeight = 1920,
    quality = 0.85,
    outputType = "image/jpeg",
  } = options;

  const img = await loadImage(file);

  let { width, height } = img;

  // 비율 유지하며 최대 크기 초과 시 축소
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context를 생성할 수 없습니다.");

  // 흰 배경 (JPEG는 투명 배경 미지원)
  if (outputType === "image/jpeg") {
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
  }

  ctx.drawImage(img, 0, 0, width, height);

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => {
        if (b) resolve(b);
        else reject(new Error("이미지 변환에 실패했습니다."));
      },
      outputType,
      quality
    );
  });

  return {
    blob,
    originalSize: file.size,
    compressedSize: blob.size,
    compressionRatio: Math.round((1 - blob.size / file.size) * 100),
    width,
    height,
  };
}

/**
 * 여러 파일을 순서대로 리사이징합니다.
 * onProgress 콜백으로 진행률을 받을 수 있습니다.
 */
export async function resizeImages(
  files: File[],
  options: ResizeOptions = {},
  onProgress?: (done: number, total: number) => void
): Promise<ResizeResult[]> {
  const results: ResizeResult[] = [];
  for (let i = 0; i < files.length; i++) {
    results.push(await resizeImage(files[i], options));
    onProgress?.(i + 1, files.length);
  }
  return results;
}

/**
 * ResizeResult의 Blob을 File 객체로 변환 (업로드용)
 */
export function resizeResultToFile(
  result: ResizeResult,
  originalFile: File,
  outputType: "image/jpeg" | "image/webp" | "image/png" = "image/jpeg"
): File {
  const ext = outputType === "image/jpeg" ? "jpg" : outputType === "image/webp" ? "webp" : "png";
  const baseName = originalFile.name.replace(/\.[^.]+$/, "");
  return new File([result.blob], `${baseName}.${ext}`, { type: outputType });
}

/**
 * 파일 크기를 사람이 읽기 쉬운 형태로 변환 (예: "1.2 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
