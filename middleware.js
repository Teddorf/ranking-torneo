import { NextResponse } from "next/server";

const SECRET = process.env.AUTH_SECRET || "ranking-torneo-secret-key";

async function verifyToken(token) {
  if (!token) return null;
  const [dataB64, sig] = token.split(".");
  if (!dataB64 || !sig) return null;
  try {
    const data = atob(dataB64);
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(SECRET),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    const expected = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
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
  const user = await verifyToken(token);

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
};
