import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

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

export const businesses = mysqlTable("businesses", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 180 }).notNull(),
  segment: varchar("segment", { length: 100 }),
  city: varchar("city", { length: 120 }),
  contactName: varchar("contactName", { length: 140 }),
  phone: varchar("phone", { length: 40 }),
  email: varchar("email", { length: 320 }),
  notes: text("notes"),
  stage: mysqlEnum("stage", ["lead", "contacted", "demo", "proposal", "won", "lost"]).default("lead").notNull(),
  consentStatus: mysqlEnum("consentStatus", ["unknown", "allowed", "blocked"]).default("unknown").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const tags = mysqlTable("tags", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull().references(() => businesses.id, { onDelete: "cascade", onUpdate: "cascade" }),
  code: varchar("code", { length: 32 }).notNull().unique(),
  plateNumber: varchar("plateNumber", { length: 60 }),
  label: varchar("label", { length: 140 }).notNull(),
  material: varchar("material", { length: 80 }),
  placement: varchar("placement", { length: 100 }),
  destinationType: mysqlEnum("destinationType", ["google", "whatsapp", "instagram", "tiktok", "multilink", "webhook", "custom"]).default("multilink").notNull(),
  destinationUrl: text("destinationUrl").notNull(),
  multilinkConfig: text("multilinkConfig"),
  whatsappMessage: text("whatsappMessage"),
  status: mysqlEnum("status", ["active", "paused", "draft"]).default("active").notNull(),
  programmingStatus: mysqlEnum("programmingStatus", ["not_programmed", "programmed", "protected"]).default("not_programmed").notNull(),
  nfcModel: varchar("nfcModel", { length: 60 }),
  protectionNote: text("protectionNote"),
  programmedAt: timestamp("programmedAt"),
  protectedAt: timestamp("protectedAt"),
  scans: int("scans").default(0).notNull(),
  lastScannedAt: timestamp("lastScannedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const offers = mysqlTable("offers", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  segment: varchar("segment", { length: 100 }),
  description: text("description").notNull(),
  cta: varchar("cta", { length: 140 }).default("Quero uma demonstração").notNull(),
  validUntil: timestamp("validUntil"),
  active: int("active").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const outreachMessages = mysqlTable("outreachMessages", {
  id: int("id").autoincrement().primaryKey(),
  businessId: int("businessId").notNull().references(() => businesses.id, { onDelete: "cascade", onUpdate: "cascade" }),
  offerId: int("offerId").references(() => offers.id, { onDelete: "set null", onUpdate: "cascade" }),
  channel: mysqlEnum("channel", ["whatsapp", "email", "instagram", "manual"]).default("manual").notNull(),
  subject: varchar("subject", { length: 180 }),
  body: text("body").notNull(),
  status: mysqlEnum("status", ["draft", "queued", "sent", "replied", "opted_out"]).default("draft").notNull(),
  scheduledFor: timestamp("scheduledFor"),
  sentAt: timestamp("sentAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Business = typeof businesses.$inferSelect;
export type Tag = typeof tags.$inferSelect;
export type Offer = typeof offers.$inferSelect;
export type OutreachMessage = typeof outreachMessages.$inferSelect;
