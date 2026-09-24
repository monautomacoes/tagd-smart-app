import { describe, expect, it } from "vitest";
import { tagCreateInput } from "./routers";

describe("tag creation validation and cybersecurity bounds", () => {
  it("accepts an empty final destination for MultiLink", () => {
    const result = tagCreateInput.safeParse({
      businessId: 1,
      plateNumber: "PLACA-001",
      label: "Placa Balcão",
      destinationType: "multilink",
      destinationUrl: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts WhatsApp destination with phone and custom message", () => {
    const result = tagCreateInput.safeParse({
      businessId: 1,
      plateNumber: "PLACA-002",
      label: "Placa Mesa 01",
      destinationType: "whatsapp",
      destinationUrl: "https://wa.me/5511999998888?text=Ola",
      whatsappMessage: "Olá! Gostaria do cardápio.",
    });
    expect(result.success).toBe(true);
  });

  it("still requires a valid URL for direct destinations", () => {
    const result = tagCreateInput.safeParse({
      businessId: 1,
      label: "Tag teste",
      destinationType: "instagram",
      destinationUrl: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid non-URL destinations for direct types", () => {
    const result = tagCreateInput.safeParse({
      businessId: 1,
      label: "Tag teste",
      destinationType: "google",
      destinationUrl: "not-a-valid-url",
    });
    expect(result.success).toBe(false);
  });

  it("rejects oversized label strings to prevent buffer/memory exhaustion", () => {
    const result = tagCreateInput.safeParse({
      businessId: 1,
      label: "A".repeat(500),
      destinationType: "multilink",
      destinationUrl: "",
    });
    expect(result.success).toBe(false);
  });
});

