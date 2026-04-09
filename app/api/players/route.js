import { NextResponse } from "next/server";
import { sql } from "../../../lib/db";
import { getUser } from "../../../lib/auth";

export async function GET() {
  try {
    const players = await sql`SELECT * FROM players ORDER BY sort_order`;
    return NextResponse.json(players);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const name = (body.name || "").trim();
    if (!name) return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
    const sort_order = Number(body.sort_order) || 0;
    const rows = await sql`INSERT INTO players (name, sort_order) VALUES (${name}, ${sort_order}) RETURNING *`;
    return NextResponse.json(rows[0], { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const { id, name, sort_order } = body;
    if (!id) return NextResponse.json({ error: "El id es requerido" }, { status: 400 });

    if (name !== undefined && sort_order !== undefined) {
      const trimmed = (name || "").trim();
      if (!trimmed) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
      const rows = await sql`UPDATE players SET name=${trimmed}, sort_order=${Number(sort_order)} WHERE id=${id} RETURNING *`;
      return NextResponse.json(rows[0]);
    } else if (name !== undefined) {
      const trimmed = (name || "").trim();
      if (!trimmed) return NextResponse.json({ error: "El nombre no puede estar vacío" }, { status: 400 });
      const rows = await sql`UPDATE players SET name=${trimmed} WHERE id=${id} RETURNING *`;
      return NextResponse.json(rows[0]);
    } else if (sort_order !== undefined) {
      const rows = await sql`UPDATE players SET sort_order=${Number(sort_order)} WHERE id=${id} RETURNING *`;
      return NextResponse.json(rows[0]);
    }
    return NextResponse.json({ error: "Nada que actualizar" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const { id } = body;
    if (!id) return NextResponse.json({ error: "El id es requerido" }, { status: 400 });
    await sql`DELETE FROM players WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
