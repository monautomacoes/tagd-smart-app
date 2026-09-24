import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { findTagByCode, registerTagScan } from "../db";
import { isSafePublicDestination, parseMultiLinkConfig } from "../linkSafety";

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char] || char));
}

// Sistema de Rate Limiting em memória para proteção contra ataques de robôs / DoS
const requestCounts = new Map<string, { count: number; resetTime: number }>();

function createRateLimiter(maxRequests: number, windowMs: number, message = "Muitas requisições. Tente novamente em alguns instantes.") {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    const now = Date.now();
    const record = requestCounts.get(ip);

    if (!record || now > record.resetTime) {
      requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
      return next();
    }

    if (record.count >= maxRequests) {
      res.setHeader("Retry-After", Math.ceil((record.resetTime - now) / 1000));
      return res.status(429).json({ error: message });
    }

    record.count++;
    next();
  };
}

export function createApp(): express.Express {
  const app = express();
  app.disable("x-powered-by");

  // Headers de segurança HTTP avançados
  app.use((_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), nfc=(self)");
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; frame-ancestors 'none'; img-src 'self' https: data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' https: 'unsafe-inline'; connect-src 'self' https:;"
    );
    next();
  });

  // Limite estrito de payload JSON
  app.use(express.json({ limit: "100kb" }));
  app.use(express.urlencoded({ limit: "100kb", extended: true }));

  // Proteção contra ataques de robôs e varredura de endpoints
  const publicRedirectLimiter = createRateLimiter(60, 60000, "Limite de acessos excedido temporariamente.");
  const apiRateLimiter = createRateLimiter(120, 60000, "Muitas requisições para a API. Aguarde um minuto.");

  registerStorageProxy(app);
  registerOAuthRoutes(app);

  app.get("/modelo", (_req, res) => {
    res.status(200).send("<!doctype html><html lang=\"pt-BR\"><head><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta charset=\"utf-8\"><title>Modelo de QR dinâmico</title></head><body style=\"margin:0;min-height:100vh;background:#08111f;color:#fff;font-family:Arial,sans-serif;display:grid;place-items:center;padding:24px\"><main style=\"max-width:460px;text-align:center\"><div style=\"width:84px;height:84px;border-radius:24px;background:#06b6d4;margin:0 auto 20px\"></div><h1>Modelo de QR dinâmico</h1><p style=\"color:#a9b6c8;line-height:1.6\">Este endereço é um modelo visual. No uso real, cada cliente recebe um código único em /t/SEU-CODIGO e o destino pode ser alterado no painel sem regravar o QR.</p></main></body></html>");
  });

  app.get("/t/:code", publicRedirectLimiter, async (req, res) => {
    const code = req.params.code;
    if (!/^TD[A-Z0-9_-]{6,12}$/i.test(code)) return res.status(404).send("Tag não encontrada ou inativa");
    
    try {
      const tag = await findTagByCode(code.toUpperCase());
      if (!tag) return res.status(404).send("Tag não encontrada ou pausada");
      await registerTagScan(tag.id);

      if (tag.destinationType === "multilink") {
        const config = parseMultiLinkConfig(tag.multilinkConfig);
        const buttons = config.items.map(item => `<a class="link" href="${escapeHtml(item.url)}" rel="noopener noreferrer nofollow">${escapeHtml(item.label)}</a>`).join("");
        const logo = config.logoUrl ? `<img class="logo" src="${escapeHtml(config.logoUrl)}" alt="Logo de ${escapeHtml(config.title)}">` : `<div class="mark"></div>`;
        return res.status(200).send(`<!doctype html><html lang="pt-BR"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>${escapeHtml(config.title)}</title><style>body{margin:0;min-height:100vh;background:${escapeHtml(config.background)};color:#fff;font-family:Inter,Arial,sans-serif;display:grid;place-items:center;padding:24px}.wrap{width:min(100%,460px);text-align:center}.mark,.logo{width:84px;height:84px;border-radius:24px;background:${escapeHtml(config.accent)};margin:0 auto 18px;object-fit:cover}.link{display:block;margin:12px 0;padding:17px 20px;border-radius:16px;background:${escapeHtml(config.buttonColor)};color:${escapeHtml(config.buttonTextColor)};text-decoration:none;font-weight:700;box-shadow:0 10px 30px #0003;transition:transform 0.1s}.link:active{transform:scale(0.98)}.sub{color:#a9b6c8;margin-bottom:26px}</style></head><body><main class="wrap">${logo}<h1>${escapeHtml(config.title)}</h1><p class="sub">${escapeHtml(config.subtitle)}</p>${buttons || "<p class='sub'>Nenhum link ativo no momento.</p>"}</main></body></html>`);
      }

      if (!isSafePublicDestination(tag.destinationUrl)) return res.status(500).send("Destino da tag inválido ou bloqueado por segurança");
      return res.redirect(302, tag.destinationUrl);
    } catch (error) {
      console.error("[TagD] Redirect failed securely", error instanceof Error ? error.message : "Internal error");
      return res.status(500).send("Não foi possível abrir este link");
    }
  });

  const trpcHandler = createExpressMiddleware({
    router: appRouter,
    createContext,
  });

  app.use("/api/trpc", apiRateLimiter, trpcHandler);
  app.use("/trpc", apiRateLimiter, trpcHandler);

  return app;
}
