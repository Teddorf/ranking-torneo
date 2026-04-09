import { NextResponse } from "next/server";
import { sql } from "../../../lib/db";
import { getUser } from "../../../lib/auth";

export async function GET() {
  try {
    const scores = await sql`SELECT * FROM scores`;
    return NextResponse.json(scores);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const { player_id, date_id, type, value } = body;

    if (!player_id) return NextResponse.json({ error: "player_id es requerido" }, { status: 400 });
    if (!date_id) return NextResponse.json({ error: "date_id es requerido" }, { status: 400 });
    if (!type || !["points", "bye"].includes(type)) {
      return NextResponse.json({ error: "type debe ser 'points' o 'bye'" }, { status: 400 });
    }
    if (type === "points" && (value === undefined || value === null || isNaN(Number(value)))) {
      return NextResponse.json({ error: "value debe ser numérico para type=points" }, { status: 400 });
    }

    const numericValue = type === "points" ? Number(value) : 0;
    const updatedAt = new Date().toISOString();

    const rows = await sql`
      INSERT INTO scores (player_id, date_id, type, value, updated_at)
      VALUES (${player_id}, ${date_id}, ${type}, ${numericValue}, ${updatedAt})
      ON CONFLICT (player_id, date_id)
      DO UPDATE SET type=${type}, value=${numericValue}, updated_at=${updatedAt}
      RETURNING *
    `;
    return NextResponse.json(rows[0]);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const { player_id, date_id } = body;
    if (!player_id) return NextResponse.json({ error: "player_id es requerido" }, { status: 400 });
    if (!date_id) return NextResponse.json({ error: "date_id es requerido" }, { status: 400 });
    await sql`DELETE FROM scores WHERE player_id=${player_id} AND date_id=${date_id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
