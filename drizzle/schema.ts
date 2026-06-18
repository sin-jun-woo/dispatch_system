import {
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  tinyint,
  varchar,
} from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// 기사 테이블
export const drivers = mysqlTable("drivers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  vehicleNumber: varchar("vehicleNumber", { length: 20 }),
  vehicleType: varchar("vehicleType", { length: 50 }),
  affiliation: varchar("affiliation", { length: 100 }),
  status: mysqlEnum("status", ["idle", "driving", "repair"])
    .default("idle")
    .notNull(),
  vehiclePhotoUrl: varchar("vehiclePhotoUrl", { length: 1024 }), // 차량 전면 사진 URL
  vehiclePhotoKey: varchar("vehiclePhotoKey", { length: 512 }), // S3 key
  pinHash: varchar("pinHash", { length: 255 }), // bcrypt 해시된 PIN (로그인용)
  bankName: varchar("bankName", { length: 50 }),        // 은행명
  accountNumber: varchar("accountNumber", { length: 30 }), // 계좌번호
  accountHolder: varchar("accountHolder", { length: 50 }), // 예금주
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Driver = typeof drivers.$inferSelect;
export type InsertDriver = typeof drivers.$inferInsert;

// 강제배차 주문 테이블
export const dispatchOrders = mysqlTable("dispatch_orders", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),
  pickupLocation: text("pickupLocation").notNull(),
  dropoffLocation: text("dropoffLocation").notNull(),
  approvalStatus: mysqlEnum("approvalStatus", ["pending", "confirmed", "completed", "cancelled"])
    .default("pending")
    .notNull(),
  dispatchType: mysqlEnum("dispatchType", ["forced", "normal"])
    .default("forced")
    .notNull(),
  memo: text("memo"),
  unitPrice: int("unitPrice"),           // 회차 단가 (원)
  tripCount: int("tripCount"),           // 회차 수
  totalAmount: int("totalAmount"),       // 정산 금액 (unitPrice × tripCount)
  arrivalDeadline: timestamp("arrivalDeadline"),  // 도착 기한
  confirmedAt: timestamp("confirmedAt"),
  completedAt: timestamp("completedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type DispatchOrder = typeof dispatchOrders.$inferSelect;
export type InsertDispatchOrder = typeof dispatchOrders.$inferInsert;

// 작업일지 테이블 (배차 1건당 1개)
export const workLogs = mysqlTable("work_logs", {
  id: int("id").autoincrement().primaryKey(),
  dispatchOrderId: int("dispatchOrderId").notNull(), // dispatch_orders.id
  driverId: int("driverId").notNull(),               // drivers.id
  memo: text("memo"),                                // 작업 메모
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WorkLog = typeof workLogs.$inferSelect;
export type InsertWorkLog = typeof workLogs.$inferInsert;

// 작업일지 사진 테이블 (작업일지당 N장)
export const workLogPhotos = mysqlTable("work_log_photos", {
  id: int("id").autoincrement().primaryKey(),
  workLogId: int("workLogId").notNull(),             // work_logs.id
  storageKey: varchar("storageKey", { length: 512 }).notNull(), // S3 key
  storageUrl: varchar("storageUrl", { length: 1024 }).notNull(), // 접근 URL
  originalName: varchar("originalName", { length: 255 }),       // 원본 파일명
  mimeType: varchar("mimeType", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type WorkLogPhoto = typeof workLogPhotos.$inferSelect;
export type InsertWorkLogPhoto = typeof workLogPhotos.$inferInsert;

// 정산 지급 내역 테이블 (관리자가 기사에게 지급한 내역)
export const driverPayments = mysqlTable("driver_payments", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),              // drivers.id
  companyName: varchar("companyName", { length: 100 }).notNull(), // 지급 업체명
  amount: int("amount").notNull(),                  // 지급 금액 (원)
  paidAt: timestamp("paidAt").notNull(),            // 지급일
  memo: text("memo"),                              // 메모
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DriverPayment = typeof driverPayments.$inferSelect;
export type InsertDriverPayment = typeof driverPayments.$inferInsert;

// 문자 템플릿 테이블
export const smsTemplates = mysqlTable("sms_templates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 100 }).notNull(),  // 템플릿 제목
  content: text("content").notNull(),                  // 템플릿 내용
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SmsTemplate = typeof smsTemplates.$inferSelect;
export type InsertSmsTemplate = typeof smsTemplates.$inferInsert;

// 앱 설정 테이블 (관리자 비밀번호 등 시스템 설정)
export const appSettings = mysqlTable("app_settings", {
  key: varchar("key", { length: 100 }).primaryKey(),  // 설정 키
  value: text("value").notNull(),                     // 설정 값
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AppSetting = typeof appSettings.$inferSelect;
export type InsertAppSetting = typeof appSettings.$inferInsert;

// 기사 알림 메시지 테이블 (관리자 → 기사 알림)
export const driverNotifications = mysqlTable("driver_notifications", {
  id: int("id").autoincrement().primaryKey(),
  driverId: int("driverId").notNull(),           // 수신 기사 ID
  title: varchar("title", { length: 200 }).notNull(), // 알림 제목
  message: text("message").notNull(),            // 알림 내용
  isRead: tinyint("isRead").default(0).notNull(), // 읽음 여부 (0=미읽, 1=읽음)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DriverNotification = typeof driverNotifications.$inferSelect;
export type InsertDriverNotification = typeof driverNotifications.$inferInsert;
