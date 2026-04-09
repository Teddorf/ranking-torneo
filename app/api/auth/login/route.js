import { NextResponse } from "next/server";
import crypto from "crypto";
import { sql } from "../../../../lib/db";
import { createToken } from "../../../../lib/auth";

export async function POST(request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }

    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

    const rows = await sql`
      SELECT id, email FROM admins
      WHERE email=${email.toLowerCase().trim()} AND password_hash=${passwordHash}
    `;

    if (!rows.length) {
      return NextResponse.json({ error: "Credenciales inválidas" }, { status: 401 });
    }

    const admin = rows[0];
    const token = createToken({ id: admin.id, email: admin.email });

    const response = NextResponse.json({ ok: true, email: admin.email });
    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60, // 7 días en segundos
    });

    return response;
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
