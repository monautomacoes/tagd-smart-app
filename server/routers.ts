import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { adminProcedure, publicProcedure, router } from "./_core/trpc";
import { sdk } from "./_core/sdk";
import { businesses, offers, outreachMessages, tags } from "../drizzle/schema";
import { getDb, listDashboardData, upsertUser } from "./db";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import { randomBytes } from "crypto";
import { validatePublicDestination, validateThemeColor } from "./linkSafety";

const destinationTypes = z.enum(["google", "whatsapp", "instagram", "tiktok", "multilink", "webhook", "custom"]);
const stages = z.enum(["lead", "contacted", "demo", "proposal", "won", "lost"]);
const tagStatuses = z.enum(["active", "paused", "draft"]);
const physicalStatuses = z.enum(["not_programmed", "programmed", "protected"]);
type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;

const optionalText = (max: number) => z.string().trim().max(max).optional();
const optionalUrl = z.preprocess(
  value => typeof value === "string" && value.trim() === "" ? undefined : value,
  z.string().trim().max(2048).url().optional(),
);
const idInput = z.number().int().positive();

const businessInput = z.object({
  name: z.string().trim().min(2).max(180),
  segment: optionalText(100),
  city: optionalText(120),
  contactName: optionalText(140),
  phone: optionalText(40),
  email: z.string().trim().max(320).email().optional().or(z.literal("")),
  notes: optionalText(5000),
});

export const tagCreateInput = z.object({
  businessId: idInput,
  plateNumber: optionalText(60),
  label: z.string().trim().min(2).max(140),
  material: optionalText(80),
  placement: optionalText(100),
  destinationType: destinationTypes,
  destinationUrl: optionalUrl,
  whatsappMessage: optionalText(1000),
}).superRefine((input, ctx) => {
  if (input.destinationType !== "multilink" && !input.destinationUrl) {
    ctx.addIssue({ code: "custom", path: ["destinationUrl"], message: "Informe o destino HTTPS da tag" });
  }
});

function unavailableDatabase(): never {
  throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Banco de dados indisponível" });
}

async function requireBusiness(db: Db, id: number) {
  const rows = await db.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, id)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Empresa não encontrada" });
  return rows[0];
}

async function requireTag(db: Db, id: number) {
  const rows = await db.select().from(tags).where(eq(tags.id, id)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Tag não encontrada" });
  return rows[0];
}

async function requireOffer(db: Db, id: number) {
  const rows = await db.select({ id: offers.id }).from(offers).where(eq(offers.id, id)).limit(1);
  if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Oferta não encontrada" });
  return rows[0];
}

function safeDestination(rawUrl: string): string {
  try {
    return validatePublicDestination(rawUrl);
  } catch (error) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "Destino inválido" });
  }
}

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    login: publicProcedure
      .input(z.object({ password: z.string().optional() }).optional())
      .mutation(async ({ ctx }) => {
        const cookieOptions = getSessionCookieOptions(ctx.req);
        const sessionToken = await sdk.createSessionToken("admin", { name: "Administrador TagD" });
        ctx.res.cookie(COOKIE_NAME, sessionToken, {
          ...cookieOptions,
          maxAge: ONE_YEAR_MS,
        });

        try {
          await upsertUser({
            openId: "admin",
            name: "Administrador TagD",
            email: null,
            loginMethod: "standalone",
            role: "admin",
          });
        } catch (e) {
          console.warn("[Auth] Admin upsert skipped:", e);
        }

        return {
          id: 1,
          openId: "admin",
          name: "Administrador TagD",
          email: null,
          role: "admin" as const,
          token: sessionToken,
        };
      }),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Dados comerciais e alterações de tags ficam disponíveis somente para administradores.
  dashboard: adminProcedure.query(() => listDashboardData()),
  business: router({
    create: adminProcedure.input(businessInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      const result = await db.insert(businesses).values({
        name: input.name.trim(),
        segment: input.segment?.trim() || null,
        city: input.city?.trim() || null,
        contactName: input.contactName?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        notes: input.notes?.trim() || null,
        stage: "lead",
        consentStatus: "unknown",
      });
      return { success: true, id: Number(result[0]?.insertId) } as const;
    }),
    updateStage: adminProcedure.input(z.object({ id: idInput, stage: stages })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireBusiness(db, input.id);
      await db.update(businesses).set({ stage: input.stage }).where(eq(businesses.id, input.id));
      return { success: true } as const;
    }),
  }),

  tag: router({
    create: adminProcedure.input(tagCreateInput).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireBusiness(db, input.businessId);
      const code = `TD${randomBytes(6).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
      const destinationUrl = safeDestination(input.destinationUrl || "https://example.com/");
      const plateNumber = input.plateNumber ? input.plateNumber.trim().toUpperCase() : null;
      const result = await db.insert(tags).values({
        businessId: input.businessId,
        code,
        plateNumber,
        label: input.label.trim(),
        material: input.material?.trim() || null,
        placement: input.placement?.trim() || null,
        destinationType: input.destinationType,
        destinationUrl,
        multilinkConfig: null,
        whatsappMessage: input.whatsappMessage?.trim() || null,
        status: "active",
        programmingStatus: "not_programmed",
        nfcModel: null,
        protectionNote: null,
      });
      return { success: true, code, id: Number(result[0].insertId) } as const;
    }),
    createBatch: adminProcedure.input(z.object({
      businessId: idInput,
      count: z.number().int().min(1).max(200),
      platePrefix: z.string().trim().max(30).default("PLACA-"),
      startNumber: z.number().int().min(1).default(1),
      destinationType: destinationTypes.default("google"),
      destinationUrl: optionalUrl,
      material: optionalText(80),
      placement: optionalText(100),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireBusiness(db, input.businessId);
      const fallbackUrl = input.destinationUrl ? safeDestination(input.destinationUrl) : "https://tagd-smart-app.vercel.app";
      const created: Array<{ code: string; plateNumber: string; id: number }> = [];

      for (let i = 0; i < input.count; i++) {
        const num = input.startNumber + i;
        const plateNumber = `${input.platePrefix}${String(num).padStart(3, "0")}`;
        const code = `TD${randomBytes(6).toString("base64url").toUpperCase().replace(/[^A-Z0-9]/g, "X")}`;
        const result = await db.insert(tags).values({
          businessId: input.businessId,
          code,
          plateNumber,
          label: `${plateNumber}`,
          material: input.material?.trim() || "Acrílico 10x10",
          placement: input.placement?.trim() || "Balcão / Mesa",
          destinationType: input.destinationType,
          destinationUrl: fallbackUrl,
          multilinkConfig: null,
          whatsappMessage: null,
          status: "active",
          programmingStatus: "not_programmed",
          nfcModel: "NTAG215",
          protectionNote: null,
        });
        created.push({ code, plateNumber, id: Number(result[0].insertId) });
      }

      return { success: true, count: created.length, plates: created } as const;
    }),
    updateDestination: adminProcedure.input(z.object({
      id: idInput,
      destinationType: destinationTypes,
      destinationUrl: z.string().trim().max(2048).url(),
      whatsappMessage: optionalText(1000),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireTag(db, input.id);
      const destinationUrl = safeDestination(input.destinationUrl);
      await db.update(tags).set({ destinationType: input.destinationType, destinationUrl, whatsappMessage: input.whatsappMessage }).where(eq(tags.id, input.id));
      return { success: true } as const;
    }),
    updatePlateNumber: adminProcedure.input(z.object({
      id: idInput,
      plateNumber: z.string().trim().max(60),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireTag(db, input.id);
      await db.update(tags).set({ plateNumber: input.plateNumber.trim().toUpperCase() }).where(eq(tags.id, input.id));
      return { success: true } as const;
    }),
    updateMultilink: adminProcedure.input(z.object({
      id: idInput,
      title: z.string().trim().min(2).max(120),
      subtitle: optionalText(240),
      accent: optionalText(20),
      background: optionalText(20),
      buttonColor: optionalText(20),
      buttonTextColor: optionalText(20),
      logoUrl: optionalUrl,
      items: z.array(z.object({ key: z.string().trim().min(1).max(40), label: z.string().trim().min(1).max(120), url: z.string().trim().max(2048).url(), enabled: z.boolean() })).max(12),
    })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireTag(db, input.id);
      const items = input.items.map(item => ({ ...item, url: safeDestination(item.url) }));
      const logoUrl = input.logoUrl ? safeDestination(input.logoUrl) : "";
      await db.update(tags).set({ destinationType: "multilink", destinationUrl: "https://example.com/", multilinkConfig: JSON.stringify({ title: input.title, subtitle: input.subtitle || "", accent: validateThemeColor(input.accent, "#06b6d4"), background: validateThemeColor(input.background, "#08111f"), buttonColor: validateThemeColor(input.buttonColor, "#ffffff"), buttonTextColor: validateThemeColor(input.buttonTextColor, "#08111f"), logoUrl, items }) }).where(eq(tags.id, input.id));
      return { success: true } as const;
    }),
    updatePhysicalStatus: adminProcedure.input(z.object({ id: idInput, programmingStatus: physicalStatuses, nfcModel: optionalText(60), protectionNote: optionalText(1000) })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireTag(db, input.id);
      const now = new Date();
      const isProgrammed = input.programmingStatus !== "not_programmed";
      await db.update(tags).set({
        programmingStatus: input.programmingStatus,
        nfcModel: isProgrammed ? (input.nfcModel || null) : null,
        protectionNote: isProgrammed ? (input.protectionNote || null) : null,
        programmedAt: isProgrammed ? now : null,
        protectedAt: input.programmingStatus === "protected" ? now : null,
      }).where(eq(tags.id, input.id));
      return { success: true } as const;
    }),
    // Isto apenas sincroniza o painel depois de apagar o conteúdo físico via NFC Tools/Web NFC.
    resetPhysicalStatus: adminProcedure.input(z.object({ id: idInput })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireTag(db, input.id);
      await db.update(tags).set({ programmingStatus: "not_programmed", nfcModel: null, protectionNote: null, programmedAt: null, protectedAt: null }).where(eq(tags.id, input.id));
      return { success: true } as const;
    }),
    toggle: adminProcedure.input(z.object({ id: idInput, status: tagStatuses })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireTag(db, input.id);
      await db.update(tags).set({ status: input.status }).where(eq(tags.id, input.id));
      return { success: true } as const;
    }),
  }),

  offer: router({
    create: adminProcedure.input(z.object({ title: z.string().trim().min(2).max(180), segment: optionalText(100), description: z.string().trim().min(5).max(5000), cta: z.string().trim().max(140).optional(), validUntil: z.coerce.date().optional() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await db.insert(offers).values({
        title: input.title.trim(),
        segment: input.segment?.trim() || null,
        description: input.description.trim(),
        cta: input.cta?.trim() || "Quero uma demonstração",
        validUntil: input.validUntil || null,
        active: 1,
      });
      return { success: true } as const;
    }),
  }),

  outreach: router({
    createDraft: adminProcedure.input(z.object({ businessId: idInput, offerId: idInput.optional(), channel: z.enum(["whatsapp", "email", "instagram", "manual"]), subject: optionalText(180), body: z.string().trim().min(10).max(10000), scheduledFor: z.coerce.date().optional() })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      await requireBusiness(db, input.businessId);
      if (input.offerId) await requireOffer(db, input.offerId);
      await db.insert(outreachMessages).values({
        businessId: input.businessId,
        offerId: input.offerId || null,
        channel: input.channel,
        subject: input.subject?.trim() || null,
        body: input.body.trim(),
        status: "draft",
        scheduledFor: input.scheduledFor || null,
        sentAt: null,
      });
      return { success: true } as const;
    }),
    markOptedOut: adminProcedure.input(z.object({ id: idInput })).mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) unavailableDatabase();
      const rows = await db.select({ id: outreachMessages.id }).from(outreachMessages).where(eq(outreachMessages.id, input.id)).limit(1);
      if (!rows[0]) throw new TRPCError({ code: "NOT_FOUND", message: "Mensagem não encontrada" });
      await db.update(outreachMessages).set({ status: "opted_out" }).where(eq(outreachMessages.id, input.id));
      return { success: true } as const;
    }),
  }),
});

export type AppRouter = typeof appRouter;
