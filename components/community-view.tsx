"use client";

import { useEffect, useMemo, useState } from "react";
import type { Firestore } from "firebase/firestore";
import {
  Archive,
  ArrowRight,
  ExternalLink,
  Flame,
  Gamepad2,
  Globe,
  Heart,
  HelpCircle,
  Library,
  Lightbulb,
  MessageCircle,
  MessageSquare,
  Plus,
  Radio,
  Search,
  Send,
  Share2,
  Sparkles,
  Star,
  Tag,
  Trophy,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  addCommunityReply,
  createCommunityPost,
  fetchAllPublicProfiles,
  fetchCommunityPosts,
  togglePostLike,
  type CommunityPost,
  type PublicProfileData,
  type PublicProfileSettings,
} from "@/lib/share";

interface CommunityViewProps {
  db: Firestore | null;
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserPhoto?: string | null;
  publicProfileSettings?: PublicProfileSettings;
  onOpenShareSettings?: () => void;
  onViewProfile: (userId: string) => void;
  onBackToLibrary: () => void;
}

type FeedFilter = "all" | "posts" | "questions" | "recommendations" | "milestones" | "profiles";

interface ActivityEvent {
  id: string;
  userId: string;
  handle: string;
  gameTitle: string;
  platform: string;
  type: "completed" | "playing" | "rated";
  detail: string;
  date: string;
  rating?: number;
  coverUrl?: string;
  progress?: number;
}

type UnifiedFeedItem =
  | { kind: "post"; item: CommunityPost; date: string }
  | { kind: "activity"; item: ActivityEvent; date: string };

function formatTimeAgo(isoString?: string): string {
  if (!isoString) return "";
  try {
    const date = new Date(isoString);
    const now = new Date();
    const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
    if (diffSec < 60) return "hace unos segundos";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `hace ${diffHour} h`;
    const diffDays = Math.floor(diffHour / 24);
    if (diffDays < 7) return `hace ${diffDays} d`;
    return new Intl.DateTimeFormat("es", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  } catch {
    return "";
  }
}

export function CommunityView({
  db,
  currentUserId,
  currentUserName = "Gamer",
  currentUserPhoto,
  publicProfileSettings,
  onOpenShareSettings,
  onViewProfile,
  onBackToLibrary,
}: CommunityViewProps) {
  // Feed Filter: defaults to 'all' (Unified Facebook-style feed)
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("all");

  // Profiles State
  const [profiles, setProfiles] = useState<PublicProfileData[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(() => Boolean(db));
  const [searchProfile, setSearchProfile] = useState("");

  // Posts State
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(() => Boolean(db));
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);

  // Composer Form State
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState<"Pregunta" | "Recomendación" | "Debate" | "Logro">("Pregunta");
  const [postGame, setPostGame] = useState("");
  const [postPlatform, setPostPlatform] = useState("");

  // Comment Replies state
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);

  // Load profiles
  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    fetchAllPublicProfiles(db)
      .then(list => {
        if (isMounted) {
          setProfiles(list);
          setLoadingProfiles(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingProfiles(false);
      });

    return () => {
      isMounted = false;
    };
  }, [db]);

  // Load community posts
  useEffect(() => {
    if (!db) return;
    let isMounted = true;
    fetchCommunityPosts(db)
      .then(list => {
        if (isMounted) {
          setPosts(list);
          setLoadingPosts(false);
        }
      })
      .catch(() => {
        if (isMounted) setLoadingPosts(false);
      });

    return () => {
      isMounted = false;
    };
  }, [db]);

  // Filtered profiles for profiles tab and sidebar
  const filteredProfiles = useMemo(() => {
    const q = searchProfile.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p => {
      const haystack = [p.handle, p.bio, ...p.stats.consoles.map(c => c.platform)].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [profiles, searchProfile]);

  // Derived Feed of Activities from public profiles
  const activityFeed = useMemo(() => {
    const events: ActivityEvent[] = [];

    for (const p of profiles) {
      for (const g of p.games) {
        if (["Terminado", "Completado"].includes(g.status)) {
          events.push({
            id: `act-${p.userId}-${g.id}-done`,
            userId: p.userId,
            handle: p.handle,
            gameTitle: g.title,
            platform: g.platform,
            type: "completed",
            detail: `ha terminado ${g.title} con un progreso del ${g.progress}%`,
            date: g.finishedAt || g.updatedAt,
            rating: g.rating,
            coverUrl: g.coverUrl,
            progress: g.progress,
          });
        } else if (g.status === "Jugando" && g.progress > 0) {
          events.push({
            id: `act-${p.userId}-${g.id}-playing`,
            userId: p.userId,
            handle: p.handle,
            gameTitle: g.title,
            platform: g.platform,
            type: "playing",
            detail: `está jugando ${g.title} (${g.progress}%)`,
            date: g.updatedAt,
            coverUrl: g.coverUrl,
            progress: g.progress,
          });
        }
      }
    }

    return events.sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, 30);
  }, [profiles]);

  // Trending Games computed from community profiles
  const trendingGames = useMemo(() => {
    const counts = new Map<string, { title: string; count: number; platform?: string }>();
    for (const p of profiles) {
      for (const g of p.games) {
        const key = g.title.trim().toLowerCase();
        const existing = counts.get(key);
        if (existing) {
          existing.count += 1;
        } else {
          counts.set(key, { title: g.title, count: 1, platform: g.platform });
        }
      }
    }
    return Array.from(counts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [profiles]);

  // Unified Chronological Feed (Facebook-style stream)
  const unifiedFeed = useMemo<UnifiedFeedItem[]>(() => {
    const items: UnifiedFeedItem[] = [];

    // Filter posts according to feedFilter
    for (const post of posts) {
      if (feedFilter === "all" || feedFilter === "posts") {
        items.push({ kind: "post", item: post, date: post.createdAt });
      } else if (feedFilter === "questions" && post.category === "Pregunta") {
        items.push({ kind: "post", item: post, date: post.createdAt });
      } else if (feedFilter === "recommendations" && post.category === "Recomendación") {
        items.push({ kind: "post", item: post, date: post.createdAt });
      } else if (feedFilter === "milestones" && post.category === "Logro") {
        items.push({ kind: "post", item: post, date: post.createdAt });
      }
    }

    // Include activity events in "all" and "milestones"
    if (feedFilter === "all" || feedFilter === "milestones") {
      for (const act of activityFeed) {
        items.push({ kind: "activity", item: act, date: act.date });
      }
    }

    return items.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  }, [posts, activityFeed, feedFilter]);

  // Submit new post
  async function handleCreatePost() {
    if (!db) return;
    if (!currentUserId) {
      toast.error("Inicia sesión para publicar en la comunidad gamer.");
      return;
    }
    if (!postContent.trim()) {
      toast.error("Por favor escribe el contenido de tu publicación.");
      return;
    }

    setSubmittingPost(true);
    try {
      const derivedTitle =
        postTitle.trim() ||
        postContent.trim().slice(0, 60) + (postContent.trim().length > 60 ? "…" : "");

      const created = await createCommunityPost(db, {
        authorId: currentUserId,
        authorName: currentUserName || "Gamer",
        authorPhoto: currentUserPhoto ?? undefined,
        title: derivedTitle,
        content: postContent.trim(),
        category: postCategory,
        gameTitle: postGame.trim() || undefined,
        platform: postPlatform.trim() || undefined,
      });

      setPosts(prev => [created, ...prev]);
      setPostTitle("");
      setPostContent("");
      setPostGame("");
      setPostPlatform("");
      setComposerExpanded(false);
      toast.success("¡Tu publicación está en el muro de la comunidad!");
    } catch (err) {
      console.error(err);
      toast.error("No pudimos publicar en este momento.");
    } finally {
      setSubmittingPost(false);
    }
  }

  // Like a post
  async function handleLikePost(post: CommunityPost) {
    if (!db || !currentUserId) {
      toast.info("Inicia sesión para interactuar con las publicaciones.");
      return;
    }
    try {
      const result = await togglePostLike(
        db,
        post.id,
        currentUserId,
        post.likes || 0,
        post.likedBy || []
      );
      setPosts(prev =>
        prev.map(p => (p.id === post.id ? { ...p, likes: result.likes, likedBy: result.likedBy } : p))
      );
    } catch (err) {
      console.error(err);
    }
  }

  // Reply to a post
  async function handleSendReply(postId: string, currentReplies: CommunityPost["replies"]) {
    if (!db || !currentUserId) {
      toast.info("Inicia sesión para responder.");
      return;
    }
    const text = (replyDrafts[postId] || "").trim();
    if (!text) return;

    try {
      const reply = await addCommunityReply(db, postId, currentReplies || [], {
        authorId: currentUserId,
        authorName: currentUserName || "Gamer",
        authorPhoto: currentUserPhoto ?? undefined,
        content: text,
      });

      setPosts(prev =>
        prev.map(p => (p.id === postId ? { ...p, replies: [...(p.replies || []), reply] } : p))
      );

      setReplyDrafts(prev => ({ ...prev, [postId]: "" }));
      toast.success("Comentario publicado");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo enviar el comentario.");
    }
  }

  const userInitial = (currentUserName?.[0] || "G").toUpperCase();

  return (
    <div className="min-h-screen bg-[#07101f] text-slate-100 pb-16">
      {/* Top Hero Banner */}
      <div className="border-b border-white/8 bg-gradient-to-b from-violet-950/40 via-[#07101f] to-[#07101f] px-4 py-6 lg:px-8">
        <div className="mx-auto max-w-[1400px]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3.5">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 shadow-[0_0_24px_rgba(6,182,212,0.3)]">
                <Globe className="size-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl text-white">Comunidad Gamer</h1>
                  <Badge variant="outline" className="border-cyan-400/30 bg-cyan-500/10 text-cyan-300 text-xs">
                    <Radio className="mr-1 size-3 text-cyan-400 animate-pulse" />
                    En vivo
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs sm:text-sm text-slate-400">
                  El feed social de gamers: comparte tus avances, recomienda joyas, consulta dudas y explora bóvedas públicas.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onOpenShareSettings && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenShareSettings}
                  className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20 text-xs"
                >
                  <Share2 className="mr-1.5 size-3.5 text-cyan-300" />
                  {publicProfileSettings?.isPublic ? "Mi Bóveda Pública" : "Hacer mi Bóveda Pública"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToLibrary}
                className="text-slate-300 hover:text-white text-xs"
              >
                <Library className="mr-1.5 size-3.5" />
                Mi Biblioteca
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container - 2 Columns (Facebook Feed + Sidebar) */}
      <main className="mx-auto max-w-[1400px] px-4 py-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* ========================================================= */}
          {/* MAIN CENTRAL COLUMN: FACEBOOK-STYLE FEED (Col 8)         */}
          {/* ========================================================= */}
          <div className="lg:col-span-8 space-y-5">
            {/* 1. FACEBOOK POST COMPOSER */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.07] to-white/[.03] p-4 sm:p-5 shadow-xl backdrop-blur-md">
              <div className="flex items-start gap-3">
                <Avatar className="size-10 border border-white/20 shrink-0">
                  <AvatarImage src={currentUserPhoto ?? undefined} alt={currentUserName || "Gamer"} />
                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 text-white font-bold text-sm">
                    {userInitial}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  {!composerExpanded ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (!currentUserId) {
                          toast.info("Inicia sesión para publicar en la comunidad.");
                          return;
                        }
                        setComposerExpanded(true);
                      }}
                      className="w-full text-left rounded-2xl bg-black/30 border border-white/10 px-4 py-3 text-sm text-slate-400 hover:bg-black/40 hover:text-slate-200 transition flex items-center justify-between"
                    >
                      <span>¿Qué estás jugando o qué quieres compartir hoy?</span>
                      <Sparkles className="size-4 text-cyan-400 shrink-0" />
                    </button>
                  ) : (
                    <div className="space-y-3">
                      {/* Optional Title */}
                      <Input
                        value={postTitle}
                        onChange={e => setPostTitle(e.target.value)}
                        placeholder="Título o resumen (ej. ¿Vale la pena en 2026? / Boss derrotado)"
                        className="border-white/10 bg-black/40 text-sm focus-visible:ring-cyan-500"
                      />

                      {/* Main Content */}
                      <Textarea
                        value={postContent}
                        onChange={e => setPostContent(e.target.value)}
                        placeholder="Escribe tu duda, reseña de juego, consejo para un boss, o debate con la comunidad..."
                        rows={3}
                        className="border-white/10 bg-black/40 text-sm leading-relaxed focus-visible:ring-cyan-500 resize-none"
                        autoFocus
                      />

                      {/* Category Selector Chips */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <span className="text-[11px] font-semibold text-slate-400 mr-1">Tipo:</span>
                        {(
                          [
                            { id: "Pregunta", label: "💬 Duda / Pregunta" },
                            { id: "Recomendación", label: "💡 Recomendación" },
                            { id: "Logro", label: "🏆 Logro / Hito" },
                            { id: "Debate", label: "🔥 Debate Gamer" },
                          ] as const
                        ).map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => setPostCategory(cat.id)}
                            className={`px-2.5 py-1 rounded-full text-xs font-semibold transition ${
                              postCategory === cat.id
                                ? "bg-gradient-to-r from-violet-600 to-cyan-600 text-white shadow-sm"
                                : "bg-white/5 text-slate-300 hover:bg-white/10"
                            }`}
                          >
                            {cat.label}
                          </button>
                        ))}
                      </div>

                      {/* Optional Game and Platform Tags */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                        <div className="relative">
                          <Gamepad2 className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                          <Input
                            value={postGame}
                            onChange={e => setPostGame(e.target.value)}
                            placeholder="Nombre del juego (opcional)"
                            className="pl-8 text-xs border-white/10 bg-black/30 h-8"
                          />
                        </div>
                        <div className="relative">
                          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
                          <Input
                            value={postPlatform}
                            onChange={e => setPostPlatform(e.target.value)}
                            placeholder="Plataforma (ej. PC, PS5, Switch)"
                            className="pl-8 text-xs border-white/10 bg-black/30 h-8"
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setComposerExpanded(false)}
                          className="text-xs text-slate-400 hover:text-slate-200 h-8"
                        >
                          Cancelar
                        </Button>
                        <Button
                          size="sm"
                          onClick={handleCreatePost}
                          disabled={submittingPost || !postContent.trim()}
                          className="bg-gradient-to-r from-violet-600 to-cyan-500 hover:from-violet-500 hover:to-cyan-400 text-white font-bold text-xs h-8 px-4 shadow-[0_0_16px_rgba(139,92,246,0.3)]"
                        >
                          <Send className="mr-1.5 size-3.5" />
                          {submittingPost ? "Publicando…" : "Publicar en el Muro"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Quick Prompt Icons bar (Facebook-style) */}
              {!composerExpanded && (
                <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-around text-xs text-slate-400">
                  <button
                    type="button"
                    onClick={() => {
                      setPostCategory("Pregunta");
                      setComposerExpanded(true);
                    }}
                    className="flex items-center gap-1.5 hover:text-cyan-300 transition py-1 px-2 rounded-lg hover:bg-white/5"
                  >
                    <HelpCircle className="size-4 text-sky-400" />
                    <span>Hacer Pregunta</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPostCategory("Recomendación");
                      setComposerExpanded(true);
                    }}
                    className="flex items-center gap-1.5 hover:text-emerald-300 transition py-1 px-2 rounded-lg hover:bg-white/5"
                  >
                    <Lightbulb className="size-4 text-emerald-400" />
                    <span>Recomendar Juego</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPostCategory("Logro");
                      setComposerExpanded(true);
                    }}
                    className="flex items-center gap-1.5 hover:text-amber-300 transition py-1 px-2 rounded-lg hover:bg-white/5"
                  >
                    <Trophy className="size-4 text-amber-400" />
                    <span>Compartir Logro</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPostCategory("Debate");
                      setComposerExpanded(true);
                    }}
                    className="flex items-center gap-1.5 hover:text-violet-300 transition py-1 px-2 rounded-lg hover:bg-white/5 hidden sm:flex"
                  >
                    <MessageSquare className="size-4 text-violet-400" />
                    <span>Iniciar Debate</span>
                  </button>
                </div>
              )}
            </div>

            {/* 2. FEED FILTER CHIPS (Facebook / Twitter Feed Selector) */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {(
                [
                  { id: "all", label: "🔥 Todo el Muro", count: posts.length + activityFeed.length },
                  { id: "posts", label: "💬 Publicaciones", count: posts.length },
                  { id: "questions", label: "❓ Dudas", count: posts.filter(p => p.category === "Pregunta").length },
                  { id: "recommendations", label: "💡 Recomendaciones", count: posts.filter(p => p.category === "Recomendación").length },
                  { id: "milestones", label: "🏆 Logros y Muro", count: activityFeed.length },
                  { id: "profiles", label: "👥 Explorar Bóvedas", count: profiles.length },
                ] as const
              ).map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setFeedFilter(tab.id)}
                  className={`whitespace-nowrap px-3.5 py-1.5 rounded-full text-xs font-semibold transition border ${
                    feedFilter === tab.id
                      ? "border-cyan-400/40 bg-gradient-to-r from-violet-600/40 to-cyan-500/40 text-cyan-200 shadow-sm"
                      : "border-white/10 bg-white/[.04] text-slate-400 hover:text-white hover:bg-white/[.08]"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-70">({tab.count})</span>
                  )}
                </button>
              ))}
            </div>

            {/* 3. FEED CONTENT STREAM */}
            {feedFilter === "profiles" ? (
              /* PROFILES EXPLORER GRID VIEW */
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="relative max-w-md flex-1">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                    <Input
                      value={searchProfile}
                      onChange={e => setSearchProfile(e.target.value)}
                      placeholder="Buscar jugador por nombre o consola..."
                      className="border-white/10 bg-[#0b1628] pl-10 text-xs placeholder:text-slate-500 h-9"
                    />
                  </div>
                  <span className="text-xs text-slate-400 font-mono">
                    {filteredProfiles.length} colecciones públicas
                  </span>
                </div>

                {loadingProfiles ? (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {[1, 2, 3, 4].map(i => (
                      <Skeleton key={i} className="h-48 rounded-3xl bg-white/5" />
                    ))}
                  </div>
                ) : filteredProfiles.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center">
                    <Archive className="mx-auto mb-2 size-10 text-slate-500" />
                    <h3 className="font-bold text-slate-300">No se encontraron perfiles</h3>
                    <p className="mt-1 text-xs text-slate-400">
                      Prueba con otro término de búsqueda o haz pública tu propia colección.
                    </p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {filteredProfiles.map(prof => {
                      const isCurrent = prof.userId === currentUserId;
                      const initial = (prof.handle?.[0] || "G").toUpperCase();
                      return (
                        <div
                          key={prof.userId}
                          className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.02] p-4 shadow-lg transition hover:-translate-y-1 hover:border-cyan-400/40"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-2.5">
                                <Avatar className="size-11 border-2 border-cyan-400/30">
                                  <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 font-bold text-white text-sm">
                                    {initial}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <div className="flex items-center gap-1.5">
                                    <h3 className="font-bold text-slate-100 group-hover:text-cyan-300 transition text-sm">
                                      {prof.handle}
                                    </h3>
                                    {isCurrent && (
                                      <Badge variant="outline" className="text-[9px] border-cyan-400/40 text-cyan-300 px-1 py-0">
                                        Tú
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-400 line-clamp-1">
                                    {prof.bio || "Bóveda gamer"}
                                  </p>
                                </div>
                              </div>

                              <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-[10px] px-1.5 py-0">
                                Público
                              </Badge>
                            </div>

                            <div className="mt-3 grid grid-cols-3 gap-1.5 rounded-xl bg-black/25 p-2 text-center border border-white/5">
                              <div>
                                <span className="block text-[9px] text-slate-400">Juegos</span>
                                <span className="font-bold text-xs text-slate-100">{prof.stats.total}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-slate-400">Jugando</span>
                                <span className="font-bold text-xs text-cyan-300">{prof.stats.active}</span>
                              </div>
                              <div>
                                <span className="block text-[9px] text-slate-400">Terminados</span>
                                <span className="font-bold text-xs text-emerald-300">{prof.stats.done}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 pt-2.5 border-t border-white/5 flex items-center justify-between">
                            <span className="text-[10px] text-slate-500">
                              {prof.stats.hours > 0 ? `${prof.stats.hours} h jugadas` : "Colección activa"}
                            </span>
                            <Button
                              size="sm"
                              onClick={() => onViewProfile(prof.userId)}
                              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs h-7 px-3"
                            >
                              Ver Bóveda
                              <ArrowRight className="size-3 ml-1" />
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              /* UNIFIED STREAM: POSTS & ACTIVITY CARDS */
              <div className="space-y-4">
                {loadingPosts && loadingProfiles ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map(i => (
                      <Skeleton key={i} className="h-44 rounded-3xl bg-white/5" />
                    ))}
                  </div>
                ) : unifiedFeed.length === 0 ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
                    <MessageCircle className="mx-auto mb-3 size-10 text-slate-500" />
                    <h3 className="font-bold text-slate-300 text-base">Aún no hay publicaciones en esta sección</h3>
                    <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto">
                      ¡Sé el primero en iniciar la conversación! Comparte lo que estás jugando o haz una pregunta a la comunidad.
                    </p>
                    <Button
                      onClick={() => setComposerExpanded(true)}
                      className="mt-4 bg-gradient-to-r from-violet-600 to-cyan-600 text-xs font-bold"
                    >
                      <Plus className="size-3.5 mr-1" />
                      Crear primera publicación
                    </Button>
                  </div>
                ) : (
                  unifiedFeed.map(feedItem => {
                    if (feedItem.kind === "activity") {
                      const act = feedItem.item;
                      return (
                        <div
                          key={act.id}
                          className="rounded-3xl border border-white/8 bg-gradient-to-b from-white/[.04] to-white/[.01] p-4 shadow-md hover:border-white/15 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`grid size-11 shrink-0 place-items-center rounded-2xl ${
                                act.type === "completed"
                                  ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                  : "bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
                              }`}
                            >
                              {act.type === "completed" ? (
                                <Trophy className="size-5" />
                              ) : (
                                <Gamepad2 className="size-5" />
                              )}
                            </div>

                            <div className="min-w-0">
                              <div className="text-sm text-slate-200">
                                <button
                                  type="button"
                                  onClick={() => onViewProfile(act.userId)}
                                  className="font-bold text-cyan-300 hover:underline inline mr-1"
                                >
                                  {act.handle}
                                </button>
                                <span className="text-slate-300">{act.detail}</span>
                              </div>
                              <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-white/10 text-slate-300">
                                  {act.platform}
                                </Badge>
                                {act.rating && act.rating > 0 && (
                                  <span className="flex items-center gap-1 text-amber-400 font-semibold text-[11px]">
                                    <Star className="size-3 fill-amber-400" />
                                    {act.rating}/10
                                  </span>
                                )}
                                <span className="text-[10px] text-slate-500">
                                  {formatTimeAgo(act.date)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewProfile(act.userId)}
                            className="text-xs text-violet-300 hover:text-violet-200 self-end sm:self-center shrink-0 h-8"
                          >
                            Ver Bóveda
                            <ExternalLink className="size-3.5 ml-1" />
                          </Button>
                        </div>
                      );
                    }

                    // Kind === "post" (Facebook Post Card)
                    const post = feedItem.item;
                    const hasLiked = (post.likedBy || []).includes(currentUserId || "");
                    const replies = post.replies || [];
                    const isReplying = activeReplyId === post.id;
                    const replyText = replyDrafts[post.id] || "";

                    const categoryBadgeClass =
                      post.category === "Pregunta"
                        ? "border-sky-400/40 bg-sky-500/10 text-sky-300"
                        : post.category === "Recomendación"
                        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                        : post.category === "Logro"
                        ? "border-amber-400/40 bg-amber-500/10 text-amber-300"
                        : "border-violet-400/40 bg-violet-500/10 text-violet-300";

                    return (
                      <article
                        key={post.id}
                        className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.02] p-5 shadow-xl space-y-3.5 backdrop-blur-md"
                      >
                        {/* Facebook Post Header */}
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => onViewProfile(post.authorId)}
                              className="group shrink-0"
                            >
                              <Avatar className="size-10 border border-white/20 transition group-hover:border-cyan-400">
                                <AvatarImage src={post.authorPhoto} />
                                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-600 text-white font-bold text-xs">
                                  {(post.authorName?.[0] || "G").toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                            </button>

                            <div>
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => onViewProfile(post.authorId)}
                                  className="font-bold text-sm text-slate-100 hover:text-cyan-300 transition text-left"
                                >
                                  {post.authorName}
                                </button>
                                {post.authorId === currentUserId && (
                                  <Badge variant="outline" className="text-[9px] border-cyan-400/30 text-cyan-300 px-1 py-0">
                                    Tú
                                  </Badge>
                                )}
                              </div>
                              <span className="text-[11px] text-slate-400 block -mt-0.5">
                                {formatTimeAgo(post.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <Badge variant="outline" className={`text-[10px] font-semibold ${categoryBadgeClass}`}>
                              {post.category}
                            </Badge>
                            {post.platform && (
                              <Badge variant="secondary" className="text-[10px] bg-white/10 text-slate-300">
                                {post.platform}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Post Content */}
                        <div className="space-y-1.5">
                          {post.gameTitle && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-violet-500/15 border border-violet-500/30 text-xs font-bold text-violet-300">
                              <Gamepad2 className="size-3" />
                              <span>{post.gameTitle}</span>
                            </div>
                          )}

                          {post.title && post.title !== post.content && (
                            <h3 className="font-extrabold text-base text-slate-100 leading-snug">
                              {post.title}
                            </h3>
                          )}

                          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed whitespace-pre-wrap">
                            {post.content}
                          </p>
                        </div>

                        {/* Facebook Action Bar (Like / Comment / View Vault) */}
                        <div className="pt-2 border-t border-white/5 flex items-center justify-between text-xs text-slate-400">
                          <div className="flex items-center gap-2">
                            {/* Like Button */}
                            <button
                              type="button"
                              onClick={() => handleLikePost(post)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition ${
                                hasLiked
                                  ? "text-rose-400 bg-rose-500/15 font-bold shadow-sm"
                                  : "text-slate-400 hover:text-rose-300 hover:bg-white/5"
                              }`}
                            >
                              <Heart className={`size-4 ${hasLiked ? "fill-rose-400" : ""}`} />
                              <span>{post.likes > 0 ? post.likes : "Me gusta"}</span>
                            </button>

                            {/* Comment Button */}
                            <button
                              type="button"
                              onClick={() => setActiveReplyId(isReplying ? null : post.id)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-medium transition ${
                                isReplying
                                  ? "bg-white/10 text-cyan-300 font-bold"
                                  : "hover:bg-white/5 text-slate-400 hover:text-slate-200"
                              }`}
                            >
                              <MessageCircle className="size-4" />
                              <span>
                                {replies.length > 0
                                  ? `${replies.length} comentario${replies.length === 1 ? "" : "s"}`
                                  : "Comentar"}
                              </span>
                            </button>
                          </div>

                          {/* Author Vault Link */}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onViewProfile(post.authorId)}
                            className="h-8 text-xs text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 px-2"
                          >
                            <span>Ver Bóveda</span>
                            <ArrowRight className="size-3.5 ml-1" />
                          </Button>
                        </div>

                        {/* Facebook Comments Section */}
                        {isReplying && (
                          <div className="pt-3 border-t border-white/5 space-y-3">
                            {replies.length > 0 && (
                              <div className="space-y-2.5">
                                {replies.map(reply => (
                                  <div key={reply.id} className="flex items-start gap-2.5 text-xs">
                                    <Avatar className="size-7 border border-white/10 shrink-0 mt-0.5">
                                      <AvatarImage src={reply.authorPhoto} />
                                      <AvatarFallback className="bg-violet-600/30 text-white font-bold text-[10px]">
                                        {(reply.authorName?.[0] || "G").toUpperCase()}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 rounded-2xl bg-black/30 border border-white/5 px-3 py-2">
                                      <div className="flex items-center justify-between mb-0.5">
                                        <span className="font-bold text-slate-200 text-[11px]">
                                          {reply.authorName}
                                        </span>
                                        <span className="text-[10px] text-slate-500">
                                          {formatTimeAgo(reply.createdAt)}
                                        </span>
                                      </div>
                                      <p className="text-slate-300 leading-relaxed text-xs">
                                        {reply.content}
                                      </p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Inline Reply Input */}
                            <div className="flex items-center gap-2 pt-1">
                              <Avatar className="size-7 border border-white/10 shrink-0">
                                <AvatarImage src={currentUserPhoto ?? undefined} />
                                <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 text-white font-bold text-[10px]">
                                  {userInitial}
                                </AvatarFallback>
                              </Avatar>
                              <div className="relative flex-1">
                                <Input
                                  value={replyText}
                                  onChange={e =>
                                    setReplyDrafts(prev => ({ ...prev, [post.id]: e.target.value }))
                                  }
                                  onKeyDown={e => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      void handleSendReply(post.id, replies);
                                    }
                                  }}
                                  placeholder="Escribe un comentario o respuesta..."
                                  className="border-white/10 bg-black/40 text-xs pr-16 h-8 focus-visible:ring-cyan-500"
                                />
                                <Button
                                  size="sm"
                                  onClick={() => handleSendReply(post.id, replies)}
                                  disabled={!replyText.trim()}
                                  className="absolute right-1 top-1/2 -translate-y-1/2 h-6 px-2 text-[10px] font-bold bg-cyan-500 hover:bg-cyan-400 text-slate-950"
                                >
                                  Enviar
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* RIGHT SIDEBAR COLUMN: GAMERS & VAULTS (Col 4)             */}
          {/* ========================================================= */}
          <div className="lg:col-span-4 space-y-5">
            {/* Widget 1: Tu Bóveda Pública Status */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.02] p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Globe className="size-4 text-cyan-400" />
                  Tu Bóveda Pública
                </h3>
                {publicProfileSettings?.isPublic ? (
                  <Badge className="bg-emerald-500/20 border-emerald-500/40 text-emerald-300 text-[10px]">
                    Activa
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-slate-600 text-slate-400 text-[10px]">
                    Privada
                  </Badge>
                )}
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                {publicProfileSettings?.isPublic
                  ? "Tu colección gamer es visible en la comunidad. Otros jugadores pueden explorar tus juegos, horas y avances."
                  : "Tu colección es privada. Hazla pública para que otros gamers descubran tus juegos y progreso."}
              </p>

              <div className="flex items-center gap-2 pt-1">
                {currentUserId && publicProfileSettings?.isPublic && (
                  <Button
                    size="sm"
                    onClick={() => onViewProfile(currentUserId)}
                    className="flex-1 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs h-8"
                  >
                    Ver mi Bóveda
                  </Button>
                )}
                {onOpenShareSettings && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onOpenShareSettings}
                    className="flex-1 border-white/15 hover:bg-white/5 text-slate-200 text-xs h-8"
                  >
                    {publicProfileSettings?.isPublic ? "Configurar" : "Hacer Pública"}
                  </Button>
                )}
              </div>
            </div>

            {/* Widget 2: Gamers Destacados / Explorador */}
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.02] p-5 shadow-lg space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Users className="size-4 text-violet-400" />
                  Gamers de la Comunidad
                </h3>
                <span className="text-[11px] text-slate-400 font-mono">
                  {profiles.length}
                </span>
              </div>

              {/* Mini Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-slate-500" />
                <Input
                  value={searchProfile}
                  onChange={e => setSearchProfile(e.target.value)}
                  placeholder="Buscar gamer o consola..."
                  className="pl-8 text-xs border-white/10 bg-black/30 h-8"
                />
              </div>

              {/* Profiles list */}
              {loadingProfiles ? (
                <div className="space-y-2">
                  {[1, 2, 3].map(i => (
                    <Skeleton key={i} className="h-14 rounded-2xl bg-white/5" />
                  ))}
                </div>
              ) : filteredProfiles.length === 0 ? (
                <p className="text-xs text-slate-500 text-center py-2">
                  No se encontraron jugadores.
                </p>
              ) : (
                <div className="space-y-2">
                  {filteredProfiles.slice(0, 5).map(prof => {
                    const initial = (prof.handle?.[0] || "G").toUpperCase();
                    return (
                      <div
                        key={prof.userId}
                        className="flex items-center justify-between gap-2 p-2 rounded-2xl bg-white/[.02] border border-white/5 hover:border-white/10 transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar className="size-8 border border-white/15 shrink-0">
                            <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-600 text-white font-bold text-xs">
                              {initial}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <h4 className="font-bold text-xs text-slate-200 truncate">
                              {prof.handle}
                            </h4>
                            <p className="text-[10px] text-slate-400 truncate">
                              {prof.stats.total} juegos • {prof.stats.done} terminados
                            </p>
                          </div>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onViewProfile(prof.userId)}
                          className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10 h-7 px-2 shrink-0"
                        >
                          Ver
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              {profiles.length > 5 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFeedFilter("profiles")}
                  className="w-full text-xs border-white/10 hover:bg-white/5 text-slate-300 h-8"
                >
                  Explorar todas las Bóvedas ({profiles.length})
                </Button>
              )}
            </div>

            {/* Widget 3: Juegos Populares / En Tendencia */}
            {trendingGames.length > 0 && (
              <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.02] p-5 shadow-lg space-y-3">
                <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                  <Flame className="size-4 text-amber-400" />
                  Juegos en Tendencia
                </h3>
                <div className="space-y-2">
                  {trendingGames.map(game => (
                    <div
                      key={game.title}
                      className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[.02] border border-white/5 text-xs"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Gamepad2 className="size-4 text-cyan-400 shrink-0" />
                        <span className="font-medium text-slate-200 truncate">
                          {game.title}
                        </span>
                      </div>
                      <Badge variant="secondary" className="text-[10px] bg-white/10 text-slate-300 shrink-0">
                        {game.count} {game.count === 1 ? "gamer" : "gamers"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
