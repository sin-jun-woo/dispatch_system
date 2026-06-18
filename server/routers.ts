import { z } from "zod";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { TRPCError } from "@trpc/server";
import { publicProcedure, router } from "./_core/trpc";
import { ENV } from "./_core/env";
import {
  getAllDrivers,
  getDriverById,
  createDriver,
  deleteDriver,
  updateDriverStatus,
  getAllDispatchOrders,
  getDispatchOrdersByDriverId,
  createDispatchOrder,
  confirmDispatchOrder,
  completeDispatchOrder,
  updateDispatchOrder,
  cancelDispatchOrder,
  deleteDispatchOrder,
  getDispatchOrderById,
  getWorkLogsByDriverId,
  getWorkLogByDispatchOrderId,
  getAllWorkLogs,
  getPhotosByWorkLogId,
  deleteWorkLogPhoto,
  getAllSmsTemplates,
  createSmsTemplate,
  deleteSmsTemplate,
  getAllDriversMonthlySummary,
  getFilteredDispatchOrders,
  getMonthlySettlementReport,
  getPendingDispatchCountByDriverId,
  getDriverMonthlyOrders,
  getDriverByPhone,
  updateDriverPin,
  updateDriverProfile,
  findDuplicateDriver,
  updateDriverByAdmin,
  updateDriverBankInfo,
  createDriverPayment,
  getDriverPayments,
  getDriverSettlementSummary,
  getAppSetting,
  setAppSetting,
  getMySettlement,
  getMySettlementAllTime,
  sendDriverNotifications,
  getUnreadNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  getNotificationHistory,
} from "./db";

const DRIVER_COOKIE = "driver_session_id";

async function signDriverToken(driverId: number): Promise<string> {
  const secret = new TextEncoder().encode(ENV.cookieSecret);
  return new SignJWT({ driverId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret);
}

async function verifyDriverToken(token: string): Promise<{ driverId: number } | null> {
  try {
    const secret = new TextEncoder().encode(ENV.cookieSecret);
    const { payload } = await jwtVerify(token, secret);
    return payload as { driverId: number };
  } catch {
    return null;
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ─── 기사 관리 ───────────────────────────────────────────────────────────
  driver: router({
    list: publicProcedure.query(async () => getAllDrivers()),

    get: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => getDriverById(input.id)),

    create: publicProcedure
      .input(
        z.object({
          name: z.string().min(1),
          phone: z.string().min(1),
          vehicleNumber: z.string().optional(),
          vehicleType: z.string().optional(),
          affiliation: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        // 중복 등록 체크
        const { phoneConflict, nameVehicleConflict } = await findDuplicateDriver(
          input.name,
          input.phone,
          input.vehicleNumber
        );

        if (phoneConflict && nameVehicleConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `이미 등록된 기사입니다. 전화번호(${input.phone})와 이름+차량번호가 모두 중복됩니다.`,
          });
        }
        if (phoneConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `이미 등록된 전화번호입니다. (${input.phone})`,
          });
        }
        if (nameVehicleConflict) {
          throw new TRPCError({
            code: "CONFLICT",
            message: `동일한 이름과 차량번호로 이미 등록된 기사가 있습니다. (${input.name} / ${input.vehicleNumber})`,
          });
        }

        const result = await createDriver(input);
        // Drizzle mysql2 insert returns [ResultSetHeader, FieldPacket[]] - insertId is in result[0]
        const id = (Array.isArray(result) ? (result[0] as any).insertId : (result as any).insertId) as number | undefined;
        return { success: true, id };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteDriver(input.id);
        return { success: true };
      }),

    // 기사 상태 변경 (대기중/운행중/수리중)
    updateStatus: publicProcedure
      .input(
        z.object({
          id: z.number(),
          status: z.enum(["idle", "driving", "repair"]),
        })
      )
      .mutation(async ({ input }) => {
        await updateDriverStatus(input.id, input.status);
        return { success: true };
      }),

    // 기사별 이번 달 배차 이력 요약
    monthlySummary: publicProcedure.query(async () => getAllDriversMonthlySummary()),

    // ─── 기사 로그인 (전화번호 + PIN) ─────────────────────────────────────
    login: publicProcedure
      .input(z.object({ phone: z.string().min(1), pin: z.string().min(4).max(8) }))
      .mutation(async ({ input, ctx }) => {
        const driver = await getDriverByPhone(input.phone);
        if (!driver) throw new TRPCError({ code: "NOT_FOUND", message: "등록되지 않은 전화번호입니다." });
        if (!driver.pinHash) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PIN이 설정되지 않았습니다. 관리자에게 문의하세요." });
        const valid = await bcrypt.compare(input.pin, driver.pinHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "PIN이 올바르지 않습니다." });
        const token = await signDriverToken(driver.id);
        const cookieOpts = getSessionCookieOptions(ctx.req);
        ctx.res.cookie(DRIVER_COOKIE, token, { ...cookieOpts, maxAge: 30 * 24 * 60 * 60 * 1000 });
        // 토큰을 응답 본문에도 포함 (프록시 환경에서 쿠키가 차단될 때 localStorage 폴백용)
        return { success: true, driverId: driver.id, name: driver.name, token };
      }),

    // 기사 로그아웃
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOpts = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(DRIVER_COOKIE, { ...cookieOpts, maxAge: -1 });
      return { success: true };
    }),

    // 현재 로그인된 기사 정보 조회
    me: publicProcedure.query(async ({ ctx }) => {
      // 쿠키 우선, 없으면 Authorization 헤더 폴백 (프록시 환경 대응)
      const authHeader = ctx.req.headers.authorization;
      const token = ctx.req.cookies?.[DRIVER_COOKIE] ||
        (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);
      if (!token) return null;
      const payload = await verifyDriverToken(token);
      if (!payload) return null;
      const driver = await getDriverById(payload.driverId);
      if (!driver) return null;
      // pinHash 제외하고 반환
      const { pinHash: _ph, ...safeDriver } = driver;
      return safeDriver;
    }),

    // 기사 본인 정보 수정
    updateProfile: publicProcedure
      .input(z.object({
        name: z.string().min(1).optional(),
        vehicleNumber: z.string().optional(),
        vehicleType: z.string().optional(),
        affiliation: z.string().optional(),
        phone: z.string().optional(),
      }))
      .mutation(async ({ input, ctx }) => {
        const authHeader = ctx.req.headers.authorization;
        const token = ctx.req.cookies?.[DRIVER_COOKIE] ||
          (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
        const payload = await verifyDriverToken(token);
        if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "세션이 만료되었습니다. 다시 로그인해주세요." });
        await updateDriverProfile(payload.driverId, {
          name: input.name ?? undefined,
          vehicleNumber: input.vehicleNumber ?? undefined,
          vehicleType: input.vehicleType ?? undefined,
          affiliation: input.affiliation ?? undefined,
          phone: input.phone ?? undefined,
        });
        return { success: true };
      }),

    // 기사 본인 PIN 변경
    changePin: publicProcedure
      .input(z.object({ currentPin: z.string().min(4), newPin: z.string().min(4).max(8) }))
      .mutation(async ({ input, ctx }) => {
        const authHeader = ctx.req.headers.authorization;
        const token = ctx.req.cookies?.[DRIVER_COOKIE] ||
          (authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : undefined);
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
        const payload = await verifyDriverToken(token);
        if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "세션이 만료되었습니다." });
        const driver = await getDriverById(payload.driverId);
        if (!driver?.pinHash) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "PIN이 설정되지 않았습니다." });
        const valid = await bcrypt.compare(input.currentPin, driver.pinHash);
        if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "현재 PIN이 올바르지 않습니다." });
        const newHash = await bcrypt.hash(input.newPin, 10);
        await updateDriverPin(payload.driverId, newHash);
        return { success: true };
      }),

    // 관리자: 기사 PIN 설정/초기화
    adminSetPin: publicProcedure
      .input(z.object({ driverId: z.number(), pin: z.string().min(4).max(8) }))
      .mutation(async ({ input }) => {
        const hash = await bcrypt.hash(input.pin, 10);
        await updateDriverPin(input.driverId, hash);
        return { success: true };
      }),

    adminUpdate: publicProcedure
      .input(
        z.object({
          id: z.number(),
          name: z.string().min(1).optional(),
          phone: z.string().optional(),
          vehicleNumber: z.string().nullable().optional(),
          vehicleType: z.string().nullable().optional(),
          affiliation: z.string().nullable().optional(),
        })
      )
      .mutation(async ({ input }) => {
        const { id, ...fields } = input;
        // 전화번호 중복 체크 (다른 기사와 중복 여부)
        if (fields.phone) {
          const existing = await getDriverByPhone(fields.phone);
          if (existing && existing.id !== id) {
            throw new TRPCError({ code: "CONFLICT", message: "이미 등록된 전화번호입니다." });
          }
        }
        await updateDriverByAdmin(id, fields);
        return { success: true };
      }),

    completedHistory: publicProcedure
      .input(z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }))
      .query(async ({ input, ctx }) => {
        // Authorization 헤더 또는 쿠키에서 기사 토큰 추출
        const authHeader = ctx.req.headers["authorization"];
        const token = authHeader?.startsWith("Bearer ")
          ? authHeader.slice(7)
          : ctx.req.cookies?.[DRIVER_COOKIE];
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
        const payload = await verifyDriverToken(token);
        if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "세션이 만료되었습니다." });
        const { getDriverCompletedHistory } = await import("./db");
        return getDriverCompletedHistory(payload.driverId, input.year, input.month);
      }),

    monthlyEarnings: publicProcedure
      .query(async ({ ctx }) => {
        const authHeader = ctx.req.headers["authorization"];
        const token = authHeader?.startsWith("Bearer ")
          ? authHeader.slice(7)
          : ctx.req.cookies?.[DRIVER_COOKIE];
        if (!token) throw new TRPCError({ code: "UNAUTHORIZED", message: "로그인이 필요합니다." });
        const payload = await verifyDriverToken(token);
        if (!payload) throw new TRPCError({ code: "UNAUTHORIZED", message: "세션이 만료되었습니다." });
        const { getDriverMonthlyEarnings } = await import("./db");
        return getDriverMonthlyEarnings(payload.driverId);
      }),

    // 기사별 월평균 배차 일수 통계 (관리자 전용)
    dispatchDayStats: publicProcedure.query(async () => {
      const { getDriverDispatchDayStats } = await import("./db");
      return getDriverDispatchDayStats();
    }),

    // 계좌번호 업데이트 (기사 본인 또는 관리자)
    updateBankInfo: publicProcedure
      .input(
        z.object({
          driverId: z.number(),
          bankName: z.string().optional(),
          accountNumber: z.string().optional(),
          accountHolder: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await updateDriverBankInfo(input.driverId, {
          bankName: input.bankName,
          accountNumber: input.accountNumber,
          accountHolder: input.accountHolder,
        });
        return { success: true };
      }),

    // 지급 내역 등록 (관리자 전용)
    addPayment: publicProcedure
      .input(
        z.object({
          driverId: z.number(),
          companyName: z.string().min(1),
          amount: z.number().min(1),
          paidAt: z.string(), // ISO date string
          memo: z.string().optional(),
        })
      )
      .mutation(async ({ input }) => {
        await createDriverPayment({
          driverId: input.driverId,
          companyName: input.companyName,
          amount: input.amount,
          paidAt: new Date(input.paidAt),
          memo: input.memo,
        });
        return { success: true };
      }),

    // 기사별 지급 내역 조회
    payments: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => getDriverPayments(input.driverId)),

    // 정산 요약 (관리자 정산 탭용) - 기사별 총정산액/총지급액/미지급잔액
    settlementSummary: publicProcedure
      .input(z.object({ year: z.number(), month: z.number() }))
      .query(async ({ input }) =>
        getDriverSettlementSummary(input.year, input.month)
      ),

    // 기사용: 월별 개인 정산 현황 (총 근무일수, 총매출, 지급액, 미지급액)
    mySettlement: publicProcedure
      .input(z.object({ driverId: z.number(), year: z.number(), month: z.number() }))
      .query(async ({ input }) =>
        getMySettlement(input.driverId, input.year, input.month)
      ),

    // 기사용: 전체 누적 정산 현황
    mySettlementAllTime: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) =>
        getMySettlementAllTime(input.driverId)
      ),
  }),

  // ─── 배차 관리 ───────────────────────────────────────────────────────────
  dispatch: router({
    listAll: publicProcedure.query(async () => {
      const orders = await getAllDispatchOrders();
      const drivers = await getAllDrivers();
      const driverMap = new Map(drivers.map((d) => [d.id, d]));
      return orders.map((o) => ({
        ...o,
        driver: driverMap.get(o.driverId) ?? null,
      }));
    }),

    listByDriver: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => getDispatchOrdersByDriverId(input.driverId)),

    create: publicProcedure
      .input(
        z.object({
          driverId: z.number(),
          pickupLocation: z.string().min(1),
          dropoffLocation: z.string().min(1),
          memo: z.string().optional(),
          dispatchType: z.enum(["forced", "normal"]).default("forced"),
          unitPrice: z.number().int().min(0).optional(),
          arrivalDeadline: z.string().optional(), // ISO 문자열
        })
      )
      .mutation(async ({ input }) => {
        await createDispatchOrder({
          driverId: input.driverId,
          pickupLocation: input.pickupLocation,
          dropoffLocation: input.dropoffLocation,
          memo: input.memo ?? null,
          dispatchType: input.dispatchType,
          approvalStatus: "pending",
          unitPrice: input.unitPrice ?? null,
          arrivalDeadline: input.arrivalDeadline ? new Date(input.arrivalDeadline) : null,
        });
        return { success: true };
      }),

    // 다중 기사 배차 생성 (기사별 개별 dispatch_orders 생성)
    createMultiple: publicProcedure
      .input(
        z.object({
          driverIds: z.array(z.number()).min(1),
          pickupLocation: z.string().min(1),
          dropoffLocation: z.string().min(1),
          memo: z.string().optional(),
          unitPrice: z.number().int().min(0).optional(),
          arrivalDeadline: z.string().optional(), // ISO 문자열
        })
      )
      .mutation(async ({ input }) => {
        const deadline = input.arrivalDeadline ? new Date(input.arrivalDeadline) : null;
        // 기사별로 개별 dispatch_orders 생성
        await Promise.all(
          input.driverIds.map((driverId) =>
            createDispatchOrder({
              driverId,
              pickupLocation: input.pickupLocation,
              dropoffLocation: input.dropoffLocation,
              memo: input.memo ?? null,
              dispatchType: "forced",
              approvalStatus: "pending",
              unitPrice: input.unitPrice ?? null,
              arrivalDeadline: deadline,
            })
          )
        );
        return { success: true, count: input.driverIds.length };
      }),

    // 기사별 미확인(pending) 배차 카운트
    pendingCount: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => {
        const count = await getPendingDispatchCountByDriverId(input.driverId);
        return { count };
      }),

    confirm: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const order = await getDispatchOrderById(input.id);
        if (!order) throw new Error("배차를 찾을 수 없습니다.");
        if (order.approvalStatus === "confirmed") {
          return { success: true, alreadyConfirmed: true };
        }
        await confirmDispatchOrder(input.id);
        return { success: true, alreadyConfirmed: false };
      }),

    // 배차 수정 처리 (관리자)
    update: publicProcedure
      .input(
        z.object({
          id: z.number(),
          pickupLocation: z.string().min(1).optional(),
          dropoffLocation: z.string().min(1).optional(),
          unitPrice: z.number().int().min(0).nullable().optional(),
          memo: z.string().nullable().optional(),
          arrivalDeadline: z.string().nullable().optional(), // ISO 문자열 또는 null
        })
      )
      .mutation(async ({ input }) => {
        const order = await getDispatchOrderById(input.id);
        if (!order) throw new Error("배차를 찾을 수 없습니다.");
        if (order.approvalStatus === "completed" || order.approvalStatus === "cancelled") {
          throw new Error("완료되거나 취소된 배차는 수정할 수 없습니다.");
        }
        const { id, arrivalDeadline, ...rest } = input;
        await updateDispatchOrder(id, {
          ...rest,
          arrivalDeadline: arrivalDeadline === undefined
            ? undefined
            : arrivalDeadline === null
            ? null
            : new Date(arrivalDeadline),
        });
        return { success: true };
      }),

    // 배차 취소 처리 (관리자)
    cancel: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const order = await getDispatchOrderById(input.id);
        if (!order) throw new Error("배차를 찾을 수 없습니다.");
        if (order.approvalStatus === "cancelled") {
          return { success: true, alreadyCancelled: true };
        }
        await cancelDispatchOrder(input.id);
        return { success: true, alreadyCancelled: false };
      }),

    // 배차 삭제 처리 (관리자)
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const order = await getDispatchOrderById(input.id);
        if (!order) throw new Error("배차를 찾을 수 없습니다.");
        await deleteDispatchOrder(input.id);
        return { success: true };
      }),

    // 운행 완료 처리 (기사가 회차 수 입력 후 완료)
    complete: publicProcedure
      .input(
        z.object({
          id: z.number(),
          driverId: z.number().optional(),  // optional: 완료 후 기사 상태 자동 변경용
          tripCount: z.number().int().min(1),  // 회차 수
        })
      )
      .mutation(async ({ input }) => {
        const order = await getDispatchOrderById(input.id);
        if (!order) throw new Error("배차를 찾을 수 없습니다.");
        if (order.approvalStatus === "completed") {
          return { success: true, alreadyCompleted: true, tripCount: order.tripCount ?? input.tripCount, totalAmount: order.totalAmount ?? 0 };
        }
        if (order.approvalStatus !== "confirmed") {
          throw new Error("승인된 배차만 완료 처리할 수 있습니다.");
        }
        // 정산 금액 계산: 단가 × 회차 수
        const unitPrice = order.unitPrice ?? 0;
        const totalAmount = unitPrice * input.tripCount;
        await completeDispatchOrder(input.id, input.tripCount, totalAmount);
        // 완료 후 기사 상태를 idle(대기중)로 자동 변경
        if (input.driverId) {
          await updateDriverStatus(input.driverId, "idle");
        }
        return { success: true, alreadyCompleted: false, tripCount: input.tripCount, totalAmount };
      }),
  }),

  // ─── 배차 이력 필터 + 정산 리포트 ────────────────────────────────────────
  settlement: router({
    // 월별 정산 리포트
    monthlyReport: publicProcedure
      .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => getMonthlySettlementReport(input.year, input.month)),

    // 기사별 월별 배차 상세 목록 (드릴다운)
    driverDetail: publicProcedure
      .input(z.object({ driverId: z.number(), year: z.number(), month: z.number().min(1).max(12) }))
      .query(async ({ input }) => getDriverMonthlyOrders(input.driverId, input.year, input.month)),

    // 배차 이력 필터 조회
    filteredOrders: publicProcedure
      .input(
        z.object({
          startDate: z.string().optional(), // ISO date string
          endDate: z.string().optional(),
          driverId: z.number().optional(),
        })
      )
      .query(async ({ input }) => {
        const allDrivers = await getAllDrivers();
        const driverMap = new Map(allDrivers.map((d) => [d.id, d]));
        const orders = await getFilteredDispatchOrders({
          startDate: input.startDate ? new Date(input.startDate) : undefined,
          endDate: input.endDate ? new Date(input.endDate) : undefined,
          driverId: input.driverId,
        });
        return orders.map((o) => ({ ...o, driver: driverMap.get(o.driverId) ?? null }));
      }),
  }),

  // ─── 문자 템플릿 ──────────────────────────────────────────────────────────
  smsTemplate: router({
    list: publicProcedure.query(async () => getAllSmsTemplates()),

    create: publicProcedure
      .input(
        z.object({
          title: z.string().min(1).max(100),
          content: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        await createSmsTemplate({ title: input.title, content: input.content });
        return { success: true };
      }),

    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSmsTemplate(input.id);
        return { success: true };
      }),
  }),

  // ─── 작업일지 관리 ────────────────────────────────────────────────────────
  workLog: router({
    // 기사: 내 작업일지 목록 (사진 포함)
    listByDriver: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => {
        const logs = await getWorkLogsByDriverId(input.driverId);
        const logsWithPhotos = await Promise.all(
          logs.map(async (log) => ({
            ...log,
            photos: await getPhotosByWorkLogId(log.id),
          }))
        );
        return logsWithPhotos;
      }),

    // 배차별 작업일지 조회 (사진 포함)
    getByDispatchOrder: publicProcedure
      .input(z.object({ dispatchOrderId: z.number() }))
      .query(async ({ input }) => {
        const log = await getWorkLogByDispatchOrderId(input.dispatchOrderId);
        if (!log) return null;
        const photos = await getPhotosByWorkLogId(log.id);
        return { ...log, photos };
      }),

    // 관리자: 전체 작업일지 목록 (기사 정보 + 사진 포함)
    listAll: publicProcedure.query(async () => {
      const logs = await getAllWorkLogs();
      const drivers = await getAllDrivers();
      const driverMap = new Map(drivers.map((d) => [d.id, d]));
      const logsWithDetails = await Promise.all(
        logs.map(async (log) => ({
          ...log,
          driver: driverMap.get(log.driverId) ?? null,
          photos: await getPhotosByWorkLogId(log.id),
        }))
      );
      return logsWithDetails;
    }),

    // 사진 삭제
    deletePhoto: publicProcedure
      .input(z.object({ photoId: z.number() }))
      .mutation(async ({ input }) => {
        await deleteWorkLogPhoto(input.photoId);
        return { success: true };
      }),
  }),

  // ─── 관리자 설정 ─────────────────────────────────────────────────────────
  admin: router({
    // 관리자 비밀번호 확인 (로그인 시 사용)
    verifyPassword: publicProcedure
      .input(z.object({ password: z.string() }))
      .mutation(async ({ input }) => {
        const stored = await getAppSetting("admin_password");
        const current = stored ?? "admin1234";
        const isValid = input.password === current;
        return { isValid };
      }),

    // 관리자 비밀번호 변경
    changePassword: publicProcedure
      .input(z.object({
        currentPassword: z.string(),
        newPassword: z.string().min(4, "비밀번호는 4자 이상이어야 합니다."),
      }))
      .mutation(async ({ input }) => {
        const stored = await getAppSetting("admin_password");
        const current = stored ?? "admin1234";
        if (input.currentPassword !== current) {
          throw new TRPCError({ code: "UNAUTHORIZED", message: "현재 비밀번호가 올바르지 않습니다." });
        }
        await setAppSetting("admin_password", input.newPassword);
        return { success: true };
      }),

    // 기사에게 알림 메시지 발송 (여러 기사 선택 가능)
    sendNotification: publicProcedure
      .input(z.object({
        driverIds: z.array(z.number()).min(1, "기사를 한 명 이상 선택해주세요."),
        title: z.string().min(1, "제목을 입력해주세요."),
        message: z.string().min(1, "메시지 내용을 입력해주세요."),
      }))
      .mutation(async ({ input }) => {
        const count = await sendDriverNotifications(input.driverIds, input.title, input.message);
        return { success: true, count };
      }),

    // 알림 발송 이력 조회 (관리자용)
    notificationHistory: publicProcedure
      .query(async () => getNotificationHistory(100)),
  }),

  // ─── 기사 알림 ────────────────────────────────────────────────────────
  notification: router({
    // 미읽음 알림 목록 조회
    getUnread: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .query(async ({ input }) => getUnreadNotifications(input.driverId)),

    // 알림 읽음 처리 (단건)
    markRead: publicProcedure
      .input(z.object({ notificationId: z.number(), driverId: z.number() }))
      .mutation(async ({ input }) => {
        await markNotificationRead(input.notificationId, input.driverId);
        return { success: true };
      }),

    // 전체 읽음 처리
    markAllRead: publicProcedure
      .input(z.object({ driverId: z.number() }))
      .mutation(async ({ input }) => {
        await markAllNotificationsRead(input.driverId);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;
