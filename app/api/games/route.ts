import { and, desc, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "../../../db";
import { games } from "../../../db/schema";

async function userId() {
  return (await headers()).get("oai-authenticated-user-id") ?? "local-owner";
}

function clean(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim().slice(0, 500) : fallback;
}

function values(payload: Record<string, unknown>) {
  return {
    title: clean(payload.title).slice(0, 120),
    platform: clean(payload.platform, "Otra").slice(0, 40),
    format: clean(payload.format, "Digital").slice(0, 20),
    status: clean(payload.status, "Backlog").slice(0, 24),
    progress: Math.round(Math.max(0, Math.min(100, Number(payload.progress) || 0))),
    hours: Math.round(Math.max(0, Math.min(99999, Number(payload.hours) || 0))),
    priority: clean(payload.priority, "Normal").slice(0, 20),
    series: clean(payload.series).slice(0, 80),
    nextGoal: clean(payload.nextGoal).slice(0, 240),
    notes: clean(payload.notes),
  };
}

export async function GET() {
  try {
    const rows = await getDb().select().from(games).where(eq(games.userId, await userId())).orderBy(desc(games.updatedAt), desc(games.id));
    return Response.json({ games: rows });
  } catch (error) {
    console.error("games.list", error);
    return Response.json({ error: "No pudimos cargar tu biblioteca." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = values(await request.json());
    if (!data.title) return Response.json({ error: "El nombre del juego es obligatorio." }, { status: 400 });
    const [game] = await getDb().insert(games).values({ ...data, userId: await userId() }).returning();
    return Response.json({ game }, { status: 201 });
  } catch (error) {
    console.error("games.create", error);
    return Response.json({ error: "No pudimos guardar el juego." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const id = Number(payload.id); const data = values(payload);
    if (!id || !data.title) return Response.json({ error: "Datos incompletos." }, { status: 400 });
    const [game] = await getDb().update(games).set({ ...data, updatedAt: new Date().toISOString() }).where(and(eq(games.id, id), eq(games.userId, await userId()))).returning();
    if (!game) return Response.json({ error: "Juego no encontrado." }, { status: 404 });
    return Response.json({ game });
  } catch (error) {
    console.error("games.update", error);
    return Response.json({ error: "No pudimos actualizar el juego." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!id) return Response.json({ error: "ID inválido." }, { status: 400 });
    await getDb().delete(games).where(and(eq(games.id, id), eq(games.userId, await userId())));
    return Response.json({ ok: true });
  } catch (error) {
    console.error("games.delete", error);
    return Response.json({ error: "No pudimos eliminar el juego." }, { status: 500 });
  }
}
