import { cookies } from "next/headers";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "ranking-torneo-secret-key";

export function createToken(payload) {
  const data = JSON.stringify({ ...payload, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 });
  const sig = crypto.createHmac("sha256", SECRET).update(data).digest("hex");
  return Buffer.from(data).toString("base64") + "." + sig;
}

export function verifyToken(token) {
  if (!token) return null;
  const [dataB64, sig] = token.split(".");
  if (!dataB64 || !sig) return null;
  const data = Buffer.from(dataB64, "base64").toString();
  const expected = crypto.createHmac("sha256", SECRET).update(data).digest("hex");
  if (sig !== expected) return null;
  const parsed = JSON.parse(data);
  if (parsed.exp < Date.now()) return null;
  return parsed;
}

export async function getUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get("session")?.value;
  return verifyToken(token);
}
