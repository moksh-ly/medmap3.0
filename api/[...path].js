import app, { ensureDatabase } from "../server/index.js";

export default async function handler(req, res) {
  try {
    await ensureDatabase();
    if (req.url && !req.url.startsWith("/api")) {
      req.url = `/api${req.url.startsWith("/") ? "" : "/"}${req.url}`;
    }
    return app(req, res);
  } catch (error) {
    console.error("MedMap API initialization failed:", error);
    return res.status(503).json({
      message: "MedMap API could not connect to its database. Check MONGODB_URI and MongoDB Atlas network access.",
      detail: process.env.NODE_ENV === "development" ? error.message : undefined
    });
  }
}
