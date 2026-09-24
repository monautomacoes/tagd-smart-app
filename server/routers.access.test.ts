import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function contextFor(role: "user" | "admin" | null): TrpcContext {
  return {
    user: role ? {
      id: role === "admin" ? 1 : 2,
      openId: `${role}-test`,
      email: `${role}@example.com`,
      name: role === "admin" ? "Admin" : "User",
      loginMethod: "test",
      role,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    } : null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: () => undefined } as TrpcContext["res"],
  };
}

describe("admin authorization", () => {
  it("rejects unauthenticated dashboard access", async () => {
    const caller = appRouter.createCaller(contextFor(null));
    await expect(caller.dashboard()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("rejects regular users from dashboard access", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.dashboard()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("rejects regular users before any tag reset database operation", async () => {
    const caller = appRouter.createCaller(contextFor("user"));
    await expect(caller.tag.resetPhysicalStatus({ id: 1 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
