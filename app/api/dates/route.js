import { NextResponse } from "next/server";
import { sql } from "../../../lib/db";
import { getUser } from "../../../lib/auth";

export async function GET() {
  try {
    const dates = await sql`SELECT * FROM dates ORDER BY sort_order`;
    return NextResponse.json(dates);
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  try {
    const body = await request.json();
    const label = (body.label || "").trim();
    if (!label) return NextResponse.json({ error: "El label es requerido" }, { status: 400 });
    const sort_order = Number(body.sort_order) || 0;
    const rows = await sql`INSERT INTO dates (label, sort_order) VALUES (${label}, ${sort_order}) RETURNING *`;
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
    const { id, label, sort_order } = body;
    if (!id) return NextResponse.json({ error: "El id es requerido" }, { status: 400 });

    if (label !== undefined && sort_order !== undefined) {
      const trimmed = (label || "").trim();
      if (!trimmed) return NextResponse.json({ error: "El label no puede estar vacío" }, { status: 400 });
      const rows = await sql`UPDATE dates SET label=${trimmed}, sort_order=${Number(sort_order)} WHERE id=${id} RETURNING *`;
      return NextResponse.json(rows[0]);
    } else if (label !== undefined) {
      const trimmed = (label || "").trim();
      if (!trimmed) return NextResponse.json({ error: "El label no puede estar vacío" }, { status: 400 });
      const rows = await sql`UPDATE dates SET label=${trimmed} WHERE id=${id} RETURNING *`;
      return NextResponse.json(rows[0]);
    } else if (sort_order !== undefined) {
      const rows = await sql`UPDATE dates SET sort_order=${Number(sort_order)} WHERE id=${id} RETURNING *`;
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
    await sql`DELETE FROM dates WHERE id=${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
