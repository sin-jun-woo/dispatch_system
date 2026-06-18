import { describe, it, expect, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// DB 모듈 모킹
vi.mock("./db", () => ({
  getAllDrivers: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "김민준",
      phone: "010-1234-5678",
      vehicleNumber: "12가 3456",
      vehicleType: "1톤 트럭",
      affiliation: "서울물류",
      status: "idle",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getDriverById: vi.fn().mockResolvedValue({
    id: 1,
    name: "김민준",
    phone: "010-1234-5678",
    vehicleNumber: "12가 3456",
    vehicleType: "1톤 트럭",
    affiliation: "서울물류",
    status: "idle",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  createDriver: vi.fn().mockResolvedValue({ insertId: 2 }),
  deleteDriver: vi.fn().mockResolvedValue({}),
  updateDriverStatus: vi.fn().mockResolvedValue({}),
  getAllDispatchOrders: vi.fn().mockResolvedValue([
    {
      id: 1,
      driverId: 1,
      pickupLocation: "서울시 강남구",
      dropoffLocation: "서울시 마포구",
      approvalStatus: "pending",
      dispatchType: "forced",
      memo: null,
      confirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getDispatchOrdersByDriverId: vi.fn().mockResolvedValue([
    {
      id: 1,
      driverId: 1,
      pickupLocation: "서울시 강남구",
      dropoffLocation: "서울시 마포구",
      approvalStatus: "pending",
      dispatchType: "forced",
      memo: null,
      confirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  createDispatchOrder: vi.fn().mockResolvedValue({ insertId: 1 }),
  confirmDispatchOrder: vi.fn().mockResolvedValue({}),
  getDispatchOrderById: vi.fn().mockImplementation(async (id: number) => {
    if (id === 1) {
      return {
        id: 1,
        driverId: 1,
        pickupLocation: "서울시 강남구",
        dropoffLocation: "서울시 마포구",
        approvalStatus: "pending",
        dispatchType: "forced",
        memo: null,
        confirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    if (id === 99) {
      return {
        id: 99,
        driverId: 1,
        pickupLocation: "부산시 해운대구",
        dropoffLocation: "부산시 남구",
        approvalStatus: "confirmed",
        dispatchType: "forced",
        memo: null,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // id=200: 회차 단가 35,000원이 설정된 confirmed 배차
    if (id === 200) {
      return {
        id: 200,
        driverId: 1,
        pickupLocation: "서울시 강남구",
        dropoffLocation: "서울시 마포구",
        approvalStatus: "confirmed",
        dispatchType: "forced",
        unitPrice: 35000,
        tripCount: null,
        totalAmount: null,
        memo: null,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // id=201: 회차 단가 없는 confirmed 배차 (unitPrice = null)
    if (id === 201) {
      return {
        id: 201,
        driverId: 1,
        pickupLocation: "인체시 연수구",
        dropoffLocation: "인체시 남동구",
        approvalStatus: "confirmed",
        dispatchType: "forced",
        unitPrice: null,
        tripCount: null,
        totalAmount: null,
        memo: null,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // id=202: 이미 completed 상태인 배차 (alreadyCompleted 체크)
    if (id === 202) {
      return {
        id: 202,
        driverId: 1,
        pickupLocation: "대전시 유성구",
        dropoffLocation: "대전시 서구",
        approvalStatus: "completed",
        dispatchType: "forced",
        unitPrice: 35000,
        tripCount: 4,
        totalAmount: 140000,
        memo: null,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // id=203: pending 상태 (완료 처리 불가)
    if (id === 203) {
      return {
        id: 203,
        driverId: 1,
        pickupLocation: "광주시 동구",
        dropoffLocation: "광주시 서구",
        approvalStatus: "pending",
        dispatchType: "forced",
        unitPrice: 35000,
        tripCount: null,
        totalAmount: null,
        memo: null,
        confirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // id=204: 단가 1원 (최소 단가 경계값)
    if (id === 204) {
      return {
        id: 204,
        driverId: 1,
        pickupLocation: "서울시 용산구",
        dropoffLocation: "서울시 동작구",
        approvalStatus: "confirmed",
        dispatchType: "forced",
        unitPrice: 1,
        tripCount: null,
        totalAmount: null,
        memo: null,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // id=205: 단가 100,000원 (고단가)
    if (id === 205) {
      return {
        id: 205,
        driverId: 1,
        pickupLocation: "인체시 남동구",
        dropoffLocation: "수원시 영통구",
        approvalStatus: "confirmed",
        dispatchType: "forced",
        unitPrice: 100000,
        tripCount: null,
        totalAmount: null,
        memo: null,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // id=206: 취소 상태인 배차 (완료 처리 불가)
    if (id === 206) {
      return {
        id: 206,
        driverId: 1,
        pickupLocation: "대구시 중구",
        dropoffLocation: "대구시 달서구",
        approvalStatus: "cancelled",
        dispatchType: "forced",
        unitPrice: 35000,
        tripCount: null,
        totalAmount: null,
        memo: null,
        confirmedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // id=207: 단가 50,000원, 다른 기사(driverId=2)
    if (id === 207) {
      return {
        id: 207,
        driverId: 2,
        pickupLocation: "부산시 중구",
        dropoffLocation: "부산시 해운대구",
        approvalStatus: "confirmed",
        dispatchType: "forced",
        unitPrice: 50000,
        tripCount: null,
        totalAmount: null,
        memo: null,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    // id=208: 단가 10,000원, 매우 많은 회수(999회)
    if (id === 208) {
      return {
        id: 208,
        driverId: 1,
        pickupLocation: "서울시 신도림구",
        dropoffLocation: "서울시 신대방구",
        approvalStatus: "confirmed",
        dispatchType: "forced",
        unitPrice: 10000,
        tripCount: null,
        totalAmount: null,
        memo: null,
        confirmedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
    return undefined;
  }),
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getWorkLogsByDriverId: vi.fn().mockResolvedValue([
    {
      id: 1,
      driverId: 1,
      dispatchOrderId: 1,
      memo: "작업 완료",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getWorkLogByDispatchOrderId: vi.fn().mockResolvedValue({
    id: 1,
    driverId: 1,
    dispatchOrderId: 1,
    memo: "작업 완료",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getAllWorkLogs: vi.fn().mockResolvedValue([
    {
      id: 1,
      driverId: 1,
      dispatchOrderId: 1,
      memo: "작업 완료",
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getPhotosByWorkLogId: vi.fn().mockResolvedValue([
    {
      id: 1,
      workLogId: 1,
      storageUrl: "https://example.com/photo1.jpg",
      originalName: "invoice.jpg",
      createdAt: new Date(),
    },
  ]),
  deleteWorkLogPhoto: vi.fn().mockResolvedValue({}),
  completeDispatchOrder: vi.fn().mockResolvedValue({}),
  updateDispatchOrder: vi.fn().mockResolvedValue({}),
  cancelDispatchOrder: vi.fn().mockResolvedValue({}),
  deleteDispatchOrder: vi.fn().mockResolvedValue({}),
  getAllSmsTemplates: vi.fn().mockResolvedValue([
    { id: 1, title: "기본 배차 안내", content: "기사님 배차지\n출발지: A\n도착지: B", createdAt: new Date(), updatedAt: new Date() },
  ]),
  createSmsTemplate: vi.fn().mockResolvedValue({ insertId: 1 }),
  deleteSmsTemplate: vi.fn().mockResolvedValue({}),
  getAllDriversMonthlySummary: vi.fn().mockResolvedValue([
    {
      driverId: 1,
      driverName: "김민준",
      phone: "010-1234-5678",
      vehicleNumber: "12가 3456",
      vehicleType: "1톤 트럭",
      affiliation: "서울물류",
      status: "idle",
      totalDispatches: 5,
      completedDispatches: 3,
      totalAmount: 150000,
    },
  ]),
  getMonthlySettlementReport: vi.fn().mockResolvedValue([
    {
      driverId: 1,
      driverName: "김민준",
      phone: "010-1234-5678",
      vehicleNumber: "12가 3456",
      vehicleType: "1톤 트럭",
      affiliation: "서울물류",
      totalDispatches: 6,
      completedDispatches: 3,
      cancelledDispatches: 2,
      totalAmount: 150000,
    },
  ]),
  getDriverMonthlyOrders: vi.fn().mockResolvedValue([
    {
      id: 1,
      driverId: 1,
      pickupLocation: "서울시 강남구",
      dropoffLocation: "서울시 마포구",
      approvalStatus: "completed",
      dispatchType: "forced",
      unitPrice: 50000,
      tripCount: 1,
      totalAmount: 50000,
      memo: null,
      confirmedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    {
      id: 2,
      driverId: 1,
      pickupLocation: "부산시 해운대구",
      dropoffLocation: "부산시 남구",
      approvalStatus: "cancelled",
      dispatchType: "forced",
      unitPrice: 50000,
      tripCount: 1,
      totalAmount: 0,
      memo: null,
      confirmedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  ]),
  getFilteredDispatchOrders: vi.fn().mockResolvedValue([]),
  findDuplicateDriver: vi.fn().mockResolvedValue({ phoneConflict: false, nameVehicleConflict: false }),
  getDriverByPhone: vi.fn().mockResolvedValue(undefined),
  updateDriverPin: vi.fn().mockResolvedValue({}),
  updateDriverProfile: vi.fn().mockResolvedValue({}),
  updateDriverByAdmin: vi.fn().mockResolvedValue({}),
  getPendingDispatchCountByDriverId: vi.fn().mockResolvedValue([{ count: 0 }]),
}));

function createCtx(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

describe("driver procedures", () => {
  it("driver.list returns driver array", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.driver.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.name).toBe("김민준");
  });

  it("driver.get returns driver by id", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.driver.get({ id: 1 });
    expect(result?.name).toBe("김민준");
  });

  it("driver.create succeeds with name and phone", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.driver.create({ name: "이서연", phone: "010-9999-0000" });
    expect(result.success).toBe(true);
  });

  it("driver.updateStatus changes driver status to driving", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.driver.updateStatus({ id: 1, status: "driving" });
    expect(result.success).toBe(true);
  });

  it("driver.updateStatus changes driver status to repair", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.driver.updateStatus({ id: 1, status: "repair" });
    expect(result.success).toBe(true);
  });

  it("driver.updateStatus changes driver status back to idle", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.driver.updateStatus({ id: 1, status: "idle" });
    expect(result.success).toBe(true);
  });

  it("driver.adminUpdate 성공: 이름/전화번호/차량번호 수정", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.driver.adminUpdate({
      id: 1,
      name: "박지수",
      phone: "010-5555-6666",
      vehicleNumber: "99나 1234",
      vehicleType: "2.5톤 트럭",
      affiliation: "부산물류",
    });
    expect(result.success).toBe(true);
  });

  it("driver.adminUpdate 이름만 수정 (다른 필드 생략)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.driver.adminUpdate({ id: 1, name: "김체원" });
    expect(result.success).toBe(true);
  });

  it("driver.adminUpdate 전화번호 중복 시 CONFLICT 에러", async () => {
    const { getDriverByPhone } = await import("./db");
    // 다른 기사(id=2)가 이미 해당 전화번호 사용 중
    vi.mocked(getDriverByPhone).mockResolvedValueOnce({
      id: 2,
      name: "다른기사",
      phone: "010-7777-8888",
      vehicleNumber: null,
      vehicleType: null,
      affiliation: null,
      status: "idle",
      pinHash: null,
      vehiclePhotoUrl: null,
      vehiclePhotoKey: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.driver.adminUpdate({ id: 1, name: "김민준", phone: "010-7777-8888" })
    ).rejects.toThrow("이미 등록된 전화번호입니다.");
  });
});

describe("dispatch procedures", () => {
  it("dispatch.listAll returns orders with driver info", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.listAll();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.driver?.name).toBe("김민준");
  });

  it("dispatch.listByDriver returns orders for driver", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.listByDriver({ driverId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.driverId).toBe(1);
  });

  it("dispatch.create creates a forced dispatch", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.create({
      driverId: 1,
      pickupLocation: "서울시 강남구 테헤란로",
      dropoffLocation: "서울시 마포구 합정동",
      dispatchType: "forced",
    });
    expect(result.success).toBe(true);
  });

  it("dispatch.confirm changes status to confirmed", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.confirm({ id: 1 });
    expect(result.success).toBe(true);
    expect(result.alreadyConfirmed).toBe(false);
  });

  it("dispatch.confirm returns alreadyConfirmed=true for already confirmed order", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.confirm({ id: 99 });
    expect(result.success).toBe(true);
    expect(result.alreadyConfirmed).toBe(true);
  });

  it("dispatch.confirm throws for non-existent order", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.dispatch.confirm({ id: 9999 })).rejects.toThrow("배차를 찾을 수 없습니다.");
  });

  // ─── 회차 단가 자동 계산 로직 테스트 스위트 ───────────────────────────────────

  it("dispatch.complete: 단가 35,000원 xd7 3회 = totalAmount 105,000원 자동 계산", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=200: unitPrice=35000, confirmed 상태
    const result = await caller.dispatch.complete({ id: 200, tripCount: 3 });
    expect(result.success).toBe(true);
    expect(result.tripCount).toBe(3);
    expect(result.totalAmount).toBe(105000); // 35000 xd7 3
    expect(result.alreadyCompleted).toBe(false);
  });

  it("dispatch.complete: 단가 35,000원 xd7 1회 = totalAmount 35,000원 (최소 회수)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.complete({ id: 200, tripCount: 1 });
    expect(result.success).toBe(true);
    expect(result.tripCount).toBe(1);
    expect(result.totalAmount).toBe(35000); // 35000 xd7 1
  });

  it("dispatch.complete: 단가 35,000원 xd7 10회 = totalAmount 350,000원 (대량 회수)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.complete({ id: 200, tripCount: 10 });
    expect(result.success).toBe(true);
    expect(result.tripCount).toBe(10);
    expect(result.totalAmount).toBe(350000); // 35000 xd7 10
  });

  it("dispatch.complete: unitPrice 미설정(null)일 때 totalAmount = 0", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=201: unitPrice=null, confirmed 상태
    const result = await caller.dispatch.complete({ id: 201, tripCount: 5 });
    expect(result.success).toBe(true);
    expect(result.tripCount).toBe(5);
    expect(result.totalAmount).toBe(0); // 단가 없으면 0원
  });

  it("dispatch.complete: 이미 completed 상태이면 alreadyCompleted=true 반환", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=202: 이미 completed, tripCount=4, totalAmount=140000
    const result = await caller.dispatch.complete({ id: 202, tripCount: 2 });
    expect(result.success).toBe(true);
    expect(result.alreadyCompleted).toBe(true);
    // 이미 저장된 기존 값 반환
    expect(result.tripCount).toBe(4);
    expect(result.totalAmount).toBe(140000);
  });

  it("dispatch.complete: pending 상태 배차는 완료 처리 불가 (에러 발생)", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=203: pending 상태
    await expect(
      caller.dispatch.complete({ id: 203, tripCount: 3 })
    ).rejects.toThrow("승인된 배차만 완료 처리할 수 있습니다.");
  });

  it("dispatch.complete: 존재하지 않는 배차 ID는 에러 발생", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.dispatch.complete({ id: 9999, tripCount: 1 })
    ).rejects.toThrow("배차를 찾을 수 없습니다.");
  });

  it("dispatch.complete: 정수 회수만 허용 (tripCount < 1 입력 불가)", async () => {
    const caller = appRouter.createCaller(createCtx());
    // tRPC z.number().int().min(1) 검증에 의해 거절됨
    await expect(
      caller.dispatch.complete({ id: 200, tripCount: 0 })
    ).rejects.toThrow();
  });

  it("dispatch.complete: 이전 테스트 (id=99, unitPrice 미설정) tripCount 저장 확인", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=99는 unitPrice 필드 없음 → 0원으로 처리
    const result = await caller.dispatch.complete({ id: 99, tripCount: 3 });
    expect(result.success).toBe(true);
    expect(result.tripCount).toBe(3);
    expect(result.totalAmount).toBe(0);
  });

  // ─── 회차 단가 자동 계산 추가 테스트 케이스 ──────────────────────────────────────────

  it("dispatch.complete: 단가 1원 × 5회 = totalAmount 5원 (최소 단가 경계값)", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=204: unitPrice=1
    const result = await caller.dispatch.complete({ id: 204, tripCount: 5 });
    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(5);   // 1 × 5
    expect(result.tripCount).toBe(5);
    expect(result.alreadyCompleted).toBe(false);
  });

  it("dispatch.complete: 단가 100,000원 × 7회 = totalAmount 700,000원 (고단가)", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=205: unitPrice=100000
    const result = await caller.dispatch.complete({ id: 205, tripCount: 7 });
    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(700000); // 100000 × 7
    expect(result.tripCount).toBe(7);
  });

  it("dispatch.complete: 취소(cancelled) 상태 배차는 완료 처리 불가 (에러 발생)", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=206: approvalStatus='cancelled'
    await expect(
      caller.dispatch.complete({ id: 206, tripCount: 2 })
    ).rejects.toThrow("승인된 배차만 완료 처리할 수 있습니다.");
  });

  it("dispatch.complete: 다른 기사(driverId=2) 배차 완료 시 단가 50,000원 × 4회 = 200,000원", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=207: driverId=2, unitPrice=50000
    const result = await caller.dispatch.complete({ id: 207, driverId: 2, tripCount: 4 });
    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(200000); // 50000 × 4
    expect(result.tripCount).toBe(4);
    expect(result.alreadyCompleted).toBe(false);
  });

  it("dispatch.complete: 단가 10,000원 × 999회 = totalAmount 9,990,000원 (최대 회수)", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=208: unitPrice=10000
    const result = await caller.dispatch.complete({ id: 208, tripCount: 999 });
    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(9990000); // 10000 × 999
    expect(result.tripCount).toBe(999);
  });

  it("dispatch.complete: tripCount가 정수가 아닌 경우 스키마 검증 에러", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.dispatch.complete({ id: 200, tripCount: 1.5 }) // 소수점
    ).rejects.toThrow();
  });

  it("dispatch.complete: driverId 없이도 완료 처리 성공 (driverId 선택 필드)", async () => {
    const caller = appRouter.createCaller(createCtx());
    // driverId 없이 호출 → 기사 상태 변경 없이 완료만 저장
    const result = await caller.dispatch.complete({ id: 200, tripCount: 2 });
    expect(result.success).toBe(true);
    expect(result.totalAmount).toBe(70000); // 35000 × 2
    expect(result.alreadyCompleted).toBe(false);
  });

  it("dispatch.createMultiple creates individual orders for each driver", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.createMultiple({
      driverIds: [1, 2, 3],
      pickupLocation: "서울시 강남구 테헤란로",
      dropoffLocation: "서울시 마포구 합정동",
    });
    expect(result.success).toBe(true);
    expect(result.count).toBe(3);
  });

  it("dispatch.createMultiple with single driver returns count=1", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.createMultiple({
      driverIds: [1],
      pickupLocation: "부산시 해운대구",
      dropoffLocation: "부산시 남구",
      unitPrice: 50000,
    });
    expect(result.success).toBe(true);
    expect(result.count).toBe(1);
  });

  it("dispatch.createMultiple with arrivalDeadline stores deadline", async () => {
    const caller = appRouter.createCaller(createCtx());
    const deadline = new Date("2026-06-20T09:00:00").toISOString();
    const result = await caller.dispatch.createMultiple({
      driverIds: [1, 2],
      pickupLocation: "서울시 강남구",
      dropoffLocation: "인천시 연수구",
      arrivalDeadline: deadline,
    });
    expect(result.success).toBe(true);
    expect(result.count).toBe(2);
  });

  it("dispatch.createMultiple throws with empty driverIds", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.dispatch.createMultiple({
        driverIds: [],
        pickupLocation: "서울시 강남구",
        dropoffLocation: "서울시 마포구",
      })
    ).rejects.toThrow();
  });

  it("dispatch.cancel cancels a pending order", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=1 is in 'pending' state (see mock above)
    const result = await caller.dispatch.cancel({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("dispatch.cancel throws for non-existent order", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.dispatch.cancel({ id: 9999 })).rejects.toThrow("배차를 찾을 수 없습니다.");
  });

  it("dispatch.delete removes an order", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=1 exists in mock
    const result = await caller.dispatch.delete({ id: 1 });
    expect(result.success).toBe(true);
  });

  it("dispatch.delete throws for non-existent order", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(caller.dispatch.delete({ id: 9999 })).rejects.toThrow("배차를 찾을 수 없습니다.");
  });

  // ─── 배차 수정(update) 테스트 스위트 ──────────────────────────────────────────

  it("dispatch.update: pending 배차의 출발지/도착지 수정 성공", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=1 is pending
    const result = await caller.dispatch.update({
      id: 1,
      pickupLocation: "수정된 출발지",
      dropoffLocation: "수정된 도착지",
    });
    expect(result.success).toBe(true);
  });

  it("dispatch.update: confirmed 배차의 단가 수정 성공", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=99 is confirmed
    const result = await caller.dispatch.update({
      id: 99,
      unitPrice: 40000,
    });
    expect(result.success).toBe(true);
  });

  it("dispatch.update: 단가를 null로 설정하면 성공 (단가 제거)", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.update({
      id: 99,
      unitPrice: null,
    });
    expect(result.success).toBe(true);
  });

  it("dispatch.update: 메모 수정 성공", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.update({
      id: 1,
      memo: "수정된 메모 내용",
    });
    expect(result.success).toBe(true);
  });

  it("dispatch.update: 도착 기한 수정 성공", async () => {
    const caller = appRouter.createCaller(createCtx());
    const deadline = new Date("2026-12-31T18:00:00").toISOString();
    const result = await caller.dispatch.update({
      id: 1,
      arrivalDeadline: deadline,
    });
    expect(result.success).toBe(true);
  });

  it("dispatch.update: 도착 기한을 null로 제거 성공", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.dispatch.update({
      id: 1,
      arrivalDeadline: null,
    });
    expect(result.success).toBe(true);
  });

  it("dispatch.update: completed 배차는 수정 불가 (에러 발생)", async () => {
    const caller = appRouter.createCaller(createCtx());
    // id=202 is completed
    await expect(
      caller.dispatch.update({ id: 202, pickupLocation: "수정 시도" })
    ).rejects.toThrow("완료되거나 취소된 배차는 수정할 수 없습니다.");
  });

  it("dispatch.update: 존재하지 않는 배차 ID는 에러 발생", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.dispatch.update({ id: 9999, pickupLocation: "수정 시도" })
    ).rejects.toThrow("배차를 찾을 수 없습니다.");
  });
});

describe("workLog procedures", () => {
  it("workLog.listByDriver returns logs with photos for driver", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.workLog.listByDriver({ driverId: 1 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.driverId).toBe(1);
    expect(Array.isArray(result[0]?.photos)).toBe(true);
    expect(result[0]?.photos[0]?.originalName).toBe("invoice.jpg");
  });

  it("workLog.getByDispatchOrder returns log with photos", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.workLog.getByDispatchOrder({ dispatchOrderId: 1 });
    expect(result).not.toBeNull();
    expect(result?.dispatchOrderId).toBe(1);
    expect(Array.isArray(result?.photos)).toBe(true);
  });

  it("workLog.listAll returns all logs with driver info and photos", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.workLog.listAll();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.driver?.name).toBe("김민준");
    expect(Array.isArray(result[0]?.photos)).toBe(true);
  });

  it("workLog.deletePhoto calls deleteWorkLogPhoto", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.workLog.deletePhoto({ photoId: 1 });
    expect(result.success).toBe(true);
  });
});

describe("smsTemplate procedures", () => {
  it("smsTemplate.list returns template array", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.smsTemplate.list();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.title).toBe("기본 배차 안내");
  });

  it("smsTemplate.create saves a new template", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.smsTemplate.create({
      title: "야간 배차 안내",
      content: "기사님 야간 배차지\n출발지: C\n도착지: D",
    });
    expect(result.success).toBe(true);
  });

  it("smsTemplate.create requires non-empty title", async () => {
    const caller = appRouter.createCaller(createCtx());
    await expect(
      caller.smsTemplate.create({ title: "", content: "내용" })
    ).rejects.toThrow();
  });

  it("smsTemplate.delete removes a template", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.smsTemplate.delete({ id: 1 });
    expect(result.success).toBe(true);
  });
});

describe("driver.monthlySummary procedure", () => {
  it("driver.monthlySummary returns summary array with dispatch counts", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.driver.monthlySummary();
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.driverName).toBe("김민준");
    expect(result[0]?.totalDispatches).toBe(5);
    expect(result[0]?.completedDispatches).toBe(3);
    expect(result[0]?.totalAmount).toBe(150000);
  });
});

describe("settlement procedures", () => {
  it("settlement.monthlyReport returns report with cancelledDispatches field", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.settlement.monthlyReport({ year: 2026, month: 6 });
    expect(Array.isArray(result)).toBe(true);
    expect(result[0]?.driverName).toBe("김민준");
    // 취소 건수 필드가 존재해야 함
    expect((result[0] as any).cancelledDispatches).toBe(2);
    // 총 정산금액은 완료 건만 포함 (취소 건 제외)
    expect(result[0]?.totalAmount).toBe(150000);
    expect(result[0]?.completedDispatches).toBe(3);
  });

  it("settlement.driverDetail returns orders including cancelled ones", async () => {
    const caller = appRouter.createCaller(createCtx());
    const result = await caller.settlement.driverDetail({ driverId: 1, year: 2026, month: 6 });
    expect(Array.isArray(result)).toBe(true);
    // 취소된 배차도 드릴다운에 포함되어야 함
    const cancelledOrder = result.find((o) => o.approvalStatus === "cancelled");
    expect(cancelledOrder).toBeDefined();
    // 취소된 배차의 정산금액은 0
    expect(cancelledOrder?.totalAmount).toBe(0);
    // 완료된 배차는 정산금액이 있어야 함
    const completedOrder = result.find((o) => o.approvalStatus === "completed");
    expect(completedOrder?.totalAmount).toBe(50000);
  });
});
