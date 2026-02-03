import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { Request, Response, NextFunction } from "express";
import type { Role } from "./types.js";
import { getDb } from "./db.js";

const jwtSecret = process.env.JWT_SECRET || "dev-secret-change";

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  tenantId: string | null;
};

export const hashPassword = async (password: string) => bcrypt.hash(password, 10);
export const verifyPassword = async (password: string, hash: string) => bcrypt.compare(password, hash);

export const signToken = (user: AuthUser) =>
  jwt.sign(user, jwtSecret, { expiresIn: "12h" });

export const authRequired = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing authorization header" });
    return;
  }

  try {
    const token = header.slice(7);
    const payload = jwt.verify(token, jwtSecret) as AuthUser;
    (req as Request & { user: AuthUser }).user = payload;
    
    // Update user activity
    const db = getDb();
    const now = new Date().toISOString();
    
    // Ensure table exists
    await db.run(`
      CREATE TABLE IF NOT EXISTS user_activity (
        user_id TEXT PRIMARY KEY,
        last_seen TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    
    await db.run(
      `INSERT OR REPLACE INTO user_activity (user_id, last_seen) VALUES (?, ?)`,
      payload.id,
      now
    );
    
    console.log('Updated activity for user:', payload.id, 'at', now);
    
    next();
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: "Invalid token" });
  }
};
