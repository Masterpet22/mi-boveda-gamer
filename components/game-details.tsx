"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CalendarDays,
  Check,
  CheckCircle2,
  Clock3,
  Edit2,
  Flame,
  Hourglass,
  ImageIcon,
  Pencil,
  Play,
  Save,
  Square,
  Star,
  Target,
  Trash2,
  Trophy,
  X,
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
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import type { Game, Session } from "@/lib/game-types";
import { color, formatDate, formatElapsed, statusStyle } from "@/lib/game-types";
import { Field } from "@/components/game-dialog";

interface GameDetailsProps {
  game: Game;
  setOpen: (open: boolean) => void;
  edit: () => void;
  addSession: (session: Omit<Session, "id">) => Promise<void>;
  deleteSession?: (sessionId: string) => Promise<void>;
  quickUpdate?: (changes: Partial<Game>, message: string) => Promise<void>;
}

const difficultyList = ["Sin indicar", "Fácil", "Normal", "Difícil", "Muy difícil"] as const;

const difficultyBadgeColors: Record<string, string> = {
  Fácil: "border-emerald-500/30 bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
  Normal: "border-cyan-500/30 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500/25",
  Difícil: "border-amber-500/30 bg-amber-500/15 text-amber-300 hover:bg-amber-500/25",
  "Muy difícil": "border-rose-500/30 bg-rose-500/15 text-rose-300 hover:bg-rose-500/25",
  "Sin indicar": "border-slate-500/30 bg-slate-500/15 text-slate-400 hover:bg-slate-500/25",
};

const ratingLabels: Record<number, string> = {
  1: "Pésimo",
  2: "Muy malo",
  3: "Malo",
  4: "Flojo",
  5: "Pasable",
  6: "Decente",
  7: "Bueno",
  8: "Muy bueno",
  9: "Excelente",
  10: "Obra maestra",
};

export function GameDetails({
  game,
  setOpen,
  edit,
  addSession,
  deleteSession,
  quickUpdate,
}: GameDetailsProps) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [adding, setAdding] = useState(false);
  const [timerStarted, setTimerStarted] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  // Inline edit state for nextGoal
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(game.nextGoal || "");

  // Inline edit state for notes
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesDraft, setNotesDraft] = useState(game.notes || "");

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
    try {
      await addSession({ date, hours: Math.round(amount * 10) / 10, note: note.trim() });
      setHours("");
      setNote("");
    } finally {
      setAdding(false);
    }
  }

  // Session stats calculation
  const sessionStats = useMemo(() => {
    const sessions = game.sessions ?? [];
    const count = sessions.length;
    const totalHours = Math.round(sessions.reduce((acc, s) => acc + (s.hours || 0), 0) * 10) / 10;
    const avg = count > 0 ? (totalHours / count).toFixed(1) : "0";
    const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
    const lastSession = sorted[0];
    return { count, totalHours, avg, lastSession };
  }, [game.sessions]);

  // Adventure duration calculation
  const adventureDuration = useMemo(() => {
    if (!game.startedAt) return null;
    const startDate = new Date(game.startedAt);
    if (Number.isNaN(startDate.getTime())) return null;

    if (game.finishedAt) {
      const finishDate = new Date(game.finishedAt);
      if (!Number.isNaN(finishDate.getTime())) {
        const diffMs = finishDate.getTime() - startDate.getTime();
        const days = Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)));
        if (days >= 30) {
          const months = (days / 30.4).toFixed(1);
          return `Completado en ${months} meses (${days} días)`;
        }
        return `Completado en ${days} día${days === 1 ? "" : "s"}`;
      }
    }

    // Still in progress
    const now = new Date();
    const diffMs = now.getTime() - startDate.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    if (days === 0) return "Comenzado hoy";
    if (days >= 30) {
      const months = (days / 30.4).toFixed(1);
      return `Llevas ${months} meses jugando (${days} días)`;
    }
    return `Llevas ${days} días jugando`;
  }, [game.startedAt, game.finishedAt]);

  // Progress milestone label
  const progressMilestone = useMemo(() => {
    if (game.progress >= 100) return "Completado";
    if (game.progress >= 75) return "Fase final";
    if (game.progress >= 25) return "En desarrollo";
    if (game.progress > 0) return "Comienzo";
    return "Sin iniciar";
  }, [game.progress]);

  // Estimated hours comparison
  const estimatedDiff = useMemo(() => {
    if (!game.estimatedHours || game.estimatedHours <= 0) return null;
    const remaining = Math.round((game.estimatedHours - game.hours) * 10) / 10;
    if (remaining > 0) {
      return { text: `Faltan aprox. ${remaining} h para completar`, positive: true, remaining };
    }
    return {
      text: `Superó el estimado por ${Math.abs(remaining)} h`,
      positive: false,
      remaining: 0,
    };
  }, [game.estimatedHours, game.hours]);

  // Quick action to finish game today
  async function handleFinishToday() {
    if (!quickUpdate) return;
    const today = new Date().toISOString().slice(0, 10);
    await quickUpdate(
      {
        status: "Terminado",
        progress: 100,
        finishedAt: today,
        startedAt: game.startedAt || today,
      },
      "¡Felicidades! Juego marcado como terminado"
    );
  }

  // Quick progress updater
  async function handleUpdateProgress(val: number) {
    if (!quickUpdate) return;
    const bounded = Math.max(0, Math.min(100, val));
    const changes: Partial<Game> = { progress: bounded };
    if (bounded === 100 && game.status !== "Completado" && game.status !== "Terminado") {
      changes.status = "Terminado";
      if (!game.finishedAt) {
        changes.finishedAt = new Date().toISOString().slice(0, 10);
      }
    }
    await quickUpdate(changes, `Progreso actualizado a ${bounded}%`);
  }

  // Quick rating updater
  async function handleUpdateRating(newRating: number) {
    if (!quickUpdate) return;
    const rating = game.rating === newRating ? 0 : newRating;
    await quickUpdate(
      { rating },
      rating > 0 ? `Calificación guardada: ${rating}/10` : "Calificación eliminada"
    );
  }

  // Quick difficulty updater
  async function handleUpdateDifficulty(diff: string) {
    if (!quickUpdate) return;
    await quickUpdate({ difficulty: diff }, `Dificultad actualizada: ${diff}`);
  }

  // Quick goal updater
  async function handleSaveGoal() {
    if (!quickUpdate) return;
    await quickUpdate({ nextGoal: goalDraft.trim() }, "Próximo objetivo actualizado");
    setEditingGoal(false);
  }

  // Complete current goal
  async function handleCompleteGoal() {
    if (!quickUpdate) return;
    await quickUpdate({ nextGoal: "" }, "¡Objetivo completado!");
    setGoalDraft("");
    setEditingGoal(false);
  }

  // Quick notes updater
  async function handleSaveNotes() {
    if (!quickUpdate) return;
    await quickUpdate({ notes: notesDraft.trim() }, "Notas actualizadas");
    setEditingNotes(false);
  }

  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-4xl">
        <div className="grid gap-6 md:grid-cols-[minmax(0,1.15fr)_minmax(290px,.85fr)]">
          {/* Main Left Column */}
          <section className="space-y-6">
            <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#07101f] shadow-lg">
              {game.coverUrl ? (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{
                    backgroundImage: `linear-gradient(to top, rgba(7,16,31,.85), transparent), url(${JSON.stringify(
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

              {/* Status and Priority badges on cover bottom */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
                <Badge variant="outline" className={`${statusStyle[game.status]} backdrop-blur-md`}>
                  {game.status}
                </Badge>
                {adventureDuration && (
                  <span className="rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-slate-300 backdrop-blur-md">
                    {adventureDuration}
                  </span>
                )}
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <DialogTitle className="text-2xl font-black tracking-tight">{game.title}</DialogTitle>
                  <DialogDescription className="mt-1 text-slate-400">
                    {[game.developer, game.releaseYear || "", game.series]
                      .filter(Boolean)
                      .join(" · ")}
                  </DialogDescription>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {game.genre && <Badge variant="secondary">{game.genre}</Badge>}
                <Badge variant="secondary">{game.platform}</Badge>
                <Badge variant="secondary">{game.format}</Badge>
                <Badge variant="secondary">Prioridad {game.priority.toLowerCase()}</Badge>
              </div>
            </div>

            {game.description && (
              <p className="leading-7 text-slate-300 text-sm bg-white/[.02] p-3 rounded-xl border border-white/5">
                {game.description}
              </p>
            )}

            {/* Pillar 4: Calificación Personal interactiva (1-10) */}
            <div className="rounded-2xl border border-white/8 bg-white/[.03] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Star className="size-4 text-amber-400 fill-amber-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Calificación personal</h3>
                </div>
                <span className="text-xs font-semibold text-amber-300">
                  {game.rating > 0
                    ? `${game.rating} / 10 · ${ratingLabels[game.rating] ?? ""}`
                    : "Sin calificar"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 flex-wrap pt-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map(num => {
                  const active = game.rating >= num;
                  return (
                    <button
                      type="button"
                      key={num}
                      onClick={() => handleUpdateRating(num)}
                      disabled={!quickUpdate}
                      title={`${num}/10 - ${ratingLabels[num]}`}
                      className={`group relative flex size-8 items-center justify-center rounded-lg border text-xs font-bold transition ${
                        active
                          ? "border-amber-400/50 bg-amber-400/20 text-amber-300 shadow-[0_0_12px_rgba(251,191,36,0.2)]"
                          : "border-white/10 bg-white/[.02] text-slate-400 hover:border-amber-400/40 hover:text-amber-200"
                      } ${!quickUpdate ? "cursor-default" : "cursor-pointer active:scale-95"}`}
                    >
                      {num}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pillar 4: Dificultad interactiva */}
            <div className="rounded-2xl border border-white/8 bg-white/[.03] p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Flame className="size-4 text-rose-400" />
                  <h3 className="text-sm font-semibold text-slate-200">Dificultad</h3>
                </div>
                <span className="text-xs text-slate-400">
                  {game.difficulty && game.difficulty !== "Sin indicar"
                    ? game.difficulty
                    : "No asignada"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                {difficultyList.map(diff => {
                  const isSelected = (game.difficulty || "Sin indicar") === diff;
                  return (
                    <button
                      type="button"
                      key={diff}
                      onClick={() => handleUpdateDifficulty(diff)}
                      disabled={!quickUpdate}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                        isSelected
                          ? difficultyBadgeColors[diff] || "border-violet-500 bg-violet-500/20 text-violet-200"
                          : "border-white/10 bg-white/[.02] text-slate-400 hover:border-white/25 hover:text-slate-200"
                      } ${!quickUpdate ? "cursor-default" : "cursor-pointer active:scale-95"}`}
                    >
                      {diff}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Pillar 3: Progreso y tiempo jugado */}
            <div className="rounded-2xl border border-white/8 bg-white/[.03] p-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Clock3 className="size-4 text-cyan-400" />
                  <span className="font-semibold text-slate-200">Progreso del juego</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-cyan-500/30 text-cyan-300">
                    {progressMilestone}
                  </Badge>
                  <strong className="text-base text-cyan-300 font-mono">{game.progress}%</strong>
                </div>
              </div>

              <Progress
                value={game.progress}
                className="h-2.5 bg-white/8 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-violet-500 [&_[data-slot=progress-indicator]]:to-cyan-400"
              />

              {/* Slider for fine adjustment */}
              {quickUpdate && (
                <div className="pt-1">
                  <Slider
                    value={[game.progress]}
                    onValueChange={v => {
                      const val = Array.isArray(v) ? v[0] : v;
                      void handleUpdateProgress(val);
                    }}
                    max={100}
                    step={1}
                    className="py-1"
                  />
                </div>
              )}

              {/* Quick increment buttons */}
              {quickUpdate && (
                <div className="flex items-center justify-between gap-1.5 flex-wrap pt-1">
                  <div className="flex items-center gap-1.5">
                    {[-10, 5, 10, 25].map(step => (
                      <Button
                        key={step}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleUpdateProgress(game.progress + step)}
                        className="h-7 px-2 text-xs border-white/10 hover:border-white/20 bg-white/[.02]"
                      >
                        {step > 0 ? `+${step}%` : `${step}%`}
                      </Button>
                    ))}
                  </div>
                  {game.progress < 100 && (
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleUpdateProgress(100)}
                      className="h-7 px-2.5 text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                    >
                      <Check className="size-3.5 mr-1" />
                      100%
                    </Button>
                  )}
                </div>
              )}

              {/* Estimated vs Played hours comparison */}
              <div className="mt-3 grid gap-3 sm:grid-cols-2 pt-2 border-t border-white/5">
                <Detail icon={<Clock3 />} label="Tiempo jugado" value={`${game.hours} horas`} />
                <Detail
                  icon={<Hourglass />}
                  label="Duración estimada"
                  value={game.estimatedHours > 0 ? `${game.estimatedHours} horas` : "Sin estimar"}
                />
              </div>

              {estimatedDiff && (
                <div
                  className={`flex items-center gap-2 rounded-xl p-2.5 text-xs font-medium border ${
                    estimatedDiff.positive
                      ? "border-cyan-500/20 bg-cyan-500/10 text-cyan-200"
                      : "border-amber-500/20 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  <Hourglass className="size-4 shrink-0" />
                  <span>{estimatedDiff.text}</span>
                </div>
              )}
            </div>

            {/* Pillar 4: Fechas y finalización rápida */}
            <div className="rounded-2xl border border-white/8 bg-white/[.03] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
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

              {/* Quick finish action */}
              {quickUpdate && game.status !== "Terminado" && game.status !== "Completado" && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-semibold text-slate-300 block">
                      ¿Has terminado este juego hoy?
                    </span>
                    <span className="text-xs text-slate-400">
                      Fija fecha a hoy, progreso al 100% y estado Terminado en 1 clic.
                    </span>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleFinishToday}
                    className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold text-xs shadow-md shrink-0"
                  >
                    <CheckCircle2 className="size-3.5 mr-1" />
                    ¡Terminar hoy!
                  </Button>
                </div>
              )}
            </div>

            {/* Pillar 2: Próximo objetivo con edición directa */}
            <div className="rounded-2xl bg-cyan-400/8 border border-cyan-400/20 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
                  <Target className="size-4" />
                  Próximo objetivo
                </div>
                {quickUpdate && !editingGoal && (
                  <div className="flex items-center gap-1.5">
                    {game.nextGoal && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={handleCompleteGoal}
                        className="h-7 px-2 text-xs text-emerald-300 hover:text-emerald-200 hover:bg-emerald-500/15"
                      >
                        <Check className="size-3.5 mr-1" />
                        Completado
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setGoalDraft(game.nextGoal || "");
                        setEditingGoal(true);
                      }}
                      className="h-7 px-2 text-xs text-cyan-300 hover:bg-cyan-400/15"
                    >
                      <Edit2 className="size-3.5 mr-1" />
                      {game.nextGoal ? "Editar" : "Definir"}
                    </Button>
                  </div>
                )}
              </div>

              {editingGoal ? (
                <div className="space-y-2 mt-2">
                  <Input
                    value={goalDraft}
                    onChange={e => setGoalDraft(e.target.value)}
                    placeholder="¿Qué misión o reto harás en tu próxima partida?"
                    className="border-cyan-400/30 bg-black/40 text-sm"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setGoalDraft(game.nextGoal || "");
                        setEditingGoal(false);
                      }}
                      className="h-7 px-2 text-xs"
                    >
                      <X className="size-3.5 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveGoal}
                      className="h-7 px-2.5 text-xs bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold"
                    >
                      <Save className="size-3.5 mr-1" />
                      Guardar
                    </Button>
                  </div>
                </div>
              ) : game.nextGoal ? (
                <p className="text-slate-200 text-sm leading-relaxed">{game.nextGoal}</p>
              ) : (
                <p className="text-slate-400 text-xs italic">
                  No has establecido un objetivo aún. Define uno para recordar qué hacer al volver.
                </p>
              )}
            </div>

            {/* Pillar 2: Notas con edición directa */}
            <div className="rounded-2xl border border-white/8 bg-white/[.03] p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-slate-200">Notas de la partida</h3>
                {quickUpdate && !editingNotes && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setNotesDraft(game.notes || "");
                      setEditingNotes(true);
                    }}
                    className="h-7 px-2 text-xs text-violet-300 hover:bg-violet-400/15"
                  >
                    <Edit2 className="size-3.5 mr-1" />
                    {game.notes ? "Editar notas" : "Añadir notas"}
                  </Button>
                )}
              </div>

              {editingNotes ? (
                <div className="space-y-2 mt-2">
                  <Textarea
                    value={notesDraft}
                    onChange={e => setNotesDraft(e.target.value)}
                    placeholder="Builds, claves, secretos descubiertos, recordatorios..."
                    className="min-h-24 border-white/15 bg-black/40 text-sm leading-6"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setNotesDraft(game.notes || "");
                        setEditingNotes(false);
                      }}
                      className="h-7 px-2 text-xs"
                    >
                      <X className="size-3.5 mr-1" />
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveNotes}
                      className="h-7 px-2.5 text-xs bg-violet-500 hover:bg-violet-600 text-white font-bold"
                    >
                      <Save className="size-3.5 mr-1" />
                      Guardar notas
                    </Button>
                  </div>
                </div>
              ) : game.notes ? (
                <p className="whitespace-pre-wrap text-sm leading-6 text-slate-300">
                  {game.notes}
                </p>
              ) : (
                <p className="text-slate-500 text-xs italic">
                  Sin notas adicionales en esta ficha.
                </p>
              )}
            </div>
          </section>

          {/* Pillar 1: Historial y Registro de Sesiones (Right Column) */}
          <aside className="space-y-5">
            {/* Session stats header metrics */}
            <div className="rounded-2xl border border-white/8 bg-gradient-to-br from-violet-900/20 to-cyan-900/20 p-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-cyan-300 block mb-3">
                Resumen de Sesiones
              </span>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-xl bg-black/30 p-2.5 border border-white/5">
                  <span className="block text-[11px] text-slate-400">Total</span>
                  <span className="text-lg font-bold text-slate-100">{sessionStats.count}</span>
                  <span className="block text-[10px] text-slate-500">sesiones</span>
                </div>
                <div className="rounded-xl bg-black/30 p-2.5 border border-white/5">
                  <span className="block text-[11px] text-slate-400">Tiempo</span>
                  <span className="text-lg font-bold text-violet-300">{sessionStats.totalHours}h</span>
                  <span className="block text-[10px] text-slate-500">acumuladas</span>
                </div>
                <div className="rounded-xl bg-black/30 p-2.5 border border-white/5">
                  <span className="block text-[11px] text-slate-400">Promedio</span>
                  <span className="text-lg font-bold text-cyan-300">{sessionStats.avg}h</span>
                  <span className="block text-[10px] text-slate-500">por sesión</span>
                </div>
              </div>
              {sessionStats.lastSession && (
                <p className="mt-3 text-center text-xs text-slate-400">
                  Última partida:{" "}
                  <strong className="text-slate-200">{formatDate(sessionStats.lastSession.date)}</strong>
                </p>
              )}
            </div>

            {/* New session logger form */}
            <div className="rounded-2xl border border-white/8 bg-white/[.035] p-4">
              <h3 className="font-bold text-sm text-slate-200">Registrar sesión</h3>
              <p className="mt-0.5 text-xs text-slate-400">
                Suma tiempo automáticamente y guarda lo que lograste.
              </p>

              {/* Interactive stopwatch */}
              <div className="mt-3 flex items-center justify-between rounded-xl bg-black/30 p-3 border border-white/5">
                <div>
                  <span className="block text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                    Cronómetro activo
                  </span>
                  <span className="font-mono text-xl font-bold text-cyan-300">
                    {formatElapsed(elapsed)}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={timerStarted === null ? "outline" : "destructive"}
                  onClick={toggleTimer}
                  className={timerStarted === null ? "border-white/15" : "shadow-lg animate-pulse"}
                >
                  {timerStarted === null ? (
                    <>
                      <Play className="size-3.5 mr-1" />
                      Comenzar
                    </>
                  ) : (
                    <>
                      <Square className="size-3.5 mr-1" />
                      Detener
                    </>
                  )}
                </Button>
              </div>

              <div className="mt-3.5 grid gap-3">
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
                <Field label="Nota breve (opcional)">
                  <Textarea
                    value={note}
                    onChange={e => setNote(e.target.value)}
                    placeholder="¿Qué misión o logro conseguiste hoy?"
                    className="min-h-16 text-xs leading-5"
                  />
                </Field>
                <Button
                  className="bg-violet-600 hover:bg-violet-700 text-white font-semibold"
                  onClick={submit}
                  disabled={adding}
                >
                  {adding ? "Guardando…" : "Añadir sesión"}
                </Button>
              </div>
            </div>

            {/* Detailed session history list */}
            <div>
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-200">Historial de sesiones</h3>
                <span className="text-xs text-slate-400 font-mono">
                  {game.sessions?.length ?? 0} registradas
                </span>
              </div>

              {game.sessions?.length ? (
                <div className="mt-3 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
                  {[...game.sessions]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map(session => (
                      <div
                        key={session.id}
                        className="group relative rounded-xl border border-white/8 bg-black/25 p-3 hover:border-white/15 transition"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="size-2 rounded-full bg-cyan-400 shrink-0" />
                            <span className="text-xs font-bold text-slate-200">
                              {formatDate(session.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="font-mono text-xs font-semibold bg-violet-500/20 text-violet-300 border-violet-500/30"
                            >
                              {session.hours} h
                            </Badge>
                            {deleteSession && (
                              <button
                                type="button"
                                onClick={() => {
                                  if (confirm(`¿Eliminar la sesión del ${session.date} (${session.hours}h)?`)) {
                                    void deleteSession(session.id);
                                  }
                                }}
                                title="Eliminar sesión"
                                className="opacity-0 group-hover:opacity-100 text-slate-500 hover:text-rose-400 transition p-1"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        {session.note && (
                          <p className="mt-2 text-xs leading-relaxed text-slate-300 bg-white/[.02] p-2 rounded-lg border border-white/5">
                            {session.note}
                          </p>
                        )}
                      </div>
                    ))}
                </div>
              ) : (
                <div className="mt-3 rounded-xl border border-dashed border-white/10 p-5 text-center text-xs text-slate-500">
                  <Clock3 className="size-6 mx-auto mb-2 opacity-40 text-slate-400" />
                  Todavía no registraste sesiones en este juego. Usa el cronómetro o añade horas arriba.
                </div>
              )}
            </div>
          </aside>
        </div>

        <DialogFooter className="mt-6 border-t border-white/10 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button className="bg-violet-600 hover:bg-violet-700" onClick={edit}>
            <Pencil className="size-3.5 mr-1" />
            Editar ficha completa
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
        <span className="text-sm font-semibold text-slate-200">{value}</span>
      </span>
    </div>
  );
}

