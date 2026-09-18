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
  MessageCircle,
  MessageSquare,
  Plus,
  Radio,
  Search,
  Send,
  Share2,
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [activeTab, setActiveTab] = useState<"profiles" | "feed" | "forum">("profiles");

  // Profiles State
  const [profiles, setProfiles] = useState<PublicProfileData[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(() => Boolean(db));
  const [searchProfile, setSearchProfile] = useState("");

  // Forum & Posts State
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(() => Boolean(db));
  const [newPostOpen, setNewPostOpen] = useState(false);
  const [submittingPost, setSubmittingPost] = useState(false);

  // New Post Form
  const [postTitle, setPostTitle] = useState("");
  const [postContent, setPostContent] = useState("");
  const [postCategory, setPostCategory] = useState<"Pregunta" | "Recomendación" | "Debate" | "Logro">("Pregunta");
  const [postGame, setPostGame] = useState("");
  const [postPlatform, setPostPlatform] = useState("");

  // Replying state (postId -> reply draft)
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

  // Filtered profiles
  const filteredProfiles = useMemo(() => {
    const q = searchProfile.trim().toLowerCase();
    if (!q) return profiles;
    return profiles.filter(p => {
      const haystack = [p.handle, p.bio, ...p.stats.consoles.map(c => c.platform)].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [profiles, searchProfile]);

  // Derived Feed of Activities from public profiles games
  const activityFeed = useMemo(() => {
    const events: Array<{
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
    }> = [];

    for (const p of profiles) {
      for (const g of p.games) {
        if (["Terminado", "Completado"].includes(g.status)) {
          events.push({
            id: `${p.userId}-${g.id}-done`,
            userId: p.userId,
            handle: p.handle,
            gameTitle: g.title,
            platform: g.platform,
            type: "completed",
            detail: `ha terminado ${g.title} con un progreso del ${g.progress}%`,
            date: g.finishedAt || g.updatedAt,
            rating: g.rating,
            coverUrl: g.coverUrl,
          });
        } else if (g.status === "Jugando" && g.progress > 0) {
          events.push({
            id: `${p.userId}-${g.id}-playing`,
            userId: p.userId,
            handle: p.handle,
            gameTitle: g.title,
            platform: g.platform,
            type: "playing",
            detail: `está jugando ${g.title} (${g.progress}%)`,
            date: g.updatedAt,
            coverUrl: g.coverUrl,
          });
        }
      }
    }

    return events
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""))
      .slice(0, 30);
  }, [profiles]);

  // Submit new post
  async function handleCreatePost() {
    if (!db) return;
    if (!currentUserId) {
      toast.error("Inicia sesión para publicar en la comunidad.");
      return;
    }
    if (!postTitle.trim() || !postContent.trim()) {
      toast.error("Por favor escribe un título y el contenido de tu publicación.");
      return;
    }

    setSubmittingPost(true);
    try {
      const created = await createCommunityPost(db, {
        authorId: currentUserId,
        authorName: currentUserName || "Gamer",
        authorPhoto: currentUserPhoto ?? undefined,
        title: postTitle.trim(),
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
      setNewPostOpen(false);
      toast.success("¡Tu pregunta o tema fue publicado en la comunidad!");
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
        prev.map(p =>
          p.id === postId ? { ...p, replies: [...(p.replies || []), reply] } : p
        )
      );

      setReplyDrafts(prev => ({ ...prev, [postId]: "" }));
      toast.success("Respuesta enviada");
    } catch (err) {
      console.error(err);
      toast.error("No se pudo enviar la respuesta.");
    }
  }

  return (
    <div className="min-h-screen bg-[#07101f] text-slate-100">
      {/* Subheader / Community Hero Banner */}
      <div className="border-b border-white/8 bg-gradient-to-b from-violet-950/40 via-[#07101f] to-[#07101f] px-4 py-8 lg:px-8">
        <div className="mx-auto max-w-[1500px]">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-cyan-500 to-violet-600 shadow-[0_0_32px_rgba(6,182,212,0.3)]">
                <Globe className="size-7 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Comunidad Gamer</h1>
                  <Badge variant="outline" className="border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
                    <Radio className="mr-1 size-3 text-cyan-400 animate-pulse" />
                    En vivo
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-400 max-w-2xl">
                  Descubre bóvedas de otros jugadores, sigue los últimos progresos y comparte dudas o recomendaciones con la comunidad.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {onOpenShareSettings && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onOpenShareSettings}
                  className="border-cyan-400/30 bg-cyan-500/10 text-cyan-200 hover:bg-cyan-500/20"
                >
                  <Share2 className="mr-1.5 size-4 text-cyan-300" />
                  {publicProfileSettings?.isPublic ? "Mi Bóveda Pública" : "Hacer mi Bóveda Pública"}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onBackToLibrary}
                className="text-slate-300 hover:text-white"
              >
                <Library className="mr-1.5 size-4" />
                Volver a mi Biblioteca
              </Button>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="mt-8">
            <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)}>
              <TabsList className="h-11 border border-white/10 bg-white/[.04] p-1">
                <TabsTrigger
                  value="profiles"
                  className="gap-2 px-4 text-xs font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white"
                >
                  <Users className="size-4" />
                  <span>Explorar Perfiles ({profiles.length})</span>
                </TabsTrigger>
                <TabsTrigger
                  value="feed"
                  className="gap-2 px-4 text-xs font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white"
                >
                  <Flame className="size-4" />
                  <span>Muro de Actividad</span>
                </TabsTrigger>
                <TabsTrigger
                  value="forum"
                  className="gap-2 px-4 text-xs font-semibold data-[state=active]:bg-gradient-to-r data-[state=active]:from-violet-600 data-[state=active]:to-cyan-600 data-[state=active]:text-white"
                >
                  <MessageSquare className="size-4" />
                  <span>Preguntas y Debates</span>
                  {posts.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] bg-white/15">
                      {posts.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Tab Contents */}
      <main className="mx-auto max-w-[1500px] px-4 py-8 lg:px-8">
        {/* TAB 1: PERFILES Y BÓVEDAS PÚBLICAS */}
        {activeTab === "profiles" && (
          <div className="space-y-6">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="relative max-w-md flex-1">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <Input
                  value={searchProfile}
                  onChange={e => setSearchProfile(e.target.value)}
                  placeholder="Buscar jugador por nombre o consola favorita…"
                  className="border-white/10 bg-[#0b1628] pl-10 text-sm placeholder:text-slate-500"
                />
              </div>
              <span className="text-xs text-slate-400 font-mono">
                {filteredProfiles.length} colecciones públicas encontradas
              </span>
            </div>

            {loadingProfiles ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Skeleton key={i} className="h-56 rounded-3xl bg-white/5" />
                ))}
              </div>
            ) : filteredProfiles.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
                <Archive className="mx-auto mb-3 size-12 text-slate-500" />
                <h3 className="text-lg font-bold text-slate-200">No hay perfiles que coincidan</h3>
                <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
                  Sé el primero en compartir tu colección activando &quot;Hacer mi Bóveda Pública&quot; arriba.
                </p>
                {onOpenShareSettings && (
                  <Button
                    className="mt-4 bg-violet-600 hover:bg-violet-700 font-semibold"
                    onClick={onOpenShareSettings}
                  >
                    Configurar mi Bóveda Pública
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {filteredProfiles.map(prof => {
                  const isCurrent = prof.userId === currentUserId;
                  const initial = (prof.handle?.[0] || "G").toUpperCase();
                  return (
                    <div
                      key={prof.userId}
                      className="group relative flex flex-col justify-between overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white/[.06] to-white/[.02] p-5 shadow-lg transition hover:-translate-y-1 hover:border-cyan-400/40"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <Avatar className="size-12 border-2 border-cyan-400/30">
                              <AvatarFallback className="bg-gradient-to-br from-violet-600 to-cyan-500 font-bold text-white text-base">
                                {initial}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <h3 className="font-bold text-slate-100 group-hover:text-cyan-300 transition">
                                  {prof.handle}
                                </h3>
                                {isCurrent && (
                                  <Badge variant="outline" className="text-[10px] border-cyan-400/40 text-cyan-300">
                                    Tú
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-slate-400 line-clamp-1">
                                {prof.bio || "Bóveda gamer"}
                              </p>
                            </div>
                          </div>

                          <Badge className="border-emerald-500/30 bg-emerald-500/15 text-emerald-300 text-[11px]">
                            Público
                          </Badge>
                        </div>

                        {/* Stats counters */}
                        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-black/25 p-3 text-center border border-white/5">
                          <div>
                            <span className="block text-[10px] text-slate-400">Juegos</span>
                            <span className="font-bold text-sm text-slate-100">{prof.stats.total}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400">Jugando</span>
                            <span className="font-bold text-sm text-cyan-300">{prof.stats.active}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] text-slate-400">Terminados</span>
                            <span className="font-bold text-sm text-emerald-300">{prof.stats.done}</span>
                          </div>
                        </div>

                        {/* Top consoles */}
                        {prof.stats.consoles.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {prof.stats.consoles.slice(0, 3).map(c => (
                              <Badge
                                key={c.platform}
                                variant="secondary"
                                className="text-[10px] bg-white/[.04] text-slate-300"
                              >
                                {c.platform} ({c.count})
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between">
                        <span className="text-[11px] text-slate-500">
                          {prof.stats.hours > 0 ? `${prof.stats.hours} horas jugadas` : "Colección activa"}
                        </span>
                        <Button
                          size="sm"
                          onClick={() => onViewProfile(prof.userId)}
                          className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs h-8"
                        >
                          Ver Bóveda
                          <ArrowRight className="size-3.5 ml-1" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: MURO DE ACTIVIDAD EN VIVO */}
        {activeTab === "feed" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Logros y partidas recientes</h2>
                <p className="text-xs text-slate-400">
                  Actividades registradas por los miembros con bóvedas públicas activas.
                </p>
              </div>
              <Badge variant="outline" className="border-violet-400/30 text-violet-300 text-xs">
                {activityFeed.length} actividades
              </Badge>
            </div>

            {activityFeed.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
                <Flame className="mx-auto mb-3 size-10 text-slate-500" />
                <h3 className="font-bold text-slate-300">Aún no hay actividad comunitaria</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Los progresos y juegos terminados de los perfiles públicos aparecerán automáticamente aquí.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {activityFeed.map(act => (
                  <div
                    key={act.id}
                    className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[.03] p-4 transition hover:border-white/15"
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <div
                        className={`grid size-11 shrink-0 place-items-center rounded-xl ${
                          act.type === "completed"
                            ? "bg-emerald-500/20 text-emerald-300"
                            : "bg-cyan-500/20 text-cyan-300"
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
                          <span>{act.detail}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {act.platform}
                          </Badge>
                          {act.rating && act.rating > 0 && (
                            <span className="flex items-center gap-1 text-amber-400 font-semibold">
                              <Star className="size-3 fill-amber-400" />
                              {act.rating}/10
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewProfile(act.userId)}
                      className="text-xs text-violet-300 hover:text-violet-200 shrink-0"
                    >
                      Ver Bóveda
                      <ExternalLink className="size-3.5 ml-1" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: PREGUNTAS Y DEBATES GAMER (FORO) */}
        {activeTab === "forum" && (
          <div className="max-w-3xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-slate-100">Preguntas, Dudas y Debates</h2>
                <p className="text-xs text-slate-400">
                  Pregunta sobre juegos, pide consejos para jefes o comparte tus mejores recomendaciones.
                </p>
              </div>
              <Button
                onClick={() => setNewPostOpen(prev => !prev)}
                className="bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-bold text-xs"
              >
                <Plus className="size-4 mr-1" />
                Hacer una pregunta
              </Button>
            </div>

            {/* Formulario para nueva pregunta/debate */}
            {newPostOpen && (
              <div className="rounded-3xl border border-cyan-400/30 bg-[#0b1628] p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-cyan-300 flex items-center gap-2">
                    <HelpCircle className="size-4" />
                    Publicar una nueva duda o tema de debate
                  </h3>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setNewPostOpen(false)}
                    className="h-7 px-2 text-xs"
                  >
                    Cancelar
                  </Button>
                </div>

                <div className="grid gap-3">
                  <div>
                    <Label className="text-xs text-slate-300">Título de la pregunta o debate</Label>
                    <Input
                      value={postTitle}
                      onChange={e => setPostTitle(e.target.value)}
                      placeholder="Ej. ¿Vale la pena jugar Cyberpunk 2077 en 2026? / ¿Cómo vencer a Malenia?"
                      className="border-white/10 bg-black/30 text-sm mt-1"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-xs text-slate-300">Categoría</Label>
                      <Select
                        value={postCategory}
                        onValueChange={v => setPostCategory(v as typeof postCategory)}
                      >
                        <SelectTrigger className="border-white/10 bg-black/30 text-xs mt-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Pregunta">Pregunta / Duda</SelectItem>
                          <SelectItem value="Recomendación">Recomendación</SelectItem>
                          <SelectItem value="Debate">Debate Gamer</SelectItem>
                          <SelectItem value="Logro">Logro o Hito</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300">Juego (opcional)</Label>
                      <Input
                        value={postGame}
                        onChange={e => setPostGame(e.target.value)}
                        placeholder="Ej. Elden Ring"
                        className="border-white/10 bg-black/30 text-xs mt-1"
                      />
                    </div>

                    <div>
                      <Label className="text-xs text-slate-300">Plataforma (opcional)</Label>
                      <Input
                        value={postPlatform}
                        onChange={e => setPostPlatform(e.target.value)}
                        placeholder="Ej. PC, Switch, PS2"
                        className="border-white/10 bg-black/30 text-xs mt-1"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-300">Descripción o detalles</Label>
                    <Textarea
                      value={postContent}
                      onChange={e => setPostContent(e.target.value)}
                      placeholder="Cuéntanos más contexto sobre tu duda o lo que quieres debatir..."
                      className="min-h-24 border-white/10 bg-black/30 text-xs leading-5 mt-1"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      onClick={handleCreatePost}
                      disabled={submittingPost}
                      className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs"
                    >
                      <Send className="size-3.5 mr-1" />
                      {submittingPost ? "Publicando…" : "Publicar en la Comunidad"}
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Lista de posts */}
            {loadingPosts ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <Skeleton key={i} className="h-40 rounded-3xl bg-white/5" />
                ))}
              </div>
            ) : posts.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
                <MessageCircle className="mx-auto mb-3 size-10 text-slate-500" />
                <h3 className="font-bold text-slate-300">No hay debates aún</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Sé el primero en iniciar una conversación con la comunidad gamer.
                </p>
                <Button
                  onClick={() => setNewPostOpen(true)}
                  className="mt-4 bg-violet-600 hover:bg-violet-700 text-xs font-bold"
                >
                  Publicar primera pregunta
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                {posts.map(post => {
                  const hasLiked = (post.likedBy || []).includes(currentUserId || "");
                  const replies = post.replies || [];
                  const isReplying = activeReplyId === post.id;
                  const replyText = replyDrafts[post.id] || "";

                  return (
                    <article
                      key={post.id}
                      className="rounded-3xl border border-white/10 bg-white/[.03] p-5 shadow-lg space-y-4"
                    >
                      {/* Post Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="size-9 border border-white/15">
                            <AvatarImage src={post.authorPhoto} />
                            <AvatarFallback className="bg-violet-500/20 text-violet-200 text-xs font-bold">
                              {(post.authorName?.[0] || "G").toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <span className="font-semibold text-xs text-slate-200 block">
                              {post.authorName}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Intl.DateTimeFormat("es", {
                                dateStyle: "short",
                                timeStyle: "short",
                              }).format(new Date(post.createdAt))}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="border-cyan-400/30 text-cyan-300 text-[10px]">
                            {post.category}
                          </Badge>
                          {post.platform && (
                            <Badge variant="secondary" className="text-[10px]">
                              {post.platform}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Post Content */}
                      <div>
                        {post.gameTitle && (
                          <div className="flex items-center gap-1.5 text-xs font-bold text-violet-300 mb-1">
                            <Tag className="size-3" />
                            <span>{post.gameTitle}</span>
                          </div>
                        )}
                        <h3 className="font-bold text-base text-slate-100">{post.title}</h3>
                        <p className="mt-1.5 text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">
                          {post.content}
                        </p>
                      </div>

                      {/* Post Actions (Like, Reply count) */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs text-slate-400">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => handleLikePost(post)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition ${
                              hasLiked
                                ? "text-rose-400 bg-rose-500/10 font-bold"
                                : "text-slate-400 hover:text-rose-300 hover:bg-white/5"
                            }`}
                          >
                            <Heart className={`size-3.5 ${hasLiked ? "fill-rose-400" : ""}`} />
                            <span>{post.likes || 0}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveReplyId(isReplying ? null : post.id)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 text-slate-400 hover:text-slate-200 transition"
                          >
                            <MessageCircle className="size-3.5" />
                            <span>{replies.length} respuestas</span>
                          </button>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setActiveReplyId(isReplying ? null : post.id)}
                          className="h-7 text-xs text-cyan-300 hover:text-cyan-200"
                        >
                          {isReplying ? "Ocultar respuestas" : "Responder"}
                        </Button>
                      </div>

                      {/* Replies List & Form */}
                      {isReplying && (
                        <div className="pt-3 border-t border-white/5 space-y-3">
                          {replies.length > 0 && (
                            <div className="space-y-2 pl-3 border-l-2 border-white/10">
                              {replies.map(reply => (
                                <div key={reply.id} className="rounded-xl bg-black/20 p-2.5 text-xs">
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="font-bold text-slate-200">
                                      {reply.authorName}
                                    </span>
                                    <span className="text-[10px] text-slate-500">
                                      {new Intl.DateTimeFormat("es", {
                                        dateStyle: "short",
                                        timeStyle: "short",
                                      }).format(new Date(reply.createdAt))}
                                    </span>
                                  </div>
                                  <p className="text-slate-300 leading-relaxed">{reply.content}</p>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add Reply Input */}
                          <div className="flex gap-2">
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
                              placeholder="Escribe un consejo o respuesta a esta duda..."
                              className="border-white/10 bg-black/30 text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleSendReply(post.id, replies)}
                              className="bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shrink-0"
                            >
                              <Send className="size-3 mr-1" />
                              Responder
                            </Button>
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
