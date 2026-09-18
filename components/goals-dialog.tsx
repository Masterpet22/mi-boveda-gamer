"use client";

import { useState } from "react";
import { Check, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import type { Game, Goals } from "@/lib/game-types";
import { Field } from "@/components/game-dialog";

interface GoalsDialogProps {
  goals: Goals;
  games: Game[];
  setOpen: (open: boolean) => void;
  save: (goals: Goals) => Promise<void>;
}

export function GoalsDialog({ goals, games, setOpen, save }: GoalsDialogProps) {
  const [draft, setDraft] = useState(goals);
  const [saving, setSaving] = useState(false);

  const year = String(new Date().getFullYear());
  const month = new Date().toISOString().slice(0, 7);

  const finished = games.filter(
    game =>
      game.finishedAt?.startsWith(year) && ["Terminado", "Completado"].includes(game.status)
  ).length;

  const backlog = games.filter(game => game.status === "Backlog").length;
  const active = games.filter(game => game.status === "Jugando").length;
  const monthlyHours =
    Math.round(
      games
        .flatMap(game => game.sessions ?? [])
        .filter(session => session.date.startsWith(month))
        .reduce((sum, session) => sum + session.hours, 0) * 10
    ) / 10;

  async function submit() {
    setSaving(true);
    await save(draft);
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="text-cyan-300" />
            Metas personales
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Define objetivos medibles. El progreso se actualiza con tu biblioteca y tus sesiones.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <GoalProgress
            label={`Juegos terminados en ${year}`}
            value={finished}
            target={draft.yearlyFinished}
          />
          <GoalProgress
            label="Horas jugadas este mes"
            value={monthlyHours}
            target={draft.monthlyHours}
          />
          <GoalProgress
            label="Backlog máximo"
            value={backlog}
            target={draft.backlogLimit}
            reverse
          />
          <GoalProgress
            label="Partidas activas máximas"
            value={active}
            target={draft.activeLimit}
            reverse
          />
        </div>

        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <GoalField
            label="Juegos por terminar este año"
            value={draft.yearlyFinished}
            change={value => setDraft({ ...draft, yearlyFinished: value })}
          />
          <GoalField
            label="Horas objetivo por mes"
            value={draft.monthlyHours}
            change={value => setDraft({ ...draft, monthlyHours: value })}
          />
          <GoalField
            label="Límite de backlog"
            value={draft.backlogLimit}
            change={value => setDraft({ ...draft, backlogLimit: value })}
          />
          <GoalField
            label="Límite de partidas activas"
            value={draft.activeLimit}
            change={value => setDraft({ ...draft, activeLimit: value })}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="bg-violet-500" onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : "Guardar metas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GoalProgress({
  label,
  value,
  target,
  reverse,
}: {
  label: string;
  value: number;
  target: number;
  reverse?: boolean;
}) {
  const achieved = reverse ? value <= target : value >= target;
  const percent = reverse
    ? value <= target
      ? 100
      : Math.max(0, (target / value) * 100)
    : Math.min(100, (value / Math.max(target, 1)) * 100);

  return (
    <div
      className={`rounded-2xl border p-4 ${
        achieved ? "border-emerald-400/20 bg-emerald-400/8" : "border-white/8 bg-white/[.03]"
      }`}
    >
      <div className="flex justify-between gap-3 text-sm">
        <span>{label}</span>
        {achieved && <Check className="size-4 text-emerald-300" />}
      </div>
      <div className="mt-2 text-2xl font-black">
        {value} <span className="text-sm font-normal text-slate-500">/ {target}</span>
      </div>
      <Progress
        value={percent}
        className="mt-3 h-2 bg-white/8 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-violet-500 [&_[data-slot=progress-indicator]]:to-cyan-400"
      />
    </div>
  );
}

function GoalField({
  label,
  value,
  change,
}: {
  label: string;
  value: number;
  change: (value: number) => void;
}) {
  return (
    <Field label={label}>
      <Input
        type="number"
        min="1"
        value={value}
        onChange={event => change(Math.max(1, Number(event.target.value)))}
      />
    </Field>
  );
}
