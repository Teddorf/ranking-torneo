import { NextResponse } from "next/server";
import crypto from "crypto";

const SECRET = process.env.AUTH_SECRET || "ranking-torneo-secret-key";

function verifyToken(token) {
  if (!token) return null;
  const [dataB64, sig] = token.split(".");
  if (!dataB64 || !sig) return null;
  try {
    const data = Buffer.from(dataB64, "base64").toString();
    const expected = crypto.createHmac("sha256", SECRET).update(data).digest("hex");
    if (sig !== expected) return null;
    const parsed = JSON.parse(data);
    if (parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function middleware(request) {
  const token = request.cookies.get("session")?.value;
  const user = verifyToken(token);

  // Solo proteger subrutas de /admin (ej: /admin/settings)
  // /admin en sí muestra el LoginForm si no hay sesión (client-side guard)
  const isAdminSubroute =
    request.nextUrl.pathname.startsWith("/admin/") &&
    request.nextUrl.pathname !== "/admin";

  if (isAdminSubroute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path+"],
  // :path+ requires 1+ segments — /admin itself is excluded (shows LoginForm)
  // Only /admin/* subroutes are protected server-side
};
