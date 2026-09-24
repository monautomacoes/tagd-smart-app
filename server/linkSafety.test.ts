import { describe, expect, it } from "vitest";
import {
  buildGoogleReviewUrl,
  buildInstagramUrl,
  buildWhatsAppUrl,
  isSafePublicDestination,
  parseMultiLinkConfig,
  sanitizeUserInput,
  validatePublicDestination,
} from "./linkSafety";

describe("link safety and cybersecurity protections", () => {
  it("accepts HTTPS and rejects dangerous protocols or embedded credentials", () => {
    expect(validatePublicDestination("https://example.com/path")).toBe("https://example.com/path");
    expect(isSafePublicDestination("javascript:alert(1)")).toBe(false);
    expect(isSafePublicDestination("data:text/html,<script>alert(1)</script>")).toBe(false);
    expect(isSafePublicDestination("vbscript:msgbox(1)")).toBe(false);
    expect(isSafePublicDestination("file:///etc/passwd")).toBe(false);
    expect(isSafePublicDestination("https://user:password@example.com")).toBe(false);
  });

  it("blocks private network hosts and cloud metadata (SSRF defense)", () => {
    expect(() => validatePublicDestination("http://127.0.0.1:8080/secret", true)).toThrow(/bloqueado/i);
    expect(() => validatePublicDestination("http://localhost:3000/api", true)).toThrow(/bloqueado/i);
    expect(() => validatePublicDestination("http://169.254.169.254/latest/meta-data/", true)).toThrow(/bloqueado/i);
    expect(() => validatePublicDestination("http://192.168.1.1/admin", true)).toThrow(/bloqueado/i);
    expect(() => validatePublicDestination("http://10.0.0.1/internal", true)).toThrow(/bloqueado/i);
  });

  it("sanitizes text input against script tags and control characters", () => {
    const malicious = "<script>alert('pwned')</script>Nome da Loja\u0000\u0007";
    const cleaned = sanitizeUserInput(malicious, 100);
    expect(cleaned).not.toContain("<script>");
    expect(cleaned).not.toContain("\u0000");
    expect(cleaned).toContain("Nome da Loja");
  });

  it("builds safe WhatsApp redirect URLs", () => {
    const url = buildWhatsAppUrl("(11) 99999-8888", "Olá! Quero mais informações.");
    expect(url).toBe("https://wa.me/5511999998888?text=Ol%C3%A1!%20Quero%20mais%20informa%C3%A7%C3%B5es.");
  });

  it("builds safe Instagram URLs from handles or full links", () => {
    expect(buildInstagramUrl("@minhaloja")).toBe("https://www.instagram.com/minhaloja/");
    expect(buildInstagramUrl("https://instagram.com/minhaloja")).toBe("https://instagram.com/minhaloja");
  });

  it("builds and validates Google Review URLs", () => {
    expect(buildGoogleReviewUrl("https://g.page/r/CbXxYyZz/review")).toBe("https://g.page/r/CbXxYyZz/review");
  });

  it("drops invalid MultiLink items and bounds displayed text", () => {
    const config = parseMultiLinkConfig(
      JSON.stringify({
        title: "A".repeat(500),
        subtitle: "B".repeat(500),
        items: [
          { key: "safe", label: "Abrir", url: "https://example.com", enabled: true },
          { key: "bad", label: "Perigoso", url: "javascript:alert(1)", enabled: true },
        ],
      })
    );
    expect(config.title).toHaveLength(120);
    expect(config.subtitle).toHaveLength(240);
    expect(config.items).toHaveLength(1);
    expect(config.items[0]?.url).toBe("https://example.com/");
  });
});

