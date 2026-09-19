"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { Firestore } from "firebase/firestore";
import {
  Archive,
  CalendarDays,
  ChevronRight,
  Clock3,
  Copy,
  Eye,
  Gamepad2,
  Globe,
  ImageIcon,
  Library,
  ListFilter,
  Search,
  ShieldCheck,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchPublicProfileFromFirestore,
  type PublicGame,
  type PublicProfileData,
} from "@/lib/share";

const statusStyle: Record<string, string> = {
  Jugando: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
  Backlog: "bg-violet-400/10 text-violet-300 border-violet-400/20",
  Pausado: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  Terminado: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  Completado: "bg-lime-400/10 text-lime-300 border-lime-400/20",
  Abandonado: "bg-slate-400/10 text-slate-300 border-slate-400/20",
  "Pendiente de compra": "bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/20",
};

const color: Record<string, string> = {
  "3DS": "from-red-500 to-orange-400",
  "Series S": "from-emerald-500 to-green-300",
  PS2: "from-indigo-500 to-blue-400",
  GameCube: "from-violet-600 to-fuchsia-400",
  GBA: "from-sky-500 to-cyan-300",
  Switch: "from-rose-500 to-red-300",
  PC: "from-slate-500 to-slate-300",
  Otra: "from-amber-500 to-yellow-300",
};

interface PublicProfileViewProps {
  userId: string;
  db: Firestore | null;
  initialData?: PublicProfileData | null;
  isOwner?: boolean;
  onExitPreview?: () => void;
  onOpenProfilesDialog?: () => void;
  sessionControls?: ReactNode;
}

export function PublicProfileView({
  userId,
  db,
  initialData,
  isOwner = false,
  onExitPreview,
  onOpenProfilesDialog,
  sessionControls,
}: PublicProfileViewProps) {
  const [fetchedProfile, setFetchedProfile] = useState<PublicProfileData | null>(null);
  const [loading, setLoading] = useState(() => !initialData && Boolean(db && userId));
  const [error, setError] = useState(() => !initialData && (!db || !userId));

  const profile = initialData ?? fetchedProfile;

  // Filters & Search
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Todos");
  const [platform, setPlatform] = useState("Todas");
  const [genre, setGenre] = useState("Todos");
  const [sort, setSort] = useState("updated");
  const [selectedGame, setSelectedGame] = useState<PublicGame | null>(null);

  useEffect(() => {
    if (initialData || !db || !userId) {
      return;
    }
    let isMounted = true;
    fetchPublicProfileFromFirestore(db, userId)
      .then(data => {
        if (!isMounted) return;
        if (!data) {
          setError(true);
        } else {
          setFetchedProfile(data);
        }
      })
      .catch(() => {
        if (isMounted) setError(true);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [db, userId, initialData]);

  const games = useMemo(() => profile?.games ?? [], [profile]);

  const platforms = useMemo(() => {
    return [...new Set(games.map(g => g.platform))].sort((a, b) => a.localeCompare(b, "es"));
  }, [games]);

  const genres = useMemo(() => {
    return [...new Set(games.flatMap(g => g.genre.split(",").map(v => v.trim()).filter(Boolean)))].sort(
      (a, b) => a.localeCompare(b, "es")
    );
  }, [games]);

  const filtered = useMemo(() => {
    return games
      .filter(g => {
        const haystack = [g.title, g.series, g.nextGoal, g.genre, g.developer, g.notes ?? ""]
          .join(" ")
          .toLowerCase();
        return (
          (tab === "Todos" || g.status === tab) &&
          (platform === "Todas" || g.platform === platform) &&
          (genre === "Todos" || g.genre.split(",").map(v => v.trim()).includes(genre)) &&
          haystack.includes(query.trim().toLowerCase())
        );
      })
      .sort((a, b) => {
        if (sort === "title") return a.title.localeCompare(b.title, "es");
        if (sort === "progress") return b.progress - a.progress;
        if (sort === "hours") return b.hours - a.hours;
        if (sort === "release") return b.releaseYear - a.releaseYear;
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      });
  }, [games, tab, platform, genre, sort, query]);

  function copyCurrentLink() {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Enlace de la colección copiado al portapapeles");
    }
  }

  function resetFilters() {
    setQuery("");
    setTab("Todos");
    setPlatform("Todas");
    setGenre("Todos");
    setSort("updated");
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#07101f] p-6 text-slate-100">
        <div className="mx-auto max-w-6xl space-y-6">
          <Skeleton className="h-16 w-full rounded-2xl bg-white/5" />
          <Skeleton className="h-44 w-full rounded-3xl bg-white/5" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map(i => (
              <Skeleton key={i} className="h-80 rounded-3xl bg-white/5" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#07101f] p-6 text-slate-100">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[.045] p-8 text-center shadow-2xl">
          <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-amber-500/15 text-amber-400">
            <Archive className="size-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight">Colección no disponible</h1>
          <p className="mt-3 leading-6 text-slate-400">
            Este perfil es privado, fue desactivado por su propietario o no existe.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            {isOwner && onExitPreview ? (
              <Button className="bg-violet-500 text-white" onClick={onExitPreview}>
                Volver a mi Bóveda
              </Button>
            ) : (
              <Button
                className="bg-violet-500 text-white hover:bg-violet-400"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = window.location.pathname.replace(/\/$/, "") || "/";
                  }
                }}
              >
                Crear mi propia Bóveda Gamer
              </Button>
            )}
          </div>
        </div>
      </main>
    );
  }

  const { stats, handle, bio } = profile;

  return (
    <div className="min-h-screen bg-[#07101f] text-slate-100">
      {/* Banner si el dueño está previsualizando su propio perfil */}
      {isOwner && (
        <div className="sticky top-0 z-40 flex items-center justify-between border-b border-cyan-500/30 bg-cyan-950/90 px-4 py-2 text-xs text-cyan-200 backdrop-blur">
          <div className="flex items-center gap-2">
            {sessionControls}
            <Eye className="size-4 text-cyan-300" />
            <span>Estás viendo tu colección en modo visitante (solo lectura).</span>
          </div>
          {onExitPreview && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-cyan-400/40 bg-cyan-900/40 text-cyan-100 hover:bg-cyan-800/60"
              onClick={onExitPreview}
            >
              Volver a editar
            </Button>
          )}
        </div>
      )}

      {/* Header público */}
      <header className="border-b border-white/8 bg-[#07101f]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between gap-4 px-4 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_28px_rgba(139,92,246,.3)]">
              <Gamepad2 className="size-5 text-white" />
            </div>
            <div>
              <div className="font-black tracking-tight">MI BÓVEDA</div>
              <div className="-mt-1 text-[10px] font-bold tracking-[.22em] text-cyan-300">GAMER</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="hidden sm:flex border-emerald-400/30 bg-emerald-500/10 text-emerald-300"
            >
              <ShieldCheck className="mr-1.5 size-3.5" />
              Perfil de solo lectura
            </Badge>
            {onOpenProfilesDialog && (
              <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white" onClick={onOpenProfilesDialog}>
                <Globe className="mr-1.5 size-4 text-cyan-300" />
                <span className="hidden sm:inline">Ver otros perfiles</span>
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={copyCurrentLink} title="Copiar enlace">
              <Copy className="size-4" />
              <span className="hidden sm:inline">Compartir</span>
            </Button>
            {!isOwner && (
              <Button
                size="sm"
                className="bg-violet-500 text-white hover:bg-violet-400"
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.location.href = window.location.pathname.replace(/\/$/, "") || "/";
                  }
                }}
              >
                Crear mi Bóveda
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Perfil Banner y Estadísticas */}
      <main className="mx-auto max-w-[1500px] px-4 py-8 lg:px-8">
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/[.06] via-white/[.02] to-transparent p-6 sm:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4 sm:gap-5">
              <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-600 to-cyan-400 text-2xl font-black text-white shadow-lg">
                {(handle[0] || "G").toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">{handle}</h1>
                  <Badge variant="outline" className="border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                    <Globe className="mr-1 size-3" />
                    Público
                  </Badge>
                </div>
                {bio && <p className="max-w-2xl text-sm leading-relaxed text-slate-300">{bio}</p>}
                <p className="text-xs text-slate-500">
                  Actualizado:{" "}
                  {new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(
                    new Date(profile.updatedAt)
                  )}
                </p>
              </div>
            </div>

            {/* Stats Pills */}
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <div className="min-w-[100px] rounded-2xl border border-white/8 bg-white/[.04] p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Library className="size-3.5 text-violet-300" />
                  Juegos
                </div>
                <div className="mt-1 text-2xl font-black text-white">{stats.total}</div>
              </div>
              <div className="min-w-[100px] rounded-2xl border border-white/8 bg-white/[.04] p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Gamepad2 className="size-3.5 text-cyan-300" />
                  Jugando
                </div>
                <div className="mt-1 text-2xl font-black text-cyan-300">{stats.active}</div>
              </div>
              <div className="min-w-[100px] rounded-2xl border border-white/8 bg-white/[.04] p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Trophy className="size-3.5 text-emerald-300" />
                  Terminados
                </div>
                <div className="mt-1 text-2xl font-black text-emerald-300">{stats.done}</div>
              </div>
              <div className="min-w-[100px] rounded-2xl border border-white/8 bg-white/[.04] p-3 text-center">
                <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
                  <Clock3 className="size-3.5 text-amber-300" />
                  {stats.hours > 0 ? "Horas" : "Completitud"}
                </div>
                <div className="mt-1 text-2xl font-black text-amber-300">
                  {stats.hours > 0
                    ? `${stats.hours} h`
                    : `${stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0}%`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Buscador y Filtros */}
        <div className="mb-6 rounded-2xl border border-white/8 bg-white/[.035] p-3">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_repeat(3,minmax(140px,auto))]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Buscar en la colección…"
                className="border-white/8 bg-[#0b1628] pl-10 text-sm"
              />
            </div>

            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-full border-white/8 bg-[#0b1628]">
                <SelectValue placeholder="Todas las consolas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todas">Todas las consolas</SelectItem>
                {platforms.map(p => (
                  <SelectItem key={p} value={p}>
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={genre} onValueChange={setGenre}>
              <SelectTrigger className="w-full border-white/8 bg-[#0b1628]">
                <SelectValue placeholder="Todos los géneros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Todos">Todos los géneros</SelectItem>
                {genres.map(g => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-full border-white/8 bg-[#0b1628]">
                <ListFilter className="size-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="updated">Recientes</SelectItem>
                <SelectItem value="title">Título A–Z</SelectItem>
                <SelectItem value="progress">Mayor progreso</SelectItem>
                <SelectItem value="hours">Más horas</SelectItem>
                <SelectItem value="release">Año de estreno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <Tabs value={tab} onValueChange={setTab} className="w-full">
              <TabsList className="h-auto w-full justify-start overflow-x-auto rounded-xl border border-white/8 bg-[#07101f] p-1">
                {["Todos", "Jugando", "Backlog", "Pausado", "Terminado", "Completado"].map(s => (
                  <TabsTrigger
                    key={s}
                    value={s}
                    className="min-w-max data-[state=active]:bg-violet-500 data-[state=active]:text-white"
                  >
                    {s}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </div>

        {/* Cuadrícula de juegos */}
        {filtered.length === 0 ? (
          <div className="grid min-h-[300px] place-items-center rounded-3xl border border-dashed border-white/10 p-8 text-center">
            <div>
              <Archive className="mx-auto mb-3 size-12 text-slate-500" />
              <h3 className="text-lg font-bold">No hay juegos con estos filtros</h3>
              <p className="mt-1 text-sm text-slate-400">
                Prueba buscando otro título o seleccionando otra consola.
              </p>
              <Button variant="outline" className="mt-4" onClick={resetFilters}>
                Limpiar filtros
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map(game => (
              <PublicGameCard key={game.id} game={game} onView={() => setSelectedGame(game)} />
            ))}
          </div>
        )}
      </main>

      {/* Modal de detalles de juego (Solo lectura) */}
      {selectedGame && (
        <PublicGameDetailsModal
          game={selectedGame}
          open={!!selectedGame}
          onClose={() => setSelectedGame(null)}
        />
      )}
    </div>
  );
}

function PublicGameCard({ game, onView }: { game: PublicGame; onView: () => void }) {
  return (
    <article className="group overflow-hidden rounded-3xl border border-white/8 bg-gradient-to-b from-white/[.065] to-white/[.025] transition hover:-translate-y-1 hover:border-violet-400/30">
      <button
        type="button"
        onClick={onView}
        className="relative block aspect-[16/9] w-full overflow-hidden bg-[#0b1628] text-left"
      >
        {game.coverUrl ? (
          <div
            role="img"
            aria-label={`Carátula de ${game.title}`}
            className="absolute inset-0 bg-cover bg-center transition duration-500 group-hover:scale-105"
            style={{
              backgroundImage: `linear-gradient(to top, rgba(7,16,31,.82), rgba(7,16,31,.06)), url(${JSON.stringify(game.coverUrl).slice(1, -1)})`,
            }}
          />
        ) : (
          <div className={`grid h-full place-items-center bg-gradient-to-br ${color[game.platform] ?? color.Otra}`}>
            <ImageIcon className="size-10 text-white/70" />
          </div>
        )}
        <div className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${color[game.platform] ?? color.Otra}`} />
      </button>

      <div className="p-5">
        <div className="flex items-start gap-3">
          <div
            className={`grid size-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${
              color[game.platform] ?? color.Otra
            } text-xs font-black`}
          >
            {game.platform.slice(0, 3).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <button
              type="button"
              onClick={onView}
              className="line-clamp-2 text-left font-bold leading-tight hover:text-violet-300"
            >
              {game.title}
            </button>
            <div className="mt-1 text-xs text-slate-400">
              {game.platform} · {game.format}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5 text-xs text-slate-300">
          {game.genre && <span className="rounded-full bg-white/7 px-2.5 py-0.5">{game.genre}</span>}
          {game.releaseYear > 0 && (
            <span className="rounded-full bg-white/7 px-2.5 py-0.5">{game.releaseYear}</span>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between">
          <Badge variant="outline" className={statusStyle[game.status]}>
            {game.status}
          </Badge>
          <span className="text-sm font-bold text-slate-200">{game.progress}%</span>
        </div>

        <Progress
          value={game.progress}
          className="mt-2 h-2 bg-white/8 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-violet-500 [&_[data-slot=progress-indicator]]:to-cyan-400"
        />

        {game.nextGoal && (
          <div className="mt-4 rounded-xl bg-black/20 p-2.5">
            <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-cyan-300">
              <Target className="size-3" />
              Objetivo
            </div>
            <p className="line-clamp-2 text-xs text-slate-300">{game.nextGoal}</p>
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
          <span>{game.hours > 0 ? `${game.hours} h jugadas` : ""}</span>
          <Button variant="ghost" size="sm" className="h-7 text-violet-300 hover:text-violet-200" onClick={onView}>
            Ver detalles
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </article>
  );
}

function PublicGameDetailsModal({
  game,
  open,
  onClose,
}: {
  game: PublicGame;
  open: boolean;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-2xl">
        <div className="relative aspect-video overflow-hidden rounded-2xl bg-[#07101f]">
          {game.coverUrl ? (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{
                backgroundImage: `linear-gradient(to top, rgba(7,16,31,.8), transparent), url(${JSON.stringify(game.coverUrl).slice(1, -1)})`,
              }}
            />
          ) : (
            <div className={`grid h-full place-items-center bg-gradient-to-br ${color[game.platform] ?? color.Otra}`}>
              <ImageIcon className="size-16 text-white/70" />
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <DialogTitle className="text-2xl font-black">{game.title}</DialogTitle>
            <DialogDescription className="mt-1 text-slate-400">
              {[game.developer, game.releaseYear || "", game.series].filter(Boolean).join(" · ")}
            </DialogDescription>
          </div>
          <Badge variant="outline" className={statusStyle[game.status]}>
            {game.status}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          {game.genre && <Badge variant="secondary">{game.genre}</Badge>}
          <Badge variant="secondary">{game.platform}</Badge>
          <Badge variant="secondary">{game.format}</Badge>
        </div>

        {game.description && (
          <p className="leading-relaxed text-sm text-slate-300">{game.description}</p>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {game.hours > 0 && (
            <DetailItem icon={<Clock3 />} label="Tiempo jugado" value={`${game.hours} horas`} />
          )}
          {game.rating > 0 && (
            <DetailItem icon={<Star />} label="Calificación" value={`${game.rating} / 10`} />
          )}
          {game.startedAt && (
            <DetailItem icon={<CalendarDays />} label="Fecha de inicio" value={game.startedAt} />
          )}
          {game.finishedAt && (
            <DetailItem icon={<Trophy />} label="Fecha de finalización" value={game.finishedAt} />
          )}
        </div>

        <div>
          <div className="flex justify-between text-xs text-slate-400">
            <span>Progreso</span>
            <strong className="text-slate-200">{game.progress}%</strong>
          </div>
          <Progress
            value={game.progress}
            className="mt-2 h-2 bg-white/8 [&_[data-slot=progress-indicator]]:bg-gradient-to-r [&_[data-slot=progress-indicator]]:from-violet-500 [&_[data-slot=progress-indicator]]:to-cyan-400"
          />
        </div>

        {game.nextGoal && (
          <div className="rounded-2xl bg-cyan-400/8 p-4">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-cyan-300">
              <Target className="size-4" />
              Próximo objetivo
            </div>
            <p className="text-sm text-slate-300">{game.nextGoal}</p>
          </div>
        )}

        {game.notes && (
          <div className="rounded-xl border border-white/8 bg-white/[.02] p-4">
            <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Notas públicas</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-300">{game.notes}</p>
          </div>
        )}

        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onClose}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailItem({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
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
