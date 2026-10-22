import jwt from "jsonwebtoken";
import { User } from "./models.js";

export async function protect(req, res, next) {
  const token = req.headers.authorization?.startsWith("Bearer ")
    ? req.headers.authorization.slice(7) : null;
  if (!token) return res.status(401).json({ message: "Please log in first." });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "development-only-secret");
    req.user = await User.findById(decoded.id).select("-passwordHash");
    if (!req.user) return res.status(401).json({ message: "Account not found." });
    next();
  } catch {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}
export const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user?.role) ? next() : res.status(403).json({ message: "You do not have permission for this action." });
