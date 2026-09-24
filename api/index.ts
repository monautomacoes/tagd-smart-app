import { createApp } from "../server/_core/app";

let appInstance: ReturnType<typeof createApp> | null = null;

function getApp() {
  if (!appInstance) {
    appInstance = createApp();
  }
  return appInstance;
}

export default function handler(req: any, res: any) {
  try {
    const app = getApp();
    return app(req, res);
  } catch (error: any) {
    console.error("[Vercel Serverless Error]", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: error?.message || "Unknown error",
    });
  }
}
