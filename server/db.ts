import { and, desc, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { businesses, InsertUser, offers, outreachMessages, tags, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;
let _pool: mysql.Pool | null = null;
let _tablesInitialized = false;

export function getPool() {
  if (!_pool && process.env.DATABASE_URL) {
    try {
      _pool = mysql.createPool(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to create pool:", error);
    }
  }
  return _pool;
}

export async function ensureTablesExist() {
  if (_tablesInitialized) return;
  const pool = getPool();
  if (!pool) return;

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`users\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`openId\` varchar(64) NOT NULL,
        \`name\` text,
        \`email\` varchar(320),
        \`loginMethod\` varchar(64),
        \`role\` enum('user','admin') NOT NULL DEFAULT 'user',
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`lastSignedIn\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(\`id\`),
        UNIQUE KEY \`users_openId_unique\` (\`openId\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`businesses\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`name\` varchar(180) NOT NULL,
        \`segment\` varchar(100),
        \`city\` varchar(120),
        \`contactName\` varchar(140),
        \`phone\` varchar(40),
        \`email\` varchar(320),
        \`notes\` text,
        \`stage\` enum('lead','contacted','demo','proposal','won','lost') NOT NULL DEFAULT 'lead',
        \`consentStatus\` enum('unknown','allowed','blocked') NOT NULL DEFAULT 'unknown',
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`offers\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`title\` varchar(180) NOT NULL,
        \`segment\` varchar(100),
        \`description\` text NOT NULL,
        \`cta\` varchar(140) NOT NULL DEFAULT 'Quero uma demonstração',
        \`validUntil\` timestamp NULL,
        \`active\` int NOT NULL DEFAULT 1,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`tags\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`businessId\` int NOT NULL,
        \`code\` varchar(32) NOT NULL,
        \`label\` varchar(140) NOT NULL,
        \`material\` varchar(80),
        \`placement\` varchar(100),
        \`destinationType\` enum('google','whatsapp','instagram','tiktok','multilink','webhook','custom') NOT NULL DEFAULT 'multilink',
        \`destinationUrl\` text NOT NULL,
        \`multilinkConfig\` text,
        \`whatsappMessage\` text,
        \`status\` enum('active','paused','draft') NOT NULL DEFAULT 'active',
        \`programmingStatus\` enum('not_programmed','programmed','protected') NOT NULL DEFAULT 'not_programmed',
        \`nfcModel\` varchar(60),
        \`protectionNote\` text,
        \`programmedAt\` timestamp NULL,
        \`protectedAt\` timestamp NULL,
        \`scans\` int NOT NULL DEFAULT 0,
        \`lastScannedAt\` timestamp NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updatedAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY(\`id\`),
        UNIQUE KEY \`tags_code_unique\` (\`code\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS \`outreachMessages\` (
        \`id\` int AUTO_INCREMENT NOT NULL,
        \`businessId\` int NOT NULL,
        \`offerId\` int,
        \`channel\` enum('whatsapp','email','instagram','manual') NOT NULL DEFAULT 'manual',
        \`subject\` varchar(180),
        \`body\` text NOT NULL,
        \`status\` enum('draft','queued','sent','replied','opted_out') NOT NULL DEFAULT 'draft',
        \`scheduledFor\` timestamp NULL,
        \`sentAt\` timestamp NULL,
        \`createdAt\` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(\`id\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    _tablesInitialized = true;
    console.log("[Database] Tables verified and created if missing");
  } catch (error) {
    console.warn("[Database] ensureTablesExist warning:", error);
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    const pool = getPool();
    if (pool) {
      _db = drizzle(pool);
      // Ensure tables exist in background
      ensureTablesExist().catch(console.warn);
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  try {
    const db = await getDb();
    if (!db) return;
    const values: InsertUser = {
      openId: user.openId,
      name: user.name ?? null,
      email: user.email ?? null,
      loginMethod: user.loginMethod ?? null,
      lastSignedIn: new Date()
    };
    const updateSet: Record<string, unknown> = {
      name: values.name,
      email: values.email,
      loginMethod: values.loginMethod,
      lastSignedIn: values.lastSignedIn
    };
    if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
      values.role = user.role ?? "admin";
      updateSet.role = values.role;
    }
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) {
    console.warn("[Database] upsertUser skipped:", error);
  }
}

export async function getUserByOpenId(openId: string) {
  try {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
    return result[0];
  } catch (error) {
    console.warn("[Database] getUserByOpenId error:", error);
    return undefined;
  }
}

export async function listDashboardData() {
  try {
    const db = await getDb();
    if (!db) return { businesses: [], tags: [], offers: [], messages: [] };

    // Run table initialization check if not done yet
    await ensureTablesExist();

    const [businessRows, tagRows, offerRows, messageRows] = await Promise.all([
      db.select().from(businesses).orderBy(desc(businesses.createdAt)).catch(() => []),
      db.select().from(tags).orderBy(desc(tags.createdAt)).catch(() => []),
      db.select().from(offers).orderBy(desc(offers.createdAt)).catch(() => []),
      db.select().from(outreachMessages).orderBy(desc(outreachMessages.createdAt)).limit(20).catch(() => []),
    ]);

    return { businesses: businessRows, tags: tagRows, offers: offerRows, messages: messageRows };
  } catch (error) {
    console.warn("[Database] listDashboardData fallback to empty data:", error);
    return { businesses: [], tags: [], offers: [], messages: [] };
  }
}

export async function findTagByCode(code: string) {
  try {
    const db = await getDb();
    if (!db) return undefined;
    const result = await db.select().from(tags).where(and(eq(tags.code, code), eq(tags.status, "active"))).limit(1);
    return result[0];
  } catch (error) {
    console.warn("[Database] findTagByCode error:", error);
    return undefined;
  }
}

export async function registerTagScan(id: number) {
  try {
    const db = await getDb();
    if (!db) return;
    await db.update(tags).set({ scans: sql`${tags.scans} + 1`, lastScannedAt: new Date() }).where(eq(tags.id, id));
  } catch (error) {
    console.warn("[Database] registerTagScan error:", error);
  }
}
