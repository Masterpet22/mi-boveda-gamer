"use client";

import {
  Archive,
  Bell,
  ChevronRight,
  Clock3,
  Gamepad2,
  Heart,
  ImageIcon,
  Info,
  Lock,
  MoreHorizontal,
  Pencil,
  Plus,
  Target,
  Trash2,
  Trophy,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import type { AppSettings, Game, ViewMode } from "@/lib/game-types";
import { color, statusStyle } from "@/lib/game-types";

export type CollectionViewProps = {
  games: Game[];
  mode: ViewMode;
  settings: AppSettings;
  view: (game: Game) => void;
  edit: (game: Game) => void;
  remove: (game: Game) => void;
  quickSession: (game: Game) => void;
  advance: (game: Game) => void;
  finish: (game: Game) => void;
  favorite: (game: Game) => void;
};

export function ViewSwitcher({
  value,
  change,
}: {
  value: ViewMode;
  change: (mode: ViewMode) => void;
}) {
  const options: Array<[ViewMode, string]> = [
    ["cards", "Tarjetas"],
    ["list", "Lista"],
    ["covers", "Carátulas"],
    ["series", "Sagas"],
  ];
  return (
    <div
      className="flex max-w-full overflow-x-auto rounded-xl border border-white/8 bg-[#0b1628] p-1"
      role="group"
      aria-label="Tipo de visualización"
    >
      {options.map(([mode, label]) => (
        <button
          type="button"
          key={mode}
          aria-pressed={value === mode}
          onClick={() => change(mode)}
          className={`min-w-max rounded-lg px-3 py-2 text-sm font-medium transition ${
            value === mode
              ? "bg-violet-500 text-white shadow"
              : "text-slate-400 hover:bg-white/5 hover:text-white"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function GameCard({
  game,
  settings,
  view,
  edit,
  remove,
  quickSession,
  advance,
  finish,
  favorite,
}: {
  game: Game;
  settings: AppSettings;
  view: () => void;
  edit: () => void;
  remove: () => void;
  quickSession: () => void;
  advance: () => void;
  finish: () => void;
  favorite: () => void;
}) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-white/[.065] to-white/[.025] transition hover:-translate-y-1 hover:border-violet-400/30">
      <button
        type="button"
        onClick={view}
        className="relative block aspect-[16/9] w-full overflow-hidden bg-[#0b1628] text-left"
      >
        {game.coverUrl ? (
          <div
            role="img"
            aria-label={`Carátula de ${game.title}`}
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
            style={{
              backgroundImage: `linear-gradient(to top, rgba(7,16,31,.82), rgba(7,16,31,.06)), url(${JSON.stringify(
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
            <ImageIcon className="size-10 text-white/70" />
          </div>
        )}
        <Badge className="absolute left-3 top-3 border-white/15 bg-black/55 text-white backdrop-blur">
          {game.source || "Manual"}
        </Badge>
        <div
          className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${
            color[game.platform] ?? color.Otra
          }`}
        />
      </button>

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div
            className={`grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${
              color[game.platform] ?? color.Otra
            } text-xs font-black`}
          >
            {game.platform.slice(0, 3).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <button
                type="button"
                onClick={view}
                className="line-clamp-2 text-left font-bold leading-tight hover:text-violet-300"
              >
                {game.title}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="-mr-2 -mt-2 text-slate-400">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={view}>
                    <Info />
                    Ver ficha
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={quickSession}>
                    <Clock3 />
                    Registrar {settings.quickSessionMinutes} minutos
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={advance}>
                    <Zap />
                    Aumentar progreso {settings.quickProgress} %
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={finish}>
                    <Trophy />
                    Marcar como terminado
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={favorite}>
                    <Heart />
                    {(game.lists ?? []).includes("Favoritos")
                      ? "Quitar de favoritos"
                      : "Añadir a favoritos"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={edit}>
                    <Pencil />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive" onClick={remove}>
                    <Trash2 />
                    Eliminar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-1 text-sm text-slate-400">
              {game.platform} · {game.format}
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-slate-300">
          {game.genre && <span className="rounded-full bg-white/7 px-2.5 py-1">{game.genre}</span>}
          {game.releaseYear > 0 && (
            <span className="rounded-full bg-white/7 px-2.5 py-1">{game.releaseYear}</span>
          )}
          {game.developer && (
            <span className="max-w-full truncate rounded-full bg-white/7 px-2.5 py-1">
              {game.developer}
            </span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Badge variant="outline" className={statusStyle[game.status]}>
              {game.status}
            </Badge>
            {game.isPrivate && (
              <Badge
                variant="outline"
                className="border-amber-400/30 bg-amber-400/10 text-amber-300"
              >
                <Lock className="mr-1 size-3" />
                Privado
              </Badge>
            )}
          </div>
          <span className="text-sm font-bold">{game.progress}%</span>
        </div>

        <Progress
          value={game.progress}
          className="mt-3 h-2 bg-white/8 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-violet-500 [&_[data-slot=progress-indicator]]:to-cyan-400"
        />

        <div className="mt-5 min-h-14 rounded-xl bg-black/20 p-3">
          <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-cyan-300">
            <Target className="size-3.5" />
            Próximo objetivo
          </div>
          <p className="line-clamp-2 text-sm text-slate-300">
            {game.nextGoal || "Añade una nota para recordar dónde continuar."}
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between text-sm text-slate-400">
          <span className="flex items-center gap-1.5">
            <Clock3 className="size-4" />
            {game.hours} h
          </span>
          <Button variant="ghost" size="sm" className="-mr-2 text-violet-300" onClick={view}>
            Ver ficha
            <ChevronRight />
          </Button>
        </div>
      </div>
    </article>
  );
}

export function GameActionMenu({
  game,
  settings,
  view,
  edit,
  remove,
  quickSession,
  advance,
  finish,
  favorite,
}: { game: Game } & Omit<CollectionViewProps, "games" | "mode">) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-9 border-white/10 bg-[#07101f]/85 text-slate-300 backdrop-blur"
          aria-label={`Acciones para ${game.title}`}
        >
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => view(game)}>
          <Info />
          Ver ficha
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => quickSession(game)}>
          <Clock3 />
          Registrar {settings.quickSessionMinutes} minutos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => advance(game)}>
          <Zap />
          Aumentar progreso {settings.quickProgress} %
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => finish(game)}>
          <Trophy />
          Marcar como terminado
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => favorite(game)}>
          <Heart />
          {(game.lists ?? []).includes("Favoritos") ? "Quitar de favoritos" : "Añadir a favoritos"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => edit(game)}>
          <Pencil />
          Editar
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => remove(game)}>
          <Trash2 />
          Eliminar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function GameListRow({
  game,
  settings,
  view,
  edit,
  remove,
  quickSession,
  advance,
  finish,
  favorite,
  compact,
}: { game: Game; compact?: boolean } & Omit<CollectionViewProps, "games" | "mode">) {
  return (
    <article
      className={`grid items-center gap-3 bg-white/[.025] p-3 transition hover:bg-white/[.05] ${
        compact
          ? "grid-cols-[48px_minmax(0,1fr)_auto]"
          : "grid-cols-[64px_minmax(0,1fr)_auto] rounded-2xl border border-white/8"
      }`}
    >
      <button
        type="button"
        onClick={() => view(game)}
        aria-label={`Abrir ${game.title}`}
        className={`${compact ? "size-12" : "size-16"} overflow-hidden rounded-xl bg-[#0b1628]`}
      >
        {game.coverUrl ? (
          <span
            role="img"
            aria-label=""
            className="block size-full bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(game.coverUrl).slice(1, -1)})` }}
          />
        ) : (
          <span
            className={`grid size-full place-items-center bg-gradient-to-br ${
              color[game.platform] ?? color.Otra
            }`}
          >
            <Gamepad2 className="size-5" />
          </span>
        )}
      </button>

      <button type="button" onClick={() => view(game)} className="min-w-0 text-left">
        <span className="block truncate font-semibold hover:text-violet-300">{game.title}</span>
        <span className="mt-1 block truncate text-xs text-slate-400">
          {game.platform} · {game.genre || "Sin género"}
          {game.releaseYear ? ` · ${game.releaseYear}` : ""}
        </span>
        {!compact && (
          <span className="mt-2 flex items-center gap-2">
            <Progress
              value={game.progress}
              className="h-1.5 max-w-40 flex-1 bg-white/8 [&_[data-slot=progress-indicator]]:bg-violet-500"
            />
            <span className="text-xs font-semibold text-slate-400">{game.progress}%</span>
          </span>
        )}
      </button>

      <div className="flex items-center gap-2">
        {game.isPrivate && (
          <Badge variant="outline" className="border-amber-400/30 bg-amber-400/10 text-amber-300">
            <Lock className="mr-1 size-3" />
            Privado
          </Badge>
        )}
        <Badge variant="outline" className={`hidden sm:inline-flex ${statusStyle[game.status]}`}>
          {game.status}
        </Badge>
        <GameActionMenu
          game={game}
          settings={settings}
          view={view}
          edit={edit}
          remove={remove}
          quickSession={quickSession}
          advance={advance}
          finish={finish}
          favorite={favorite}
        />
      </div>
    </article>
  );
}

export function GameCoverTile({
  game,
  settings,
  view,
  edit,
  remove,
  quickSession,
  advance,
  finish,
  favorite,
}: { game: Game } & Omit<CollectionViewProps, "games" | "mode">) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-white/8 bg-white/[.035]">
      <button
        type="button"
        onClick={() => view(game)}
        className="relative block aspect-[3/4] w-full overflow-hidden text-left"
      >
        {game.coverUrl ? (
          <span
            role="img"
            aria-label={`Carátula de ${game.title}`}
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
            style={{
              backgroundImage: `linear-gradient(to top, rgba(7,16,31,.98) 3%, rgba(7,16,31,.15) 70%), url(${JSON.stringify(
                game.coverUrl
              ).slice(1, -1)})`,
            }}
          />
        ) : (
          <span
            className={`absolute inset-0 grid place-items-center bg-gradient-to-br ${
              color[game.platform] ?? color.Otra
            }`}
          >
            <Gamepad2 className="size-10 text-white/70" />
          </span>
        )}
        <span className="absolute inset-x-0 bottom-0 p-3">
          <span className="line-clamp-2 block font-bold leading-tight">{game.title}</span>
          <span className="mt-1 block text-xs text-slate-300">
            {game.platform} · {game.progress}%
          </span>
        </span>
      </button>
      <div className="absolute right-2 top-2">
        <GameActionMenu
          game={game}
          settings={settings}
          view={view}
          edit={edit}
          remove={remove}
          quickSession={quickSession}
          advance={advance}
          finish={finish}
          favorite={favorite}
        />
      </div>
    </article>
  );
}

export function GameCollectionView(props: CollectionViewProps) {
  const { games, mode, settings } = props;

  if (mode === "cards") {
    return (
      <div
        className={`grid gap-4 ${
          settings.density === "compact"
            ? "md:grid-cols-3 xl:grid-cols-4"
            : "md:grid-cols-2 xl:grid-cols-3"
        }`}
      >
        {games.map(game => (
          <GameCard
            key={game.id}
            game={game}
            settings={settings}
            view={() => props.view(game)}
            edit={() => props.edit(game)}
            remove={() => props.remove(game)}
            quickSession={() => props.quickSession(game)}
            advance={() => props.advance(game)}
            finish={() => props.finish(game)}
            favorite={() => props.favorite(game)}
          />
        ))}
      </div>
    );
  }

  if (mode === "list") {
    return (
      <div className="space-y-2">
        {games.map(game => (
          <GameListRow
            key={game.id}
            game={game}
            {...props}
            compact={settings.density === "compact"}
          />
        ))}
      </div>
    );
  }

  if (mode === "covers") {
    return (
      <div
        className={`grid grid-cols-2 gap-3 ${
          settings.coverSize === "small"
            ? "sm:grid-cols-4 xl:grid-cols-6"
            : settings.coverSize === "large"
            ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
            : "sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        }`}
      >
        {games.map(game => (
          <GameCoverTile key={game.id} game={game} {...props} />
        ))}
      </div>
    );
  }

  const groups = new Map<string, Game[]>();
  games.forEach(game => {
    const name = game.series.trim() || "Sin saga";
    groups.set(name, [...(groups.get(name) ?? []), game]);
  });
  const ordered = [...groups].sort(([a], [b]) =>
    a === "Sin saga" ? 1 : b === "Sin saga" ? -1 : a.localeCompare(b, "es")
  );

  return (
    <div className="space-y-5">
      {ordered.map(([name, items]) => (
        <section
          key={name}
          className="overflow-hidden rounded-2xl border border-white/8 bg-white/[.025]"
        >
          <header className="flex items-center justify-between border-b border-white/8 px-4 py-3">
            <div>
              <h3 className="font-bold">{name}</h3>
              <p className="text-xs text-slate-500">
                {items.length} título{items.length === 1 ? "" : "s"}
              </p>
            </div>
            <Badge variant="secondary">Saga</Badge>
          </header>
          <div className="divide-y divide-white/7">
            {items.map(game => (
              <GameListRow key={game.id} game={game} {...props} compact />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

export function Empty({
  hasGames,
  reset,
  add,
}: {
  hasGames: boolean;
  reset: () => void;
  add: () => void;
}) {
  return (
    <div className="grid min-h-[370px] place-items-center rounded-3xl border border-dashed border-white/12 bg-white/[.025] p-8 text-center">
      <div>
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-violet-500/15 text-violet-300">
          <Archive className="size-8" />
        </div>
        <h2 className="text-xl font-bold">
          {hasGames ? "No hay coincidencias" : "Tu bóveda está lista"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-slate-400">
          {hasGames
            ? "Prueba otro filtro o una búsqueda diferente."
            : "Añade tu primer juego con su carátula y la información que te resulte útil. No cargamos contenido personal de ejemplo."}
        </p>
        {hasGames ? (
          <Button className="mt-5" variant="outline" onClick={reset}>
            Limpiar filtros
          </Button>
        ) : (
          <Button className="mt-5 bg-violet-500" onClick={add}>
            <Plus />
            Añadir mi primer juego
          </Button>
        )}
      </div>
    </div>
  );
}

export function AlertsPanel({
  games,
  activeLimit,
  inactivityDays,
  view,
}: {
  games: Game[];
  activeLimit: number;
  inactivityDays: number;
  view: (game: Game) => void;
}) {
  const inactivityCutoff = new Date().getTime() - inactivityDays * 24 * 60 * 60 * 1000;
  const active = games.filter(game => game.status === "Jugando");
  const inactive = active.filter(game => {
    const latest =
      (game.sessions ?? [])
        .map(session => new Date(`${session.date}T12:00:00`).getTime())
        .filter(Number.isFinite)
        .sort((a, b) => b - a)[0] ?? new Date(game.updatedAt).getTime();
    return Number.isFinite(latest) && latest < inactivityCutoff;
  });

  const alerts = [
    ...(active.length > activeLimit
      ? [
          {
            id: "focus",
            title: `${active.length} partidas activas`,
            text: `Superaste tu límite personal de ${activeLimit}.`,
            game: null,
          },
        ]
      : []),
    ...inactive.slice(0, 3).map(game => ({
      id: game.id,
      title: `Retoma ${game.title}`,
      text: `Lleva más de ${inactivityDays} días sin actividad registrada.`,
      game,
    })),
  ];

  return (
    <div className="rounded-3xl border border-amber-400/15 bg-amber-400/[.04] p-5">
      <div className="flex items-center gap-2">
        <Bell className="size-5 text-amber-300" />
        <h2 className="font-bold">Alertas</h2>
        {alerts.length > 0 && (
          <Badge className="ml-auto bg-amber-400/15 text-amber-200">{alerts.length}</Badge>
        )}
      </div>
      {alerts.length ? (
        <div className="mt-4 space-y-2">
          {alerts.map(alert => (
            <button
              type="button"
              key={alert.id}
              onClick={() => alert.game && view(alert.game)}
              className="block w-full rounded-xl bg-black/15 p-3 text-left transition hover:bg-white/5"
            >
              <span className="block text-sm font-semibold text-amber-100">{alert.title}</span>
              <span className="mt-1 block text-xs leading-5 text-slate-400">{alert.text}</span>
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm leading-6 text-slate-400">
          Sin alertas. Tus partidas activas están bajo control.
        </p>
      )}
    </div>
  );
}
