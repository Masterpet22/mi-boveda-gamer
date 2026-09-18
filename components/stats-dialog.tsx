"use client";

import { useMemo } from "react";
import { Award, BarChart3, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Game } from "@/lib/game-types";
import { platforms } from "@/lib/game-types";

interface StatsDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  games: Game[];
}

export function StatsDialog({ open, setOpen, games }: StatsDialogProps) {
  const platformData = useMemo(
    () =>
      platforms
        .map(name => ({ name, value: games.filter(game => game.platform === name).length }))
        .filter(item => item.value)
        .sort((a, b) => b.value - a.value),
    [games]
  );

  const genreData = useMemo(() => {
    const counts = new Map<string, number>();
    games
      .flatMap(game => game.genre.split(",").map(value => value.trim()).filter(Boolean))
      .forEach(value => counts.set(value, (counts.get(value) ?? 0) + 1));
    return [...counts]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [games]);

  const monthData = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("es", { month: "short" });
    return Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      return {
        name: formatter.format(date).replace(".", ""),
        value:
          Math.round(
            games
              .flatMap(game => game.sessions ?? [])
              .filter(session => session.date.startsWith(key))
              .reduce((sum, session) => sum + Number(session.hours || 0), 0) * 10
          ) / 10,
      };
    });
  }, [games]);

  const done = games.filter(game => ["Terminado", "Completado"].includes(game.status)).length;
  const completion = games.length ? Math.round((done / games.length) * 100) : 0;
  const currentYear = String(new Date().getFullYear());
  const finishedThisYear = games.filter(
    game =>
      typeof game.finishedAt === "string" &&
      game.finishedAt.startsWith(currentYear) &&
      ["Terminado", "Completado"].includes(game.status)
  ).length;

  const topSeries = useMemo(() => {
    const hours = new Map<string, number>();
    games
      .filter(game => game.series)
      .forEach(game => hours.set(game.series, (hours.get(game.series) ?? 0) + game.hours));
    return [...hours].sort((a, b) => b[1] - a[1])[0];
  }, [games]);

  const currentMonth = new Date().toISOString().slice(0, 7);
  const backlog = games.filter(game => game.status === "Backlog").length;
  const active = games.filter(game => game.status === "Jugando").length;
  const sessions = games.reduce((sum, game) => sum + (game.sessions?.length ?? 0), 0);
  const finishedThisMonth = games.filter(
    game =>
      game.finishedAt?.startsWith(currentMonth) &&
      ["Terminado", "Completado"].includes(game.status)
  ).length;

  const achievements = [
    { title: "Racha de victorias", detail: "Termina 3 juegos en un mes", earned: finishedThisMonth >= 3 },
    { title: "Backlog bajo control", detail: "Mantén 10 juegos o menos", earned: backlog <= 10 && games.length > 0 },
    { title: "Enfoque maestro", detail: "Mantén un máximo de 5 partidas activas", earned: active <= 5 && active > 0 },
    { title: "Cronista gamer", detail: "Registra 10 sesiones de juego", earned: sessions >= 10 },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="text-cyan-300" />
            Estadísticas de tu bóveda
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Un resumen calculado con tu colección y las sesiones registradas.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <StatTile
            label="Biblioteca completada"
            value={`${completion}%`}
            detail={`${done} de ${games.length} juegos`}
          />
          <StatTile
            label={`Terminados en ${currentYear}`}
            value={String(finishedThisYear)}
            detail="Con fecha de finalización"
          />
          <StatTile
            label="Saga más jugada"
            value={topSeries?.[0] ?? "—"}
            detail={topSeries ? `${topSeries[1]} horas acumuladas` : "Añade la saga a tus juegos"}
          />
        </div>

        <div className="mt-3 grid gap-5 md:grid-cols-2">
          <StatsBlock title="Juegos por plataforma" data={platformData} />
          <StatsBlock title="Géneros principales" data={genreData} />
          <div className="md:col-span-2">
            <StatsBlock
              title="Backlog vs. juegos completados"
              data={[
                { name: "Backlog", value: backlog },
                { name: "Terminados y completados", value: done },
              ]}
            />
          </div>

          <div className="md:col-span-2 rounded-2xl border border-white/8 bg-white/[.03] p-4">
            <h3 className="font-bold">Horas registradas por mes</h3>
            <p className="mt-1 text-xs text-slate-500">
              Solo incluye horas añadidas mediante el historial de sesiones.
            </p>
            <div className="mt-5 flex h-40 items-end gap-3">
              {monthData.map(item => {
                const max = Math.max(...monthData.map(value => value.value), 1);
                return (
                  <div
                    key={item.name}
                    className="flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <span className="text-xs font-semibold text-cyan-300">{item.value || ""}</span>
                    <div
                      className="w-full max-w-14 rounded-t-lg bg-gradient-to-t from-violet-500 to-cyan-400"
                      style={{ height: `${Math.max(item.value ? 8 : 2, (item.value / max) * 100)}%` }}
                    />
                    <span className="text-xs capitalize text-slate-400">{item.name}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-white/8 bg-white/[.03] p-4">
          <div className="flex items-center gap-2">
            <Award className="size-5 text-amber-300" />
            <h3 className="font-bold">Logros personales</h3>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {achievements.map(achievement => (
              <div
                key={achievement.title}
                className={`rounded-xl border p-3 ${
                  achievement.earned
                    ? "border-emerald-400/25 bg-emerald-400/10"
                    : "border-white/8 bg-black/10 opacity-60"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Trophy
                    className={`size-4 ${
                      achievement.earned ? "text-emerald-300" : "text-slate-500"
                    }`}
                  />
                  <span className="font-semibold">{achievement.title}</span>
                  {achievement.earned && (
                    <Badge className="ml-auto bg-emerald-400/15 text-emerald-200">
                      Conseguido
                    </Badge>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-400">{achievement.detail}</p>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button onClick={() => setOpen(false)}>Cerrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StatTile({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[.04] p-4">
      <p className="text-sm text-slate-400">{label}</p>
      <p className="mt-2 truncate text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function StatsBlock({
  title,
  data,
}: {
  title: string;
  data: { name: string; value: number }[];
}) {
  const max = Math.max(...data.map(item => item.value), 1);
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[.03] p-4">
      <h3 className="font-bold">{title}</h3>
      {data.length ? (
        <div className="mt-4 space-y-3">
          {data.map(item => (
            <div key={item.name}>
              <div className="mb-1 flex justify-between text-sm">
                <span className="truncate">{item.name}</span>
                <span className="text-slate-400">{item.value}</span>
              </div>
              <div className="h-2 rounded-full bg-white/8">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400"
                  style={{ width: `${(item.value / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No hay datos todavía.</p>
      )}
    </div>
  );
}
