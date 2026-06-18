import { eq, desc, and, gte, lte, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  users,
  drivers,
  dispatchOrders,
  workLogs,
  workLogPhotos,
  smsTemplates,
  InsertDriver,
  InsertDispatchOrder,
  InsertWorkLog,
  InsertWorkLogPhoto,
  InsertSmsTemplate,
  driverPayments,
  InsertDriverPayment,
  appSettings,
  driverNotifications,
  DriverNotification,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = "admin";
      updateSet.role = "admin";
    }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── 기사 (Drivers) ────────────────────────────────────────────────────────

export async function getAllDrivers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(drivers).orderBy(drivers.createdAt);
}

export async function getDriverById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drivers).where(eq(drivers.id, id)).limit(1);
  return result[0];
}

export async function createDriver(data: InsertDriver) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(drivers).values(data);
}

export async function deleteDriver(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(drivers).where(eq(drivers.id, id));
}

export async function updateDriverStatus(
  id: number,
  status: "idle" | "driving" | "repair"
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(drivers).set({ status }).where(eq(drivers.id, id));
}

// ─── 배차 주문 (Dispatch Orders) ────────────────────────────────────────────

export async function getAllDispatchOrders() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(dispatchOrders).orderBy(desc(dispatchOrders.createdAt));
}

export async function getDispatchOrdersByDriverId(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(dispatchOrders)
    .where(eq(dispatchOrders.driverId, driverId))
    .orderBy(desc(dispatchOrders.createdAt));
}

export async function createDispatchOrder(data: InsertDispatchOrder) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(dispatchOrders).values(data);
}

export async function confirmDispatchOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(dispatchOrders)
    .set({ approvalStatus: "confirmed", confirmedAt: new Date() })
    .where(eq(dispatchOrders.id, id));
}

export async function completeDispatchOrder(
  id: number,
  tripCount: number,
  totalAmount: number
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(dispatchOrders)
    .set({ approvalStatus: "completed", completedAt: new Date(), tripCount, totalAmount })
    .where(eq(dispatchOrders.id, id));
}

export async function updateDispatchOrder(
  id: number,
  fields: {
    pickupLocation?: string;
    dropoffLocation?: string;
    unitPrice?: number | null;
    memo?: string | null;
    arrivalDeadline?: Date | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(dispatchOrders).set(fields).where(eq(dispatchOrders.id, id));
}

export async function cancelDispatchOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db
    .update(dispatchOrders)
    .set({ approvalStatus: "cancelled" })
    .where(eq(dispatchOrders.id, id));
}

export async function deleteDispatchOrder(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(dispatchOrders).where(eq(dispatchOrders.id, id));
}

export async function getDispatchOrderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(dispatchOrders)
    .where(eq(dispatchOrders.id, id))
    .limit(1);
  return result[0];
}

// ─── 작업일지 (Work Logs) ───────────────────────────────────────────────────

export async function createWorkLog(data: InsertWorkLog): Promise<{ insertId: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(workLogs).values(data);
  // Drizzle MySQL2 insert returns [ResultSetHeader, FieldPacket[]]
  const header = Array.isArray(result) ? result[0] : result;
  return { insertId: (header as any).insertId as number };
}

export async function getWorkLogByDispatchOrderId(dispatchOrderId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(workLogs)
    .where(eq(workLogs.dispatchOrderId, dispatchOrderId))
    .limit(1);
  return result[0];
}

export async function getWorkLogsByDriverId(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workLogs)
    .where(eq(workLogs.driverId, driverId))
    .orderBy(desc(workLogs.createdAt));
}

export async function getAllWorkLogs() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(workLogs).orderBy(desc(workLogs.createdAt));
}

// ─── 작업일지 사진 (Work Log Photos) ────────────────────────────────────────

export async function createWorkLogPhoto(data: InsertWorkLogPhoto) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(workLogPhotos).values(data);
}

export async function getPhotosByWorkLogId(workLogId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(workLogPhotos)
    .where(eq(workLogPhotos.workLogId, workLogId))
    .orderBy(workLogPhotos.createdAt);
}

export async function deleteWorkLogPhoto(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(workLogPhotos).where(eq(workLogPhotos.id, id));
}

// ─── 문자 템플릿 (SMS Templates) ───────────────────────────────────────────────

export async function getAllSmsTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(smsTemplates).orderBy(desc(smsTemplates.createdAt));
}

export async function createSmsTemplate(data: InsertSmsTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.insert(smsTemplates).values(data);
}

export async function deleteSmsTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.delete(smsTemplates).where(eq(smsTemplates.id, id));
}

// ─── 기사 차량 사진 업데이트 ────────────────────────────────────────────────────

export async function updateDriverVehiclePhoto(
  id: number,
  vehiclePhotoUrl: string,
  vehiclePhotoKey: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(drivers).set({ vehiclePhotoUrl, vehiclePhotoKey }).where(eq(drivers.id, id));
}

// ─── 기사별 배차 이력 집계 (Driver Summary) ────────────────────────────────────────

export async function getDriverMonthlySummary(driverId: number) {
  const db = await getDb();
  if (!db) return { totalDispatches: 0, completedDispatches: 0, totalAmount: 0 };

  // 이번 달 1일 00:00:00 UTC
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const rows = await db
    .select()
    .from(dispatchOrders)
    .where(
      and(
        eq(dispatchOrders.driverId, driverId),
        gte(dispatchOrders.createdAt, monthStart)
      )
    );

  const totalDispatches = rows.length;
  const completedRows = rows.filter((r) => r.approvalStatus === "completed");
  const completedDispatches = completedRows.length;
  const totalAmount = completedRows.reduce((sum, r) => sum + (r.totalAmount ?? 0), 0);

  return { totalDispatches, completedDispatches, totalAmount };
}

// 배차 이력 필터 조회 (날짜 범위 + 기사 ID)
export async function getFilteredDispatchOrders(params: {
  startDate?: Date;
  endDate?: Date;
  driverId?: number;
}) {
  const db = await getDb();
  if (!db) return [];

  const conditions = [];
  if (params.startDate) conditions.push(gte(dispatchOrders.createdAt, params.startDate));
  if (params.endDate) {
    const endOfDay = new Date(params.endDate);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(dispatchOrders.createdAt, endOfDay));
  }
  if (params.driverId) conditions.push(eq(dispatchOrders.driverId, params.driverId));

  const rows =
    conditions.length > 0
      ? await db.select().from(dispatchOrders).where(and(...conditions)).orderBy(desc(dispatchOrders.createdAt))
      : await db.select().from(dispatchOrders).orderBy(desc(dispatchOrders.createdAt));

  return rows;
}

// 월별 정산 리포트 (특정 연/월)
export async function getMonthlySettlementReport(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  const allDrivers = await db.select().from(drivers).orderBy(drivers.createdAt);
  const monthOrders = await db
    .select()
    .from(dispatchOrders)
    .where(and(gte(dispatchOrders.createdAt, monthStart), lte(dispatchOrders.createdAt, monthEnd)));

  return allDrivers.map((driver) => {
    const driverOrders = monthOrders.filter((o) => o.driverId === driver.id);
    const completedOrders = driverOrders.filter((o) => o.approvalStatus === "completed");
    const cancelledOrders = driverOrders.filter((o) => o.approvalStatus === "cancelled");
    // 취소 건은 정산 금액에서 제외 (completed 건만 합산)
    return {
      driverId: driver.id,
      driverName: driver.name,
      phone: driver.phone,
      vehicleNumber: driver.vehicleNumber,
      vehicleType: driver.vehicleType,
      affiliation: driver.affiliation,
      totalDispatches: driverOrders.length,
      completedDispatches: completedOrders.length,
      cancelledDispatches: cancelledOrders.length,
      totalAmount: completedOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0),
    };
  });
}

// 기사별 미확인(pending) 배차 카운트
export async function getPendingDispatchCountByDriverId(driverId: number) {
  const db = await getDb();
  if (!db) return 0;
  const rows = await db
    .select()
    .from(dispatchOrders)
    .where(and(eq(dispatchOrders.driverId, driverId), eq(dispatchOrders.approvalStatus, "pending")));
  return rows.length;
}

// 기사별 월별 배차 상세 목록 (정산 드릴다운용)
export async function getDriverMonthlyOrders(driverId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
  return db
    .select()
    .from(dispatchOrders)
    .where(
      and(
        eq(dispatchOrders.driverId, driverId),
        gte(dispatchOrders.createdAt, monthStart),
        lte(dispatchOrders.createdAt, monthEnd)
      )
    )
    .orderBy(desc(dispatchOrders.createdAt));
}

export async function getAllDriversMonthlySummary() {
  const db = await getDb();
  if (!db) return [];

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  // 모든 기사 목록
  const allDrivers = await db.select().from(drivers).orderBy(drivers.createdAt);

  // 이번 달 전체 배차 주문
  const monthOrders = await db
    .select()
    .from(dispatchOrders)
    .where(gte(dispatchOrders.createdAt, monthStart));

  return allDrivers.map((driver) => {
    const driverOrders = monthOrders.filter((o) => o.driverId === driver.id);
    const completedOrders = driverOrders.filter((o) => o.approvalStatus === "completed");
    return {
      driverId: driver.id,
      driverName: driver.name,
      phone: driver.phone,
      vehicleNumber: driver.vehicleNumber,
      vehicleType: driver.vehicleType,
      affiliation: driver.affiliation,
      status: driver.status,
      totalDispatches: driverOrders.length,
      completedDispatches: completedOrders.length,
      totalAmount: completedOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0),
    };
  });
}

// ─── 기사 PIN 로그인 관련 ────────────────────────────────────────────────────

export async function getDriverByPhone(phone: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(drivers).where(eq(drivers.phone, phone)).limit(1);
  return result[0];
}

export async function findDuplicateDriver(name: string, phone: string, vehicleNumber?: string | null) {
  const db = await getDb();
  if (!db) return { phoneConflict: false, nameVehicleConflict: false };

  // 전화번호 중복 체크
  const phoneResult = await db.select({ id: drivers.id, name: drivers.name })
    .from(drivers)
    .where(eq(drivers.phone, phone))
    .limit(1);
  const phoneConflict = phoneResult.length > 0;

  // 이름+차량번호 중복 체크 (차량번호가 있을 때만)
  let nameVehicleConflict = false;
  if (vehicleNumber && vehicleNumber.trim() !== "") {
    const { and } = await import("drizzle-orm");
    const nameVehicleResult = await db.select({ id: drivers.id })
      .from(drivers)
      .where(and(eq(drivers.name, name), eq(drivers.vehicleNumber, vehicleNumber)))
      .limit(1);
    nameVehicleConflict = nameVehicleResult.length > 0;
  }

  return { phoneConflict, nameVehicleConflict };
}

export async function updateDriverByAdmin(
  id: number,
  fields: {
    name?: string;
    phone?: string;
    vehicleNumber?: string | null;
    vehicleType?: string | null;
    affiliation?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(drivers).set(fields).where(eq(drivers.id, id));
}

export async function updateDriverPin(id: number, pinHash: string) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(drivers).set({ pinHash }).where(eq(drivers.id, id));
}

export async function updateDriverProfile(
  id: number,
  fields: {
    name?: string;
    phone?: string;
    vehicleNumber?: string | null;
    vehicleType?: string | null;
    affiliation?: string | null;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  return db.update(drivers).set(fields).where(eq(drivers.id, id));
}

// ─── 기사 완료 배차 이력 ──────────────────────────────────────────────────────
export async function getDriverCompletedHistory(
  driverId: number,
  year: number,
  month: number
) {
  const db = await getDb();
  if (!db) return [];
  const { and, eq, sql } = await import("drizzle-orm");

  // 해당 월의 시작/끝 Date 객체
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 1);

  return db
    .select({
      id: dispatchOrders.id,
      pickupLocation: dispatchOrders.pickupLocation,
      dropoffLocation: dispatchOrders.dropoffLocation,
      unitPrice: dispatchOrders.unitPrice,
      tripCount: dispatchOrders.tripCount,
      totalAmount: dispatchOrders.totalAmount,
      memo: dispatchOrders.memo,
      arrivalDeadline: dispatchOrders.arrivalDeadline,
      completedAt: dispatchOrders.completedAt,
      createdAt: dispatchOrders.createdAt,
    })
    .from(dispatchOrders)
    .where(
      and(
        eq(dispatchOrders.driverId, driverId),
        eq(dispatchOrders.approvalStatus, "completed"),
        sql`${dispatchOrders.completedAt} >= ${startDate}`,
        sql`${dispatchOrders.completedAt} < ${endDate}`
      )
    )
    .orderBy(dispatchOrders.completedAt);
}

export async function getDriverMonthlyEarnings(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  const { eq, and, sql } = await import("drizzle-orm");

  // 최근 12개월 월별 집계
  const results = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1);

    const rows = await db
      .select({
        count: sql<number>`count(*)`,
        total: sql<number>`coalesce(sum(${dispatchOrders.totalAmount}), 0)`,
      })
      .from(dispatchOrders)
      .where(
        and(
          eq(dispatchOrders.driverId, driverId),
          eq(dispatchOrders.approvalStatus, "completed"),
          sql`${dispatchOrders.completedAt} >= ${startDate}`,
          sql`${dispatchOrders.completedAt} < ${endDate}`
        )
      );

    results.push({
      year,
      month,
      count: Number(rows[0]?.count ?? 0),
      total: Number(rows[0]?.total ?? 0),
    });
  }
  return results;
}

// ─── 기사별 이번 달 배차 완료 일수 통계 ──────────────────────────────────────────

/**
 * 모든 기사의 이번 달 배차 완료 일수를 계산합니다.
 * - 배차 완료(completed) 건의 completedAt 날짜 중 이번 달에 해당하는 날짜를 유니크하게 집계
 * - 20일 미만이면 경고 대상
 */
export async function getDriverDispatchDayStats() {
  const { eq, and, gte, lt } = await import("drizzle-orm");
  const db = await getDb();
  if (!db) return [];

  const allDrivers = await db.select().from(drivers).orderBy(drivers.createdAt);

  // 이번 달 시작/끝
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  // 이번 달 완료된 배차 조회
  const completedOrders = await db
    .select({
      driverId: dispatchOrders.driverId,
      completedAt: dispatchOrders.completedAt,
    })
    .from(dispatchOrders)
    .where(
      and(
        eq(dispatchOrders.approvalStatus, "completed"),
        gte(dispatchOrders.completedAt, monthStart),
        lt(dispatchOrders.completedAt, monthEnd)
      )
    );

  return allDrivers.map((driver) => {
    // 해당 기사의 이번 달 완료 배차에서 날짜를 유니크하게 집계
    const driverOrders = completedOrders.filter((o) => o.driverId === driver.id);
    const uniqueDays = new Set(
      driverOrders
        .filter((o) => o.completedAt)
        .map((o) => {
          const d = new Date(o.completedAt!);
          return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
        })
    );

    const dispatchDaysThisMonth = uniqueDays.size;

    return {
      driverId: driver.id,
      driverName: driver.name,
      vehicleNumber: driver.vehicleNumber,
      affiliation: driver.affiliation,
      status: driver.status,
      dispatchDaysThisMonth,
    };
  });
}

// ─── 계좌번호 업데이트 ───────────────────────────────────────────────────────
export async function updateDriverBankInfo(
  driverId: number,
  data: { bankName?: string; accountNumber?: string; accountHolder?: string }
): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(drivers)
    .set({
      bankName: data.bankName ?? null,
      accountNumber: data.accountNumber ?? null,
      accountHolder: data.accountHolder ?? null,
    })
    .where(eq(drivers.id, driverId));
}

// ─── 지급 내역 등록 ──────────────────────────────────────────────────────────
export async function createDriverPayment(data: {
  driverId: number;
  companyName: string;
  amount: number;
  paidAt: Date;
  memo?: string;
}): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.insert(driverPayments).values({
    driverId: data.driverId,
    companyName: data.companyName,
    amount: data.amount,
    paidAt: data.paidAt,
    memo: data.memo ?? null,
  });
}

// ─── 기사별 지급 내역 조회 ────────────────────────────────────────────────────
export async function getDriverPayments(driverId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(driverPayments)
    .where(eq(driverPayments.driverId, driverId))
    .orderBy(desc(driverPayments.paidAt));
}

// ─── 정산 탭용: 기사별 총 정산액 + 총 지급액 + 미지급 잔액 ──────────────────────
export async function getDriverSettlementSummary(year: number, month: number) {
  const db = await getDb();
  if (!db) return [];

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  // 이번 달 완료 배차 totalAmount 집계
  const completedOrders = await db
    .select({
      driverId: dispatchOrders.driverId,
      totalAmount: dispatchOrders.totalAmount,
    })
    .from(dispatchOrders)
    .where(
      and(
        eq(dispatchOrders.approvalStatus, "completed"),
        gte(dispatchOrders.completedAt, monthStart),
        lt(dispatchOrders.completedAt, monthEnd)
      )
    );

  // 이번 달 지급 내역 집계
  const payments = await db
    .select()
    .from(driverPayments)
    .where(
      and(
        gte(driverPayments.paidAt, monthStart),
        lt(driverPayments.paidAt, monthEnd)
      )
    );

  // 기사 목록
  const allDrivers = await db.select().from(drivers).orderBy(drivers.name);

  return allDrivers.map((driver) => {
    const earned = completedOrders
      .filter((o) => o.driverId === driver.id)
      .reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);

    const driverPaymentList = payments.filter((p) => p.driverId === driver.id);
    const paid = driverPaymentList.reduce((sum, p) => sum + p.amount, 0);

    return {
      driverId: driver.id,
      driverName: driver.name,
      vehicleNumber: driver.vehicleNumber,
      affiliation: driver.affiliation,
      bankName: driver.bankName,
      accountNumber: driver.accountNumber,
      accountHolder: driver.accountHolder,
      totalEarned: earned,
      totalPaid: paid,
      remaining: earned - paid,
      payments: driverPaymentList,
    };
  });
}

// ─── 앱 설정 (App Settings) ────────────────────────────────────────────────

export async function getAppSetting(key: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return result[0]?.value ?? null;
}

export async function setAppSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db
    .insert(appSettings)
    .values({ key, value })
    .onDuplicateKeyUpdate({ set: { value } });
}

// ─── 기사용: 개인 정산 현황 (총 근무일수 + 총매출 + 지급액 + 미지급액) ──────────────
export async function getMySettlement(driverId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return null;

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 1);

  // 이번 달 완료 배차 (totalAmount 집계)
  const completedOrders = await db
    .select()
    .from(dispatchOrders)
    .where(
      and(
        eq(dispatchOrders.driverId, driverId),
        eq(dispatchOrders.approvalStatus, "completed"),
        gte(dispatchOrders.completedAt, monthStart),
        lt(dispatchOrders.completedAt, monthEnd)
      )
    )
    .orderBy(desc(dispatchOrders.completedAt));

  // 총 근무일수: 완료 배차의 completedAt 날짜 기준 unique 일수
  const uniqueDays = new Set(
    completedOrders
      .filter((o) => o.completedAt)
      .map((o) => {
        const d = new Date(o.completedAt!);
        return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      })
  );
  const workDays = uniqueDays.size;

  // 총 매출 (완료 배차 totalAmount 합산)
  const totalEarned = completedOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);

  // 이번 달 지급 내역
  const myPayments = await db
    .select()
    .from(driverPayments)
    .where(
      and(
        eq(driverPayments.driverId, driverId),
        gte(driverPayments.paidAt, monthStart),
        lt(driverPayments.paidAt, monthEnd)
      )
    )
    .orderBy(desc(driverPayments.paidAt));

  const totalPaid = myPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalEarned - totalPaid;

  return {
    year,
    month,
    workDays,
    totalEarned,
    totalPaid,
    remaining,
    completedCount: completedOrders.length,
    payments: myPayments,
    orders: completedOrders.map((o) => ({
      id: o.id,
      pickupLocation: o.pickupLocation,
      dropoffLocation: o.dropoffLocation,
      totalAmount: o.totalAmount,
      tripCount: o.tripCount,
      completedAt: o.completedAt,
      memo: o.memo,
    })),
  };
}

// ─── 기사용: 전체 기간 누적 정산 (지급 포함) ──────────────────────────────────────
export async function getMySettlementAllTime(driverId: number) {
  const db = await getDb();
  if (!db) return null;

  // 전체 완료 배차
  const completedOrders = await db
    .select()
    .from(dispatchOrders)
    .where(
      and(
        eq(dispatchOrders.driverId, driverId),
        eq(dispatchOrders.approvalStatus, "completed")
      )
    );

  const totalEarned = completedOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);

  // 전체 지급 내역
  const allPayments = await db
    .select()
    .from(driverPayments)
    .where(eq(driverPayments.driverId, driverId))
    .orderBy(desc(driverPayments.paidAt));

  const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = totalEarned - totalPaid;

  return {
    totalEarned,
    totalPaid,
    remaining,
    completedCount: completedOrders.length,
    payments: allPayments,
  };
}

// ─── 기사 알림 메시지 관련 함수 ────────────────────────────────────────────────

/** 알림 발송: 여러 기사에게 동일 메시지 일괄 발송 */
export async function sendDriverNotifications(
  driverIds: number[],
  title: string,
  message: string
): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  if (driverIds.length === 0) return 0;

  const rows = driverIds.map((driverId) => ({ driverId, title, message, isRead: 0 }));
  await db.insert(driverNotifications).values(rows);
  return driverIds.length;
}

/** 미읽음 알림 조회: 기사가 로그인 후 팝업으로 확인할 알림 목록 */
export async function getUnreadNotifications(driverId: number): Promise<DriverNotification[]> {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(driverNotifications)
    .where(and(eq(driverNotifications.driverId, driverId), eq(driverNotifications.isRead, 0)))
    .orderBy(driverNotifications.createdAt);
}

/** 알림 읽음 처리: 특정 알림 ID를 읽음으로 표시 */
export async function markNotificationRead(notificationId: number, driverId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(driverNotifications)
    .set({ isRead: 1 })
    .where(
      and(eq(driverNotifications.id, notificationId), eq(driverNotifications.driverId, driverId))
    );
}

/** 모든 알림 읽음 처리: 기사의 미읽음 알림 전체 읽음 처리 */
export async function markAllNotificationsRead(driverId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db
    .update(driverNotifications)
    .set({ isRead: 1 })
    .where(and(eq(driverNotifications.driverId, driverId), eq(driverNotifications.isRead, 0)));
}

/** 발송 이력 조회: 관리자용 - 최근 발송된 알림 목록 (기사명 포함) */
export async function getNotificationHistory(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: driverNotifications.id,
      driverId: driverNotifications.driverId,
      driverName: drivers.name,
      title: driverNotifications.title,
      message: driverNotifications.message,
      isRead: driverNotifications.isRead,
      createdAt: driverNotifications.createdAt,
    })
    .from(driverNotifications)
    .leftJoin(drivers, eq(driverNotifications.driverId, drivers.id))
    .orderBy(desc(driverNotifications.createdAt))
    .limit(limit);
  return rows;
}
