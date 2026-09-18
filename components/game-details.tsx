"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Clock3,
  ImageIcon,
  Pencil,
  Play,
  Square,
  Star,
  Target,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { Game, Session } from "@/lib/game-types";
import { color, formatDate, formatElapsed, statusStyle } from "@/lib/game-types";
import { Field } from "@/components/game-dialog";

interface GameDetailsProps {
  game: Game;
  setOpen: (open: boolean) => void;
  edit: () => void;
  addSession: (session: Omit<Session, "id">) => Promise<void>;
}

export function GameDetails({ game, setOpen, edit, addSession }: GameDetailsProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [timerStarted, setTimerStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (timerStarted === null) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - timerStarted), 1000);
    return () => window.clearInterval(timer);
  }, [timerStarted]);

  function toggleTimer() {
    if (timerStarted === null) {
      setElapsed(0);
      setTimerStarted(Date.now());
      return;
    }
    const measured = Math.max(0.1, Math.round((Date.now() - timerStarted) / 360000) / 10);
    setHours(String(measured));
    setTimerStarted(null);
    toast.success(`${measured} horas preparadas para registrar`);
  }

  async function submit() {
    const amount = Number(hours);
    if (!Number.isFinite(amount) || amount <= 0) {
      return toast.error("Indica cuántas horas jugaste.");
    }
    setAdding(true);
    await addSession({ date, hours: Math.round(amount * 10) / 10, note: note.trim() });
    setHours("");
    setNote("");
    setAdding(false);
  }

  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-4xl">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.1fr)_minmax(280px,.9fr)]">
          <section>
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#07101f]">
              {game.coverUrl ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(7,16,31,.75), transparent), url(${JSON.stringify(
                      game.coverUrl
                    ).slice(1, -1)})`,
                  }}
                />
              ) : (
                <div
                  className={`grid h-full place-items-center bg-gradient-to-br ${
                    color[game.platform] ?? color.Otra
                  }`}
                >
                  <ImageIcon className="size-16 text-white/70" />
                </div>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <DialogTitle className="text-2xl">{game.title}</DialogTitle>
                <DialogDescription className="mt-1 text-slate-400">
                  {[game.developer, game.releaseYear || "", game.series]
                    .filter(Boolean)
                    .join(" · ")}
                </DialogDescription>
              </div>
              <Badge variant="outline" className={statusStyle[game.status]}>
                {game.status}
              </Badge>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {game.genre && <Badge variant="secondary">{game.genre}</Badge>}
              <Badge variant="secondary">{game.platform}</Badge>
              <Badge variant="secondary">{game.format}</Badge>
              <Badge variant="secondary">Prioridad {game.priority.toLowerCase()}</Badge>
              {game.difficulty && game.difficulty !== "Sin indicar" && (
                <Badge variant="secondary">Dificultad {game.difficulty.toLowerCase()}</Badge>
              )}
              {game.estimatedHours > 0 && (
                <Badge variant="secondary">{game.estimatedHours} h estimadas</Badge>
              )}
            </div>

            {game.description && (
              <p className="mt-5 leading-7 text-slate-300">{game.description}</p>
            )}

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <Detail icon={<Clock3 />} label="Tiempo jugado" value={`${game.hours} horas`} />
              <Detail
                icon={<Star />}
                label="Calificación"
                value={game.rating ? `${game.rating}/10` : "Sin calificar"}
              />
              <Detail
                icon={<CalendarDays />}
                label="Fecha de inicio"
                value={formatDate(game.startedAt)}
              />
              <Detail
                icon={<Trophy />}
                label="Fecha de finalización"
                value={formatDate(game.finishedAt)}
              />
            </div>

            <div className="mt-6">
              <div className="flex justify-between text-sm">
                <span>Progreso</span>
                <strong>{game.progress}%</strong>
              </div>
              <Progress
                value={game.progress}
                className="mt-2 h-2 bg-white/8 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-violet-500 [&_[data-slot=progress-indicator]]:to-cyan-400"
              />
            </div>

            {game.nextGoal && (
              <div className="mt-5 rounded-2xl bg-cyan-400/8 p-4">
                <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-cyan-300">
                  <Target className="size-4" />
                  Próximo objetivo
                </div>
                <p className="text-slate-300">{game.nextGoal}</p>
              </div>
            )}

            {game.notes && (
              <div className="mt-5">
                <h3 className="font-semibold">Notas</h3>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-400">
                  {game.notes}
                </p>
              </div>
            )}
          </section>

          <aside>
            <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4">
              <h3 className="font-bold">Registrar sesión</h3>
              <p className="mt-1 text-sm text-slate-400">
                Suma tiempo y conserva un historial de lo que hiciste.
              </p>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-black/20 p-3">
                <div>
                  <span className="block text-xs text-slate-500">Cronómetro</span>
                  <span className="font-mono text-xl font-bold">{formatElapsed(elapsed)}</span>
                </div>
                <Button
                  type="button"
                  variant={timerStarted === null ? "outline" : "destructive"}
                  onClick={toggleTimer}
                >
                  {timerStarted === null ? (
                    <>
                      <Play />
                      Comenzar
                    </>
                  ) : (
                    <>
                      <Square />
                      Detener
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-4 grid gap-3">
                <Field label="Fecha">
                  <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
                </Field>
                <Field label="Duración (horas)">
                  <Input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={hours}
                    onChange={e => setHours(e.target.value)}
                    placeholder="Ej. 1.5"
                  />
                </Field>
                <Field label="Nota breve">
                  <Textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="Misión, logro o avance..."
                  />
                </Field>
                <Button className="bg-violet-500" onClick={submit} disabled={adding}>
                  {adding ? "Guardando…" : "Añadir sesión"}
                </Button>
              </div>
            </div>

            <div className="mt-5">
              <h3 className="font-bold">Historial de sesiones</h3>
              {game.sessions?.length ? (
                <div className="mt-3 space-y-2">
                  {[...game.sessions]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(session => (
                      <div key={session.id} className="rounded-xl border border-white/8 bg-black/15 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold">{formatDate(session.date)}</span>
                          <Badge variant="secondary">{session.hours} h</Badge>
                        </div>
                        {session.note && (
                          <p className="mt-2 text-sm text-slate-400">{session.note}</p>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <p className="mt-3 rounded-xl border border-dashed border-white/10 p-4 text-sm text-slate-500">
                  Todavía no registraste sesiones.
                </p>
              )}
            </div>
          </aside>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button className="bg-violet-500" onClick={edit}>
            <Pencil />
            Editar ficha
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Detail({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[.03] p-3">
      <span className="text-cyan-300 [&_svg]:size-4">{icon}</span>
      <span>
        <span className="block text-xs text-slate-500">{label}</span>
        <span className="text-sm font-semibold">{value}</span>
      </span>
    </div>
  );
}
