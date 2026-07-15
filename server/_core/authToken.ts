import { jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";
import { eq } from "drizzle-orm";
import { users } from "../../drizzle/schema";
import { getDb } from "../db";
export function jwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32)
    throw new Error("JWT_SECRET deve possuir ao menos 32 caracteres");
  return new TextEncoder().encode(secret);
}
export async function authenticatedRequest(
  req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token)
      return res.status(401).json({ error: "Autenticação obrigatória" });
    const { payload } = await jwtVerify(token, jwtSecret());
    const db = await getDb();
    if (!db || !payload.userId)
      return res.status(401).json({ error: "Sessão inválida" });
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(payload.userId)))
      .limit(1);
    if (!user) return res.status(401).json({ error: "Sessão inválida" });
    res.locals.user = user;
    next();
  } catch {
    return res.status(401).json({ error: "Sessão inválida ou expirada" });
  }
}
