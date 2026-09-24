export default async function handler(req: any, res: any) {
  // Simple ping endpoint that does not require any imports
  if (req.url?.includes("/health") || req.url?.includes("/ping")) {
    return res.status(200).json({ status: "ok", timestamp: Date.now() });
  }

  try {
    const { createApp } = await import("../server/_core/app");
    const app = createApp();
    return app(req, res);
  } catch (error: any) {
    console.error("[Vercel Serverless Error]", error);
    return res.status(500).json({
      error: "Internal Server Error",
      message: error?.message || String(error),
      stack: error?.stack || null,
    });
  }
}
