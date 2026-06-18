import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import multer, { FileFilterCallback } from "multer";
import type { Request } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { jwtVerify } from "jose";
import { storagePut } from "../storage";
import { ENV } from "./env";
import {
  createWorkLog,
  createWorkLogPhoto,
  getWorkLogByDispatchOrderId,
  getPhotosByWorkLogId,
  updateDriverVehiclePhoto,
} from "../db";

// 기사 JWT 토큰 검증 헬퍼
async function verifyDriverJwt(authHeader: string | undefined): Promise<number | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    return (payload as any).driverId as number;
  } catch {
    return null;
  }
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  // ─── 사진 업로드 (multipart/form-data) ─────────────────────────────────
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024, files: 20 }, // 최대 16MB × 20장
    fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
      if (file.mimetype.startsWith("image/")) {
        cb(null, true);
      } else {
        cb(new Error("이미지 파일만 업로드 가능합니다."));
      }
    },
  });

  /**
   * POST /api/worklog/upload
   * body: multipart/form-data
   *   - dispatchOrderId: number (string)
   *   - driverId: number (string)
   *   - memo?: string
   *   - photos[]: File[]
   */
  app.post("/api/worklog/upload", upload.array("photos", 20), async (req, res) => {
    try {
      const dispatchOrderId = parseInt(req.body.dispatchOrderId as string, 10);
      const driverId = parseInt(req.body.driverId as string, 10);
      const memo: string = req.body.memo ?? "";
      const files = (req as any).files as Express.Multer.File[];

      if (!dispatchOrderId || !driverId) {
        res.status(400).json({ error: "dispatchOrderId, driverId 필수" });
        return;
      }
      if (!files || files.length === 0) {
        res.status(400).json({ error: "사진을 1장 이상 업로드해 주세요." });
        return;
      }

      // 기존 작업일지 확인 (배차당 1개)
      let workLog = await getWorkLogByDispatchOrderId(dispatchOrderId);
      let workLogId: number;

      if (workLog) {
        workLogId = workLog.id;
      } else {
        const result = await createWorkLog({ dispatchOrderId, driverId, memo: memo || null });
        workLogId = result.insertId;
        if (!workLogId) {
          throw new Error("작업일지 생성 실패: insertId를 가져올 수 없습니다.");
        }
      }

      // 사진 S3 업로드
      const uploadedPhotos: { id: number; url: string; originalName: string }[] = [];
      for (const file of files) {
        // 파일명에 한글 등 non-ASCII 문자가 포함되면 스토리지가 거부하므로 ASCII 파일명으로 대체
        const rawExt = (file.originalname.match(/\.[^.]+$/) ?? [".jpg"])[0]
          .replace(/[^a-zA-Z0-9.]/g, "")
          .toLowerCase();
        const safeExt = rawExt || ".jpg";
        const key = `worklogs/${driverId}/${dispatchOrderId}/${Date.now()}${safeExt}`;
        const { key: savedKey, url } = await storagePut(
          key,
          file.buffer,
          file.mimetype
        );
        const photoResult = await createWorkLogPhoto({
          workLogId,
          storageKey: savedKey,
          storageUrl: url,
          originalName: file.originalname,
          mimeType: file.mimetype,
        });
        uploadedPhotos.push({
          id: (photoResult as any).insertId as number,
          url,
          originalName: file.originalname,
        });
      }

      res.json({ success: true, workLogId, photos: uploadedPhotos });
    } catch (err: any) {
      console.error("[WorkLog Upload Error]", err);
      res.status(500).json({ error: err.message ?? "업로드 실패" });
    }
  });

  /**
   * POST /api/driver/upload-vehicle-photo
   * body: multipart/form-data
   *   - driverId: number (string)
   *   - photo: File
   */
  app.post("/api/driver/upload-vehicle-photo", upload.single("photo"), async (req, res) => {
    try {
      // 기사 본인 인증 (Authorization 헤더 또는 쿠키)
      const authDriverId = await verifyDriverJwt(req.headers.authorization as string | undefined);
      const driverId = parseInt(req.body.driverId as string, 10);
      const file = (req as any).file as Express.Multer.File | undefined;

      if (!driverId) {
        res.status(400).json({ error: "driverId 필수" });
        return;
      }
      // 인증된 기사 ID가 있으면 본인 확인, 없으면 (관리자 등록 시) 허용
      if (authDriverId !== null && authDriverId !== driverId) {
        res.status(403).json({ error: "본인의 차량 사진만 업로드할 수 있습니다." });
        return;
      }
      if (!file) {
        res.status(400).json({ error: "사진을 1장 업로드해 주세요." });
        return;
      }

      // 파일명에 한글 등 non-ASCII 문자가 포함되면 스토리지가 거부하므로
      // 확장자만 추출하여 타임스탬프 기반 ASCII 파일명으로 대체
      const ext = (file.originalname.match(/\.[^.]+$/) ?? [".jpg"])[0]
        .replace(/[^a-zA-Z0-9.]/g, "")
        .toLowerCase();
      const safeFilename = `${Date.now()}${ext}`;
      const key = `drivers/${driverId}/vehicle-photo/${safeFilename}`;
      const { key: savedKey, url } = await storagePut(key, file.buffer, file.mimetype);
      await updateDriverVehiclePhoto(driverId, url, savedKey);

      res.json({ success: true, url, key: savedKey });
    } catch (err: any) {
      console.error("[Vehicle Photo Upload Error]", err);
      res.status(500).json({ error: err.message ?? "업로드 실패" });
    }
  });

  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );

  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
