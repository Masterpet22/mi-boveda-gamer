"use client";

import { useMemo, useState } from "react";
import { Brain, ChevronRight, Dices, Gamepad2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Game } from "@/lib/game-types";
import { color, platforms } from "@/lib/game-types";

interface RandomPickerProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  games: Game[];
  view: (game: Game) => void;
}

export function RandomPicker({ open, setOpen, games, view }: RandomPickerProps) {
  const [platform, setPlatform] = useState("Todas");
  const [genre, setGenre] = useState("Todos");
  const [duration, setDuration] = useState("Todas");
  const [choice, setChoice] = useState<Game | null>(null);

  const genres = useMemo(
    () =>
      [
        ...new Set(
          games.flatMap(game =>
            game.genre
              .split(",")
              .map(value => value.trim())
              .filter(Boolean)
          )
        ),
      ].sort((a, b) => a.localeCompare(b, "es")),
    [games]
  );

  const candidates = useMemo(
    () =>
      games.filter(
        game =>
          game.status === "Backlog" &&
          (platform === "Todas" || game.platform === platform) &&
          (genre === "Todos" ||
            game.genre
              .split(",")
              .map(value => value.trim())
              .includes(genre)) &&
          (duration === "Todas" ||
            (game.estimatedHours > 0 && game.estimatedHours <= Number(duration)))
      ),
    [games, platform, genre, duration]
  );

  const recommendation = useMemo(() => {
    const played = games.filter(game => (game.sessions?.length ?? 0) > 0);
    const genreHours = new Map<string, number>();
    const platformHours = new Map<string, number>();

    played.forEach(game => {
      const weight = Math.max(game.hours, 1);
      game.genre
        .split(",")
        .map(value => value.trim())
        .filter(Boolean)
        .forEach(value => genreHours.set(value, (genreHours.get(value) ?? 0) + weight));
      platformHours.set(game.platform, (platformHours.get(game.platform) ?? 0) + weight);
    });

    const favoriteGenre = [...genreHours].sort((a, b) => b[1] - a[1])[0]?.[0];
    const favoritePlatform = [...platformHours].sort((a, b) => b[1] - a[1])[0]?.[0];
    const pool = games.filter(
      game =>
        ["Jugando", "Backlog"].includes(game.status) &&
        (platform === "Todas" || game.platform === platform) &&
        (genre === "Todos" || game.genre.includes(genre)) &&
        (duration === "Todas" ||
          (game.estimatedHours > 0 && game.estimatedHours <= Number(duration)))
    );

    const score = (game: Game) =>
      (game.status === "Jugando" ? 5 : 0) +
      (favoriteGenre && game.genre.includes(favoriteGenre) ? 4 : 0) +
      (game.platform === favoritePlatform ? 3 : 0) +
      (game.priority === "Alta" ? 2 : 0) +
      game.progress / 25;

    const game = [...pool].sort((a, b) => score(b) - score(a))[0];
    return game
      ? {
          game,
          reason: played.length
            ? `Coincide con tus hábitos${favoriteGenre ? ` de ${favoriteGenre}` : ""}${
                favoritePlatform ? ` en ${favoritePlatform}` : ""
              }.`
            : "Empieza por una partida prioritaria de tu colección.",
        }
      : null;
  }, [games, platform, genre, duration]);

  function pick() {
    if (!candidates.length) return setChoice(null);
    setChoice(candidates[Math.floor(Math.random() * candidates.length)]);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Dices className="text-violet-300" />
            ¿Qué juego hoy?
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Elige al azar entre tus juegos del backlog. Los pausados y abandonados quedan fuera.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect
            value={platform}
            change={value => {
              setPlatform(value);
              setChoice(null);
            }}
            all="Todas"
            label="Todas las consolas"
            items={platforms}
          />
          <FilterSelect
            value={genre}
            change={value => {
              setGenre(value);
              setChoice(null);
            }}
            all="Todos"
            label="Todos los géneros"
            items={genres}
          />
          <FilterSelect
            value={duration}
            change={value => {
              setDuration(value);
              setChoice(null);
            }}
            all="Todas"
            label="Cualquier duración"
            items={["20", "50", "100"]}
            labels={{
              "20": "Hasta 20 horas",
              "50": "Hasta 50 horas",
              "100": "Hasta 100 horas",
            }}
          />
        </div>

        <p className="text-sm text-slate-400">
          {candidates.length} candidato{candidates.length === 1 ? "" : "s"}
        </p>

        {recommendation && (
          <button
            type="button"
            onClick={() => view(recommendation.game)}
            className="flex w-full items-center gap-3 rounded-2xl border border-cyan-400/20 bg-cyan-400/8 p-4 text-left transition hover:bg-cyan-400/12"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-cyan-400/15 text-cyan-300">
              <Brain />
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-semibold uppercase tracking-wide text-cyan-300">
                Recomendado según tus hábitos
              </span>
              <span className="mt-1 block font-bold">{recommendation.game.title}</span>
              <span className="mt-1 block text-xs text-slate-400">{recommendation.reason}</span>
            </span>
            <ChevronRight className="ml-auto shrink-0 text-cyan-300" />
          </button>
        )}

        {choice ? (
          <div className="flex gap-4 rounded-2xl border border-violet-400/20 bg-violet-500/10 p-4">
            {choice.coverUrl ? (
              <div
                className="h-28 w-20 shrink-0 rounded-xl bg-cover bg-center"
                style={{ backgroundImage: `url(${JSON.stringify(choice.coverUrl).slice(1, -1)})` }}
              />
            ) : (
              <div
                className={`grid h-28 w-20 shrink-0 place-items-center rounded-xl bg-gradient-to-br ${
                  color[choice.platform] ?? color.Otra
                }`}
              >
                <Gamepad2 />
              </div>
            )}
            <div>
              <Badge variant="secondary">{choice.platform}</Badge>
              <h3 className="mt-2 text-xl font-black">{choice.title}</h3>
              <p className="mt-1 text-sm text-slate-400">
                {choice.genre || "Sin género"}
                {choice.estimatedHours ? ` · ${choice.estimatedHours} h estimadas` : ""}
              </p>
              <Button
                variant="ghost"
                className="mt-2 -ml-3 text-violet-300"
                onClick={() => view(choice)}
              >
                Ver ficha
                <ChevronRight />
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid min-h-44 place-items-center rounded-2xl border border-dashed border-white/10 text-center text-slate-500">
            <div>
              <Dices className="mx-auto mb-2 size-8" />
              <p>
                {candidates.length
                  ? "Deja que la bóveda elija por ti."
                  : "No hay juegos que coincidan con esos filtros."}
              </p>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
          <Button className="bg-violet-500" onClick={pick} disabled={!candidates.length}>
            <Dices />
            {choice ? "Elegir otro" : "Elegir juego"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FilterSelect({
  value,
  change,
  all,
  label,
  items,
  labels,
}: {
  value: string;
  change: (value: string) => void;
  all: string;
  label: string;
  items: string[];
  labels?: Record<string, string>;
}) {
  return (
    <Select value={value} onValueChange={change}>
      <SelectTrigger className="w-full border-white/8 bg-[#0b1628]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={all}>{label}</SelectItem>
        {items.map(item => (
          <SelectItem key={item} value={item}>
            {labels?.[item] ?? item}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
