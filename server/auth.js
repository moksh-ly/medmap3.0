import jwt from "jsonwebtoken";
import { User } from "./models.js";

/**
 * Authentication middleware: verifies Bearer JWT token and retrieves
 * the authenticated user from MongoDB.
 */
export async function protect(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : null;

  if (!token) {
    return res.status(401).json({ message: "Please log in first." });
  }

  try {
    const secret = process.env.JWT_SECRET || "development-only-secret";
    const decoded = jwt.verify(token, secret);
    req.user = await User.findById(decoded.id).select("-passwordHash");

    if (!req.user) {
      return res.status(401).json({ message: "Account not found." });
    }

    next();
  } catch (err) {
    return res.status(401).json({ message: "Session expired. Please log in again." });
  }
}

/**
 * Role-based authorization middleware.
 */
export const allow = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ message: "You don't have permission for this action." });
  }
  next();
};
