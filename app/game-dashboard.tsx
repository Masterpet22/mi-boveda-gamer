"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  browserLocalPersistence,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query as firestoreQuery,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import {
  BarChart3,
  Check,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  Dices,
  Download,
  Eye,
  FileJson,
  Gamepad2,
  Globe,
  Library,
  ListFilter,
  LogOut,
  Plus,
  Search,
  Settings2,
  Share2,
  SlidersHorizontal,
  Target,
  Trophy,
  Upload,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { auth, db, googleProvider, isFirebaseConfigured } from "./firebase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Toaster } from "@/components/ui/sonner";

import { ShareDialog } from "@/components/share-dialog";
import { ProfilesDialog } from "@/components/profiles-dialog";
import { PublicProfileView } from "@/components/public-profile-view";
import { CommunityView } from "@/components/community-view";
import { CatalogDialog } from "@/components/catalog-dialog";
import { GameDialog } from "@/components/game-dialog";
import { GameDetails } from "@/components/game-details";
import { SettingsDialog } from "@/components/settings-dialog";
import { GoalsDialog } from "@/components/goals-dialog";
import { StatsDialog } from "@/components/stats-dialog";
import { RandomPicker, FilterSelect } from "@/components/random-picker";
import {
  AlertsPanel,
  Empty,
  GameCollectionView,
  ViewSwitcher,
} from "@/components/game-collection-view";
import { SetupNotice, SignIn } from "@/components/sign-in";

import type {
  AppSettings,
  Draft,
  Game,
  Goals,
  InstallPromptEvent,
  Session,
  ViewMode,
} from "@/lib/game-types";
import {
  blank,
  color,
  customLists,
  defaultGoals,
  defaultSettings,
  normalizeTitle,
  platforms,
  statuses,
} from "@/lib/game-types";
import {
  defaultProfileSettings,
  savePublicProfileToFirestore,
  type PublicProfileData,
  type PublicProfileSettings,
} from "@/lib/share";

export function GameDashboard() {
  const [games, setGames] = useState<Game[]>([]);
  const [goals, setGoals] = useState<Goals>(defaultGoals);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("Todos");
  const [platform, setPlatform] = useState("Todas");
  const [genre, setGenre] = useState("Todos");
  const [series, setSeries] = useState("Todas");
  const [priority, setPriority] = useState("Todas");
  const [year, setYear] = useState("Todos");
  const [list, setList] = useState("Todas");
  const [duration, setDuration] = useState("Todas");
  const [difficulty, setDifficulty] = useState("Todas");
  const [sort, setSort] = useState("updated");
  const [viewMode, setViewMode] = useState<ViewMode>("cards");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [dialog, setDialog] = useState(false);
  const [catalogDialog, setCatalogDialog] = useState(false);
  const [settingsDialog, setSettingsDialog] = useState(false);
  const [statsDialog, setStatsDialog] = useState(false);
  const [randomDialog, setRandomDialog] = useState(false);
  const [goalsDialog, setGoalsDialog] = useState(false);
  const [editing, setEditing] = useState<Game | null>(null);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [communityShareGame, setCommunityShareGame] = useState<Game | null>(null);
  const [profilesDialogOpen, setProfilesDialogOpen] = useState(false);
  const [currentNavTab, setCurrentNavTab] = useState<"library" | "community">("community");
  const [publicProfileSettings, setPublicProfileSettings] = useState<PublicProfileSettings>(
    defaultProfileSettings
  );
  const [publicViewUid, setPublicViewUid] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      return params.get("share") || params.get("user") || null;
    }
    return null;
  });

  const backupInput = useRef<HTMLInputElement>(null);

  function shareGameInCommunity(game: Game) {
    setCommunityShareGame(game);
    setSelectedGame(null);
    setCurrentNavTab("community");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  useEffect(() => {
    if (!auth || !db) {
      queueMicrotask(() => {
        setLoading(false);
        setAuthReady(true);
      });
      return;
    }
    const authClient = auth;
    const store = db;
    const fallback = window.setTimeout(() => {
      setUser(authClient.currentUser);
      setAuthReady(true);
      setLoading(false);
    }, 4000);

    const unsubscribe = onAuthStateChanged(authClient, async current => {
      window.clearTimeout(fallback);
      setUser(current);
      setAuthReady(true);
      if (!current) {
        setGames([]);
        setGoals(defaultGoals);
        setSettings(defaultSettings);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        let snapshot;
        try {
          snapshot = await getDocs(
            firestoreQuery(collection(store, "users", current.uid, "games"), orderBy("updatedAt", "desc"))
          );
        } catch (orderError) {
          console.warn("Retrying games fetch without orderBy:", orderError);
          snapshot = await getDocs(collection(store, "users", current.uid, "games"));
        }
        setGames(
          snapshot.docs.map(item => {
            const data = item.data() as Partial<Omit<Game, "id" | "updatedAt">> & {
              updatedAt?: { toDate?: () => Date } | string;
            };
            const updated = data.updatedAt;
            return {
              ...blank,
              ...data,
              id: item.id,
              updatedAt:
                typeof updated === "string"
                  ? updated
                  : updated?.toDate?.().toISOString() ?? new Date().toISOString(),
            } as Game;
          })
        );

        const [goalsSnapshot, settingsSnapshot, pubSnap] = await Promise.all([
          getDoc(doc(store, "users", current.uid, "settings", "goals")).catch(() => null),
          getDoc(doc(store, "users", current.uid, "settings", "preferences")).catch(() => null),
          getDoc(doc(store, "publicProfiles", current.uid)).catch(() => null),
        ]);
        if (goalsSnapshot?.exists()) setGoals({ ...defaultGoals, ...goalsSnapshot.data() } as Goals);
        if (settingsSnapshot?.exists()) {
          const preferences = { ...defaultSettings, ...settingsSnapshot.data() } as AppSettings;
          setSettings(preferences);
          setViewMode(preferences.defaultView);
          setSort(preferences.defaultSort);
        }
        if (pubSnap?.exists()) {
          const pubData = pubSnap.data() as PublicProfileData;
          setPublicProfileSettings({
            isPublic: pubData.isPublic ?? false,
            handle: pubData.handle || current.displayName || "Gamer",
            bio: pubData.bio || defaultProfileSettings.bio,
            hideNotes: pubData.settings?.hideNotes ?? true,
            hideSessions: pubData.settings?.hideSessions ?? true,
            hideHours: pubData.settings?.hideHours ?? false,
            hideWishlist: pubData.settings?.hideWishlist ?? false,
          });
        } else {
          setPublicProfileSettings({ ...defaultProfileSettings, handle: current.displayName || "Gamer" });
        }
      } catch (error) {
        console.error("Error loading library:", error);
        toast.error("No pudimos cargar tu biblioteca.");
      } finally {
        setLoading(false);
      }
    });
    return () => {
      window.clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register(new URL("sw.js", document.baseURI).pathname, {
          scope: new URL("./", document.baseURI).pathname,
        })
        .catch(error => console.warn("Service worker", error));
    }
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: { registerTool: (tool: unknown, options?: { signal: AbortSignal }) => void };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    context.registerTool(
      {
        name: "list_game_collection",
        title: "Ver colección",
        description: "Devuelve los juegos visibles en la biblioteca con su estado y progreso.",
        inputSchema: { type: "object", properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true, untrustedContentHint: false },
        execute: () => ({
          games: games.map(({ id, title, platform, status, progress, nextGoal }) => ({
            id,
            title,
            platform,
            status,
            progress,
            nextGoal,
          })),
        }),
      },
      { signal: lifecycle.signal }
    );
    context.registerTool(
      {
        name: "start_adding_game",
        title: "Añadir juego",
        description: "Abre el formulario visible para añadir un juego a la biblioteca.",
        inputSchema: {
          type: "object",
          properties: { title: { type: "string" } },
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input: unknown) => {
          const title =
            typeof input === "object" && input && "title" in input
              ? String((input as { title?: unknown }).title ?? "")
              : "";
          setEditing(null);
          setDraft({ ...blank, title });
          setDialog(true);
          return { opened: true, title };
        },
      },
      { signal: lifecycle.signal }
    );
    return () => lifecycle.abort();
  }, [games]);

  const genres = useMemo(
    () =>
      [...new Set(games.flatMap(g => g.genre.split(",").map(v => v.trim()).filter(Boolean)))].sort(
        (a, b) => a.localeCompare(b, "es")
      ),
    [games]
  );
  const seriesOptions = useMemo(
    () => [...new Set(games.map(g => g.series.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "es")),
    [games]
  );
  const years = useMemo(
    () => [...new Set(games.map(g => g.releaseYear).filter(v => v > 0))].sort((a, b) => b - a),
    [games]
  );
  const advancedFilterCount = [
    platform !== "Todas",
    genre !== "Todos",
    series !== "Todas",
    priority !== "Todas",
    year !== "Todos",
    list !== "Todas",
    duration !== "Todas",
    difficulty !== "Todas",
  ].filter(Boolean).length;

  const filtered = useMemo(
    () =>
      games
        .filter(g => {
          const haystack = [g.title, g.series, g.nextGoal, g.genre, g.developer, g.notes]
            .join(" ")
            .toLowerCase();
          return (
            (!settings.hideAbandoned || g.status !== "Abandonado") &&
            (!settings.hidePending || g.status !== "Pendiente de compra") &&
            (tab === "Todos" || g.status === tab) &&
            (platform === "Todas" || g.platform === platform) &&
            (genre === "Todos" || g.genre.split(",").map(v => v.trim()).includes(genre)) &&
            (series === "Todas" || g.series === series) &&
            (priority === "Todas" || g.priority === priority) &&
            (year === "Todos" || g.releaseYear === Number(year)) &&
            (list === "Todas" || (g.lists ?? []).includes(list)) &&
            (duration === "Todas" || (g.estimatedHours > 0 && g.estimatedHours <= Number(duration))) &&
            (difficulty === "Todas" || g.difficulty === difficulty) &&
            haystack.includes(query.trim().toLowerCase())
          );
        })
        .sort((a, b) =>
          sort === "title"
            ? a.title.localeCompare(b.title, "es")
            : sort === "progress"
            ? b.progress - a.progress
            : sort === "hours"
            ? b.hours - a.hours
            : sort === "release"
            ? b.releaseYear - a.releaseYear
            : new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        ),
    [
      games,
      tab,
      platform,
      genre,
      series,
      priority,
      year,
      list,
      duration,
      difficulty,
      sort,
      query,
      settings.hideAbandoned,
      settings.hidePending,
    ]
  );

  const stats = useMemo(
    () => ({
      total: games.length,
      active: games.filter(g => g.status === "Jugando").length,
      done: games.filter(g => ["Terminado", "Completado"].includes(g.status)).length,
      hours: games.reduce((s, g) => s + g.hours, 0),
    }),
    [games]
  );

  const statItems: Array<{ Icon: LucideIcon; label: string; value: number }> = [
    { Icon: Library, label: "Biblioteca", value: stats.total },
    { Icon: Gamepad2, label: "Jugando", value: stats.active },
    { Icon: Trophy, label: "Terminados", value: stats.done },
    { Icon: Clock3, label: "Horas", value: stats.hours },
  ];

  const consoleStats = useMemo(
    () => platforms.map(p => ({ p, n: games.filter(g => g.platform === p).length })).filter(x => x.n).sort((a, b) => b.n - a.n),
    [games]
  );

  const openNew = () => {
    setEditing(null);
    setDraft({
      ...blank,
      status: settings.defaultStatus,
      platform: settings.defaultPlatform,
      format: settings.defaultFormat,
    });
    setDialog(true);
  };

  const openEdit = (g: Game) => {
    setEditing(g);
    setDraft({ ...g });
    setDialog(true);
  };

  const resetFilters = () => {
    setQuery("");
    setTab("Todos");
    setPlatform("Todas");
    setGenre("Todos");
    setSeries("Todas");
    setPriority("Todas");
    setYear("Todos");
    setList("Todas");
    setDuration("Todas");
    setDifficulty("Todas");
    setSort("updated");
    setFiltersOpen(false);
  };

  async function login() {
    if (!auth || signingIn) return;
    setSigningIn(true);
    try {
      await setPersistence(auth, browserLocalPersistence);
      const result = await signInWithPopup(auth, googleProvider);
      setUser(result.user);
      setAuthReady(true);
    } catch (error) {
      console.error(error);
      toast.error("No pudimos iniciar sesión con Google.");
    } finally {
      setSigningIn(false);
    }
  }

  async function logout() {
    if (auth) await signOut(auth);
  }

  async function syncPublic(nextGames: Game[]) {
    if (!publicProfileSettings.isPublic || !user || !db) return;
    try {
      await savePublicProfileToFirestore(db, user.uid, publicProfileSettings, nextGames);
    } catch (e) {
      console.warn("Error sync public profile", e);
    }
  }

  async function installApp() {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") toast.success("Mi Bóveda Gamer se está instalando");
    setInstallPrompt(null);
  }

  async function saveGoals(next: Goals) {
    if (!user || !db) return;
    try {
      await setDoc(doc(db, "users", user.uid, "settings", "goals"), next, { merge: true });
      setGoals(next);
      setGoalsDialog(false);
      toast.success("Metas guardadas");
    } catch (error) {
      console.error(error);
      toast.error("No pudimos guardar tus metas.");
    }
  }

  async function saveSettings(next: AppSettings) {
    if (!user || !db) return;
    try {
      await setDoc(doc(db, "users", user.uid, "settings", "preferences"), next, { merge: true });
      setSettings(next);
      setViewMode(next.defaultView);
      setSort(next.defaultSort);
      setSettingsDialog(false);
      toast.success("Configuración guardada");
    } catch (error) {
      console.error(error);
      toast.error("No pudimos guardar la configuración.");
    }
  }

  async function save() {
    if (!draft.title.trim()) return toast.error("Escribe el nombre del juego.");
    if (draft.coverUrl?.trim().startsWith("data:")) {
      return toast.error("La carátula debe ser un enlace web (http/https). Las imágenes en Base64 no están permitidas.");
    }
    if (draft.coverUrl && draft.coverUrl.trim().length > 2048) {
      return toast.error("La URL de la carátula supera el límite de 2048 caracteres.");
    }
    if (!user || !db) return toast.error("Inicia sesión para guardar.");
    if (!editing) {
      const sameTitle = games.filter(
        game => normalizeTitle(game.title) === normalizeTitle(draft.title)
      );
      const exact = sameTitle.find(game => game.platform === draft.platform);
      if (
        exact &&
        !confirm(`“${exact.title}” ya existe para ${draft.platform}. ¿Quieres guardar otro registro de todos modos?`)
      )
        return;
      if (!exact && sameTitle.length) {
        toast.info(
          `Ya tienes este título en ${sameTitle.map(game => game.platform).join(", ")}; se guardará la versión de ${draft.platform}.`
        );
      }
    }
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const payload = { ...draft, updatedAt: serverTimestamp() };
      let nextGames: Game[];
      if (editing) {
        await updateDoc(doc(db, "users", user.uid, "games", editing.id), payload);
        const updatedGame = { ...draft, id: editing.id, updatedAt: now };
        nextGames = games.map(g => (g.id === editing.id ? updatedGame : g));
        setGames(nextGames);
        setSelectedGame(current => (current?.id === editing.id ? updatedGame : current));
      } else {
        const created = await addDoc(collection(db, "users", user.uid, "games"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
        nextGames = [{ ...draft, id: created.id, updatedAt: now }, ...games];
        setGames(nextGames);
      }
      void syncPublic(nextGames);
      setDialog(false);
      toast.success(editing ? "Partida actualizada" : "Juego añadido a tu bóveda");
    } catch (error) {
      console.error(error);
      toast.error("No pudimos guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function addCatalogGames(entries: Draft[]) {
    if (!user || !db) return 0;
    const knownIds = new Set(games.map(game => game.sourceId).filter(Boolean));
    const knownTitles = new Set(games.map(game => normalizeTitle(game.title)));
    const accepted = entries.filter(entry => {
      const title = normalizeTitle(entry.title);
      if ((entry.sourceId && knownIds.has(entry.sourceId)) || knownTitles.has(title)) return false;
      if (entry.sourceId) knownIds.add(entry.sourceId);
      knownTitles.add(title);
      return true;
    });
    const created: Game[] = [];
    try {
      for (const entry of accepted) {
        const reference = await addDoc(collection(db, "users", user.uid, "games"), {
          ...entry,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        created.push({ ...entry, id: reference.id, updatedAt: new Date().toISOString() });
      }
    } finally {
      if (created.length) {
        const nextGames = [...created, ...games];
        setGames(nextGames);
        void syncPublic(nextGames);
      }
    }
    if (created.length) {
      toast.success(`${created.length} juego${created.length === 1 ? "" : "s"} añadido${created.length === 1 ? "" : "s"} a tu bóveda`);
    }
    return created.length;
  }

  async function remove(g: Game) {
    if ((settings.confirmDelete && !confirm(`¿Eliminar “${g.title}” de tu biblioteca?`)) || !user || !db) return;
    try {
      await deleteDoc(doc(db, "users", user.uid, "games", g.id));
      const nextGames = games.filter(v => v.id !== g.id);
      setGames(nextGames);
      setSelectedGame(current => (current?.id === g.id ? null : current));
      void syncPublic(nextGames);
      toast.success("Juego eliminado");
    } catch {
      toast.error("No pudimos eliminarlo.");
    }
  }

  async function quickUpdate(game: Game, changes: Partial<Game>, message: string) {
    if (!user || !db) return;
    const next = { ...game, ...changes, updatedAt: new Date().toISOString() };
    try {
      await updateDoc(doc(db, "users", user.uid, "games", game.id), {
        ...changes,
        updatedAt: serverTimestamp(),
      });
      const nextGames = games.map(item => (item.id === game.id ? next : item));
      setGames(nextGames);
      setSelectedGame(current => (current?.id === game.id ? next : current));
      void syncPublic(nextGames);
      toast.success(message);
    } catch (error) {
      console.error(error);
      toast.error("No pudimos actualizar el juego.");
    }
  }

  async function addSession(game: Game, session: Omit<Session, "id">) {
    if (!user || !db) return;
    const entry = { ...session, id: crypto.randomUUID() };
    const sessions = [entry, ...(game.sessions ?? [])];
    const hours = Math.round((game.hours + entry.hours) * 10) / 10;
    const updatedAt = new Date().toISOString();
    try {
      await updateDoc(doc(db, "users", user.uid, "games", game.id), {
        sessions,
        hours,
        updatedAt: serverTimestamp(),
      });
      const next = { ...game, sessions, hours, updatedAt };
      const nextGames = games.map(item => (item.id === game.id ? next : item));
      setGames(nextGames);
      setSelectedGame(current => (current?.id === game.id ? next : current));
      void syncPublic(nextGames);
      toast.success("Sesión registrada");
    } catch (error) {
      console.error(error);
      toast.error("No pudimos guardar la sesión.");
    }
  }

  async function deleteSession(game: Game, sessionId: string) {
    if (!user || !db) return;
    const target = game.sessions?.find(s => s.id === sessionId);
    if (!target) return;
    const sessions = (game.sessions ?? []).filter(s => s.id !== sessionId);
    const hours = Math.max(0, Math.round((game.hours - (target.hours || 0)) * 10) / 10);
    const updatedAt = new Date().toISOString();
    try {
      await updateDoc(doc(db, "users", user.uid, "games", game.id), {
        sessions,
        hours,
        updatedAt: serverTimestamp(),
      });
      const next = { ...game, sessions, hours, updatedAt };
      const nextGames = games.map(item => (item.id === game.id ? next : item));
      setGames(nextGames);
      setSelectedGame(current => (current?.id === game.id ? next : current));
      void syncPublic(nextGames);
      toast.success("Sesión eliminada");
    } catch (error) {
      console.error(error);
      toast.error("No pudimos eliminar la sesión.");
    }
  }

  function downloadBackup(kind: "json" | "csv") {
    const date = new Date().toISOString().slice(0, 10);
    const name = `mi-boveda-gamer-${date}.${kind}`;
    let content = "";
    let mime = "application/json;charset=utf-8";
    if (kind === "json") {
      content = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), games, settings, goals }, null, 2);
    } else {
      const columns: [string, (g: Game) => unknown][] = [
        ["Juego", g => g.title],
        ["Consola", g => g.platform],
        ["Formato", g => g.format],
        ["Estado", g => g.status],
        ["Progreso", g => g.progress],
        ["Horas", g => g.hours],
        ["Duración estimada", g => g.estimatedHours || ""],
        ["Dificultad", g => g.difficulty],
        ["Prioridad", g => g.priority],
        ["Saga", g => g.series],
        ["Listas", g => (g.lists ?? []).join("; ")],
        ["Género", g => g.genre],
        ["Desarrollador", g => g.developer],
        ["Año", g => g.releaseYear || ""],
        ["Calificación", g => g.rating || ""],
        ["Inicio", g => g.startedAt],
        ["Fin", g => g.finishedAt],
        ["Próximo objetivo", g => g.nextGoal],
        ["Notas", g => g.notes],
        ["Descripción", g => g.description],
        ["Carátula", g => g.coverUrl],
      ];
      const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
      content = [
        columns.map(([label]) => escape(label)).join(","),
        ...games.map(game => columns.map(([, read]) => escape(read(game))).join(",")),
      ].join("\n");
      mime = "text/csv;charset=utf-8";
    }
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success(`Copia ${kind.toUpperCase()} descargada`);
  }

  async function restoreBackup(file: File) {
    if (!user || !db) return;
    setImporting(true);
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      const backup =
        typeof parsed === "object" && parsed !== null
          ? (parsed as { games?: unknown; settings?: Partial<AppSettings>; goals?: Partial<Goals> })
          : null;
      const source = Array.isArray(parsed) ? parsed : backup?.games;
      if (!Array.isArray(source)) throw new Error("Formato inválido");
      const valid = source.filter(
        (item): item is Record<string, unknown> =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { title?: unknown }).title === "string" &&
          String((item as { title: unknown }).title).trim().length > 0
      );
      if (!valid.length) throw new Error("No games");
      if (
        !confirm(
          `Se importarán ${valid.length} juego${valid.length === 1 ? "" : "s"}. Los existentes no se eliminarán. ¿Continuar?`
        )
      )
        return;
      const imported: Game[] = [];
      for (const raw of valid) {
        const normalized = {
          ...blank,
          ...raw,
          id: undefined,
          updatedAt: undefined,
          sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
        };
        delete normalized.id;
        delete normalized.updatedAt;
        if (
          typeof normalized.coverUrl === "string" &&
          (normalized.coverUrl.startsWith("data:") || normalized.coverUrl.length > 2048)
        ) {
          normalized.coverUrl = "";
        }
        const created = await addDoc(collection(db, "users", user.uid, "games"), {
          ...normalized,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        imported.push({ ...blank, ...normalized, id: created.id, updatedAt: new Date().toISOString() } as Game);
      }
      const nextGames = [...imported, ...games];
      setGames(nextGames);
      void syncPublic(nextGames);
      if (backup?.settings) {
        const restored = { ...defaultSettings, ...backup.settings };
        await setDoc(doc(db, "users", user.uid, "settings", "preferences"), restored, { merge: true });
        setSettings(restored);
        setViewMode(restored.defaultView);
        setSort(restored.defaultSort);
      }
      if (backup?.goals) {
        const restored = { ...defaultGoals, ...backup.goals };
        await setDoc(doc(db, "users", user.uid, "settings", "goals"), restored, { merge: true });
        setGoals(restored);
      }
      toast.success(`${imported.length} juego${imported.length === 1 ? "" : "s"} restaurado${imported.length === 1 ? "" : "s"}`);
    } catch (error) {
      console.error(error);
      toast.error("El archivo no es una copia JSON válida.");
    } finally {
      setImporting(false);
      if (backupInput.current) backupInput.current.value = "";
    }
  }

  if (publicViewUid) {
    return (
      <>
        <PublicProfileView
          userId={publicViewUid}
          db={db}
          isOwner={user?.uid === publicViewUid}
          onOpenProfilesDialog={() => setProfilesDialogOpen(true)}
          onExitPreview={() => {
            setPublicViewUid(null);
            if (typeof window !== "undefined") {
              const url = new URL(window.location.href);
              url.searchParams.delete("share");
              url.searchParams.delete("user");
              window.history.replaceState({}, "", url.pathname + (url.search ? `?${url.search}` : ""));
            }
          }}
        />
        <ProfilesDialog
          open={profilesDialogOpen}
          setOpen={setProfilesDialogOpen}
          userId={user?.uid}
          userName={user?.displayName || "Gamer"}
          publicSettings={publicProfileSettings}
          onViewMyProfile={() => user && setPublicViewUid(user.uid)}
          onOpenShareSettings={() => setShareOpen(true)}
          onLoadProfile={uid => setPublicViewUid(uid)}
        />
      </>
    );
  }

  if (!isFirebaseConfigured) return <SetupNotice />;
  if (!authReady) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#07101f] text-slate-300">
        Preparando tu bóveda…
      </div>
    );
  }
  if (!user) {
    if (currentNavTab === "community") {
      return (
        <>
          <Toaster position="top-right" richColors />
          <CommunityView
            db={db}
            currentUserId={null}
            currentUserName="Invitado"
            currentUserPhoto={null}
            onViewProfile={targetUid => setPublicViewUid(targetUid)}
            onBackToLibrary={() => setCurrentNavTab("library")}
          />
        </>
      );
    }
    return (
      <>
        <SignIn
          onSignIn={login}
          signingIn={signingIn}
          onOpenProfiles={() => setCurrentNavTab("community")}
        />
        <ProfilesDialog
          open={profilesDialogOpen}
          setOpen={setProfilesDialogOpen}
          userId={null}
          onLoadProfile={uid => setPublicViewUid(uid)}
        />
      </>
    );
  }

  const profileName = user.displayName?.trim() || user.email?.split("@")[0] || "Jugador";
  const profileInitials = profileName
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0])
    .join("")
    .toUpperCase();

  return (
    <div className="min-h-screen bg-[#07101f] text-slate-100">
      <Toaster position="top-right" richColors />

      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#07101f]/95 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] flex-wrap items-center gap-3 px-4 py-3 lg:px-8">
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 shadow-[0_0_28px_rgba(139,92,246,.3)]">
              <Gamepad2 className="size-5" />
            </div>
            <div>
              <div className="font-black tracking-tight">MI BÓVEDA</div>
              <div className="-mt-1 text-[10px] font-bold tracking-[.22em] text-cyan-300">GAMER</div>
            </div>
          </div>

          <nav
            aria-label="Navegación principal"
            className="order-3 flex w-full gap-1 rounded-xl bg-white/[.04] p-1 md:order-none md:ml-5 md:w-auto"
          >
            <Button
              variant="ghost"
              className={`flex-1 md:flex-none font-semibold ${
                currentNavTab === "community"
                  ? "bg-gradient-to-r from-violet-600/30 to-cyan-500/30 text-cyan-200 border border-cyan-400/30 shadow-sm"
                  : "text-slate-300 hover:text-white"
              }`}
              onClick={() => setCurrentNavTab("community")}
            >
              <Globe className="mr-1.5 size-4 text-cyan-300" />
              Comunidad Gamer
            </Button>
            <Button
              variant="ghost"
              className={`flex-1 md:flex-none font-semibold ${
                currentNavTab === "library" ? "bg-white/10 text-white shadow-sm" : "text-slate-300 hover:text-white"
              }`}
              onClick={() => setCurrentNavTab("library")}
            >
              <Library className="mr-1.5 size-4 text-violet-300" />
              Mi Biblioteca
            </Button>
            <Button
              variant="ghost"
              className="flex-1 text-slate-300 hover:text-white md:flex-none"
              onClick={() => setCatalogDialog(true)}
            >
              <Compass className="mr-1.5 size-4 text-slate-400" />
              Descubrir juegos
            </Button>
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
              onClick={() => setShareOpen(true)}
              title="Compartir colección"
            >
              <Share2 className="mr-1.5 size-4 text-cyan-300" />
              <span>Compartir</span>
            </Button>
            <Button
              className="bg-violet-500 text-white hover:bg-violet-400"
              onClick={openNew}
              aria-label="Añadir juego"
              title="Añadir juego"
            >
              <Plus />
              <span className="hidden sm:inline">Añadir juego</span>
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-11 gap-2 rounded-xl px-2"
                  aria-label={`Abrir menú de perfil de ${profileName}`}
                >
                  <Avatar size="lg" className="border border-white/15">
                    <AvatarImage src={user.photoURL ?? undefined} alt={profileName} />
                    <AvatarFallback className="bg-violet-500/20 font-bold text-violet-200">
                      {profileInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-32 truncate text-left text-sm font-semibold sm:block">
                    {profileName}
                  </span>
                  <ChevronDown className="size-4 text-slate-500" />
                </Button>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-72 border-white/10 bg-[#0b1628] p-2 text-slate-100">
                <DropdownMenuLabel className="flex items-center gap-3 px-2 py-3">
                  <Avatar size="lg">
                    <AvatarImage src={user.photoURL ?? undefined} alt={profileName} />
                    <AvatarFallback className="bg-violet-500/20 text-violet-200">
                      {profileInitials}
                    </AvatarFallback>
                  </Avatar>
                  <span className="min-w-0">
                    <span className="block truncate font-semibold">{profileName}</span>
                    <span className="block truncate text-xs font-normal text-slate-400">{user.email}</span>
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => setPublicViewUid(user.uid)}>
                  <Eye />
                  Ver mi perfil público
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setCurrentNavTab("community")}>
                  <Globe />
                  Comunidad Gamer
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShareOpen(true)}>
                  <Share2 />
                  Compartir colección
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setSettingsDialog(true)}>
                  <Settings2 />
                  Configuración
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setGoalsDialog(true)}>
                  <Target />
                  Metas personales
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setStatsDialog(true)}>
                  <BarChart3 />
                  Estadísticas
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setRandomDialog(true)}>
                  <Dices />
                  ¿Qué juego hoy?
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={() => downloadBackup("json")}>
                  <FileJson />
                  Exportar copia JSON
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => downloadBackup("csv")}>
                  <Download />
                  Exportar lista CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => backupInput.current?.click()} disabled={importing}>
                  <Upload />
                  {importing ? "Importando…" : "Restaurar copia"}
                </DropdownMenuItem>
                {installPrompt && (
                  <>
                    <DropdownMenuSeparator className="bg-white/10" />
                    <DropdownMenuItem onClick={installApp}>
                      <Download />
                      Instalar aplicación
                    </DropdownMenuItem>
                  </>
                )}
                <DropdownMenuSeparator className="bg-white/10" />
                <DropdownMenuItem onClick={logout} variant="destructive">
                  <LogOut />
                  Cerrar sesión
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Main Content - Switch between Library and Community View */}
      {currentNavTab === "community" ? (
        <CommunityView
          db={db}
          currentUserId={user.uid}
          currentUserName={profileName}
          currentUserPhoto={user.photoURL}
          currentUserGames={games}
          gameToShare={communityShareGame}
          onGameShareConsumed={() => setCommunityShareGame(null)}
          publicProfileSettings={publicProfileSettings}
          onOpenShareSettings={() => setShareOpen(true)}
          onViewProfile={targetUid => setPublicViewUid(targetUid)}
          onBackToLibrary={() => setCurrentNavTab("library")}
        />
      ) : (
        <main className="mx-auto grid max-w-[1500px] gap-7 px-4 py-7 lg:grid-cols-[minmax(0,1fr)_310px] lg:px-8">
          <section className="min-w-0">
            {/* Header Stats */}
            <div className="mb-7 flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
              <div>
                <p className="mb-2 text-sm font-semibold text-cyan-300">Biblioteca personal</p>
                <h1 className="text-3xl font-black tracking-[-.04em] sm:text-4xl">Mis juegos</h1>
                <p className="mt-2 text-slate-400">
                  Consulta, organiza y continúa tus partidas desde un solo lugar.
                </p>
              </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {statItems.map(({ Icon, label, value }) => (
                <div
                  key={label}
                  className="min-w-[110px] rounded-2xl border border-white/8 bg-white/[.045] px-3 py-3"
                >
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Icon className="size-4 text-cyan-300" />
                    {label}
                  </div>
                  <div className="mt-1 text-2xl font-black">{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Search and Filters */}
          <div className="mb-5 rounded-2xl border border-white/8 bg-white/[.035] p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_190px_220px_auto]">
              <FilterControl label="Buscar en mi biblioteca">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                  <Input
                    aria-label="Buscar en mi biblioteca"
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    placeholder="Título, saga, género…"
                    className="border-white/8 bg-[#07101f] pl-10"
                  />
                </div>
              </FilterControl>

              <FilterControl label="Estado">
                <FilterSelect value={tab} change={setTab} all="Todos" label="Todos los estados" items={statuses} />
              </FilterControl>

              <FilterControl label="Ordenar por">
                <Select value={sort} onValueChange={setSort}>
                  <SelectTrigger className="w-full border-white/8 bg-[#07101f]">
                    <ListFilter />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="updated">Actualizados recientemente</SelectItem>
                    <SelectItem value="title">Título A–Z</SelectItem>
                    <SelectItem value="progress">Mayor progreso</SelectItem>
                    <SelectItem value="hours">Más horas jugadas</SelectItem>
                    <SelectItem value="release">Lanzamiento más reciente</SelectItem>
                  </SelectContent>
                </Select>
              </FilterControl>

              <div className="flex items-end">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => setFiltersOpen(open => !open)}
                  aria-expanded={filtersOpen}
                >
                  <SlidersHorizontal />
                  Más filtros
                  {advancedFilterCount > 0 && (
                    <Badge className="bg-violet-500 text-white">{advancedFilterCount}</Badge>
                  )}
                </Button>
              </div>
            </div>

            {filtersOpen && (
              <div className="mt-4 grid gap-3 border-t border-white/8 pt-4 sm:grid-cols-2 xl:grid-cols-4">
                <FilterControl label="Plataforma">
                  <FilterSelect
                    value={platform}
                    change={setPlatform}
                    all="Todas"
                    label="Todas las plataformas"
                    items={platforms}
                  />
                </FilterControl>
                <FilterControl label="Género">
                  <FilterSelect
                    value={genre}
                    change={setGenre}
                    all="Todos"
                    label="Todos los géneros"
                    items={genres}
                  />
                </FilterControl>
                <FilterControl label="Saga">
                  <FilterSelect
                    value={series}
                    change={setSeries}
                    all="Todas"
                    label="Todas las sagas"
                    items={seriesOptions}
                  />
                </FilterControl>
                <FilterControl label="Prioridad">
                  <FilterSelect
                    value={priority}
                    change={setPriority}
                    all="Todas"
                    label="Todas las prioridades"
                    items={["Alta", "Normal", "Baja"]}
                  />
                </FilterControl>
                <FilterControl label="Año">
                  <FilterSelect
                    value={year}
                    change={setYear}
                    all="Todos"
                    label="Todos los años"
                    items={years.map(String)}
                  />
                </FilterControl>
                <FilterControl label="Lista">
                  <FilterSelect
                    value={list}
                    change={setList}
                    all="Todas"
                    label="Todas las listas"
                    items={customLists}
                  />
                </FilterControl>
                <FilterControl label="Duración estimada">
                  <FilterSelect
                    value={duration}
                    change={setDuration}
                    all="Todas"
                    label="Cualquier duración"
                    items={["20", "50", "100"]}
                    labels={{
                      "20": "Hasta 20 horas",
                      "50": "Hasta 50 horas",
                      "100": "Hasta 100 horas",
                    }}
                  />
                </FilterControl>
                <FilterControl label="Dificultad">
                  <FilterSelect
                    value={difficulty}
                    change={setDifficulty}
                    all="Todas"
                    label="Cualquier dificultad"
                    items={["Fácil", "Normal", "Difícil", "Muy difícil", "Sin indicar"]}
                  />
                </FilterControl>
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3 text-sm">
              <span className="text-slate-400">
                Mostrando <strong className="text-slate-200">{filtered.length}</strong> de {games.length} juegos
              </span>
              {(query || tab !== "Todos" || advancedFilterCount > 0 || sort !== "updated") && (
                <Button variant="ghost" size="sm" onClick={resetFilters}>
                  Limpiar búsqueda y filtros
                </Button>
              )}
            </div>
          </div>

          {/* Collection Presentation Header */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-bold">Vista de la biblioteca</h2>
              <p className="text-xs text-slate-500">
                Cambia la presentación sin perder tu búsqueda ni tus filtros.
              </p>
            </div>
            <ViewSwitcher value={viewMode} change={setViewMode} />
          </div>

          {/* Games Display */}
          {loading ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map(i => (
                <Skeleton key={i} className="h-96 rounded-3xl bg-white/5" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Empty hasGames={!!games.length} reset={resetFilters} add={openNew} />
          ) : (
            <GameCollectionView
              games={filtered}
              mode={viewMode}
              settings={settings}
              view={setSelectedGame}
              edit={openEdit}
              remove={remove}
              quickSession={game =>
                addSession(game, {
                  date: new Date().toISOString().slice(0, 10),
                  hours: Math.round(settings.quickSessionMinutes / 6) / 10,
                  note: "Registro rápido",
                })
              }
              advance={game => {
                const progress = Math.min(100, game.progress + settings.quickProgress);
                return quickUpdate(
                  game,
                  {
                    progress,
                    ...(settings.autoFinishAt100 && progress === 100
                      ? { status: "Terminado", finishedAt: new Date().toISOString().slice(0, 10) }
                      : {}),
                  },
                  "Progreso actualizado"
                );
              }}
              finish={game =>
                quickUpdate(
                  game,
                  {
                    status: "Terminado",
                    progress: 100,
                    finishedAt: new Date().toISOString().slice(0, 10),
                  },
                  "Juego marcado como terminado"
                )
              }
              favorite={game =>
                quickUpdate(
                  game,
                  {
                    lists: (game.lists ?? []).includes("Favoritos")
                      ? (game.lists ?? []).filter(item => item !== "Favoritos")
                      : [...(game.lists ?? []), "Favoritos"],
                  },
                  (game.lists ?? []).includes("Favoritos") ? "Quitado de favoritos" : "Añadido a favoritos"
                )
              }
              share={shareGameInCommunity}
            />
          )}
        </section>

        {/* Sidebar */}
        <aside className="space-y-5">
          {/* Platform distribution */}
          <div className="rounded-3xl border border-white/8 bg-white/[.04] p-5">
            <div className="flex items-center gap-2">
              <Gamepad2 className="size-5 text-cyan-300" />
              <h2 className="font-bold">Por plataforma</h2>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Selecciona una plataforma para filtrar la biblioteca.
            </p>
            {platform !== "Todas" && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 -ml-2 text-violet-300"
                onClick={() => setPlatform("Todas")}
              >
                Ver todas
              </Button>
            )}
            {consoleStats.length ? (
              <div className="mt-4 space-y-2">
                {consoleStats.map(({ p, n }) => (
                  <button
                    key={p}
                    onClick={() => {
                      setPlatform(p);
                      setFiltersOpen(true);
                    }}
                    aria-pressed={platform === p}
                    className={`block w-full rounded-xl border p-3 text-left transition ${
                      platform === p
                        ? "border-violet-400/35 bg-violet-500/12"
                        : "border-transparent hover:border-white/8 hover:bg-white/[.04]"
                    }`}
                  >
                    <div className="mb-1.5 flex justify-between text-sm">
                      <span className="font-medium">{p}</span>
                      <span className="text-slate-400">
                        {n} juego{n !== 1 ? "s" : ""}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/8">
                      <div
                        className={`h-full rounded-full bg-gradient-to-r ${color[p] ?? color.Otra}`}
                        style={{ width: `${Math.max(10, (n / Math.max(stats.total, 1)) * 100)}%` }}
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-slate-400">Aquí aparecerá la distribución de tu colección.</p>
            )}
          </div>

          {/* Focus Goals Banner */}
          <div className="rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 to-cyan-400/10 p-5">
            <div className="mb-3 grid size-10 place-items-center rounded-xl bg-violet-400/15 text-violet-300">
              <Target />
            </div>
            <h2 className="font-bold">Tu enfoque</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Tu meta es mantener como máximo {goals.activeLimit} partidas activas.
            </p>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-cyan-300">
              {stats.active <= goals.activeLimit ? (
                <>
                  <Check className="size-4" />
                  Vas bien: {stats.active} activas
                </>
              ) : (
                <>Tienes {stats.active} activas</>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 -ml-2 text-violet-300"
              onClick={() => setGoalsDialog(true)}
            >
              Editar metas
              <ChevronRight />
            </Button>
          </div>

          <AlertsPanel
            games={games}
            activeLimit={goals.activeLimit}
            inactivityDays={settings.inactivityDays}
            view={game => setSelectedGame(game)}
          />
        </aside>
      </main>
      )}

      <input
        ref={backupInput}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={event => {
          const file = event.target.files?.[0];
          if (file) void restoreBackup(file);
        }}
      />

      {/* Dialog Modals */}
      {settingsDialog && (
        <SettingsDialog
          settings={settings}
          setOpen={setSettingsDialog}
          save={saveSettings}
          exportJson={() => downloadBackup("json")}
          exportCsv={() => downloadBackup("csv")}
          restore={() => backupInput.current?.click()}
          importing={importing}
        />
      )}

      {catalogDialog && (
        <CatalogDialog
          games={games}
          settings={settings}
          setOpen={setCatalogDialog}
          addGames={addCatalogGames}
        />
      )}

      {goalsDialog && (
        <GoalsDialog goals={goals} games={games} setOpen={setGoalsDialog} save={saveGoals} />
      )}

      <StatsDialog open={statsDialog} setOpen={setStatsDialog} games={games} />

      <RandomPicker
        open={randomDialog}
        setOpen={setRandomDialog}
        games={games}
        view={game => {
          setRandomDialog(false);
          setSelectedGame(game);
        }}
      />

      {selectedGame && (
        <GameDetails
          game={selectedGame}
          setOpen={open => {
            if (!open) setSelectedGame(null);
          }}
          edit={() => {
            setSelectedGame(null);
            openEdit(selectedGame);
          }}
          addSession={session => addSession(selectedGame, session)}
          deleteSession={sessionId => deleteSession(selectedGame, sessionId)}
          quickUpdate={(changes, message) => quickUpdate(selectedGame, changes, message)}
          share={() => shareGameInCommunity(selectedGame)}
        />
      )}

      <GameDialog
        settings={settings}
        open={dialog}
        setOpen={setDialog}
        draft={draft}
        setDraft={setDraft}
        editing={!!editing}
        editingId={editing?.id}
        save={save}
        saving={saving}
        games={games}
      />

      {user && (
        <ShareDialog
          open={shareOpen}
          setOpen={setShareOpen}
          userId={user.uid}
          defaultHandle={user.displayName || "Gamer"}
          games={games}
          db={db}
          savedSettings={publicProfileSettings}
          onSettingsUpdated={setPublicProfileSettings}
          onPreviewPublic={() => setPublicViewUid(user.uid)}
        />
      )}

      <ProfilesDialog
        open={profilesDialogOpen}
        setOpen={setProfilesDialogOpen}
        userId={user?.uid}
        userName={profileName}
        publicSettings={publicProfileSettings}
        onViewMyProfile={() => user && setPublicViewUid(user.uid)}
        onOpenShareSettings={() => setShareOpen(true)}
        onLoadProfile={uid => setPublicViewUid(uid)}
      />
    </div>
  );
}

function FilterControl({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-400">{label}</Label>
      {children}
    </div>
  );
}
