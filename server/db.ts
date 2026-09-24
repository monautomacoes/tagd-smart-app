import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { businesses, InsertUser, offers, outreachMessages, tags, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      const pool = mysql.createPool(process.env.DATABASE_URL);
      _db = drizzle(pool);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId, name: user.name ?? null, email: user.email ?? null, loginMethod: user.loginMethod ?? null, lastSignedIn: new Date() };
  const updateSet: Record<string, unknown> = { name: values.name, email: values.email, loginMethod: values.loginMethod, lastSignedIn: values.lastSignedIn };
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) { values.role = user.role ?? "admin"; updateSet.role = values.role; }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listDashboardData() {
  const db = await getDb();
  if (!db) return { businesses: [], tags: [], offers: [], messages: [] };
  const [businessRows, tagRows, offerRows, messageRows] = await Promise.all([
    db.select().from(businesses).orderBy(desc(businesses.createdAt)),
    db.select().from(tags).orderBy(desc(tags.createdAt)),
    db.select().from(offers).orderBy(desc(offers.createdAt)),
    db.select().from(outreachMessages).orderBy(desc(outreachMessages.createdAt)).limit(20),
  ]);
  return { businesses: businessRows, tags: tagRows, offers: offerRows, messages: messageRows };
}

export async function findTagByCode(code: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tags).where(and(eq(tags.code, code), eq(tags.status, "active"))).limit(1);
  return result[0];
}

export async function registerTagScan(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(tags).set({ scans: sql`${tags.scans} + 1`, lastScannedAt: new Date() }).where(eq(tags.id, id));
}
