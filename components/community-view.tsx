"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Firestore } from "firebase/firestore";
import { Archive, Camera, Check, Flame, Gamepad2, Globe2, Heart, ImageIcon, Library, MessageCircle, Plus, Search, Send, Share2, Sparkles, Trophy, UserMinus, UserPlus, Users, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import type { Game } from "@/lib/game-types";
import { acceptFriendRequest, addCommunityReply, createCommunityPost, fetchAllPublicProfiles, fetchCommunityPosts, fetchFriendships, removeFriendship, sendFriendRequest, togglePostLike, type CommunityPost, type Friendship, type PublicProfileData, type PublicProfileSettings } from "@/lib/share";

interface CommunityViewProps {
  db: Firestore | null;
  currentUserId?: string | null;
  currentUserName?: string | null;
  currentUserPhoto?: string | null;
  currentUserGames?: Game[];
  gameToShare?: Game | null;
  onGameShareConsumed?: () => void;
  publicProfileSettings?: PublicProfileSettings;
  onOpenShareSettings?: () => void;
  onViewProfile: (userId: string) => void;
  onBackToLibrary: () => void;
}

type FeedFilter = "all" | "questions" | "milestones" | "profiles" | "friends";
type ActivityEvent = { id: string; userId: string; handle: string; gameTitle: string; platform: string; date: string; progress: number };
type FeedItem = { kind: "post"; date: string; item: CommunityPost } | { kind: "activity"; date: string; item: ActivityEvent };

function timeAgo(value?: string) {
  if (!value) return "ahora";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
  if (seconds < 60) return "ahora";
  if (seconds < 3600) return `hace ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `hace ${Math.floor(seconds / 3600)} h`;
  if (seconds < 604800) return `hace ${Math.floor(seconds / 86400)} d`;
  return new Intl.DateTimeFormat("es", { day: "numeric", month: "short" }).format(new Date(time));
}

function initials(name?: string | null) {
  return (name || "G").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}

async function compressScreenshot(file: File): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("invalid-type");
  if (file.size > 10 * 1024 * 1024) throw new Error("too-large");
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(image.width * scale));
  canvas.height = Math.max(1, Math.round(image.height * scale));
  const context = canvas.getContext("2d");
  context?.drawImage(image, 0, 0, canvas.width, canvas.height);
  let quality = 0.78;
  let result = canvas.toDataURL("image/jpeg", quality);
  while (result.length > 650_000 && quality > 0.42) {
    quality -= 0.08;
    result = canvas.toDataURL("image/jpeg", quality);
  }
  return result;
}

export function CommunityView({ db, currentUserId, currentUserName = "Gamer", currentUserPhoto, currentUserGames = [], gameToShare, onGameShareConsumed, publicProfileSettings, onOpenShareSettings, onViewProfile, onBackToLibrary }: CommunityViewProps) {
  const screenshotInput = useRef<HTMLInputElement>(null);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [profiles, setProfiles] = useState<PublicProfileData[]>([]);
  const [posts, setPosts] = useState<CommunityPost[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(Boolean(db));
  const [loadingPosts, setLoadingPosts] = useState(Boolean(db));
  const [profileSearch, setProfileSearch] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [category, setCategory] = useState<CommunityPost["category"]>("Debate");
  const [content, setContent] = useState("");
  const [selectedGameId, setSelectedGameId] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [processingImage, setProcessingImage] = useState(false);
  const [activeReplyId, setActiveReplyId] = useState<string | null>(null);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [friendshipsLoading, setFriendshipsLoading] = useState(Boolean(db && currentUserId));

  useEffect(() => {
    if (!db) return;
    let mounted = true;
    void Promise.allSettled([fetchCommunityPosts(db), fetchAllPublicProfiles(db)]).then(results => {
      if (!mounted) return;
      if (results[0].status === "fulfilled") setPosts(results[0].value);
      if (results[1].status === "fulfilled") setProfiles(results[1].value);
      setLoadingPosts(false);
      setLoadingProfiles(false);
    });
    return () => { mounted = false; };
  }, [db]);

  useEffect(() => {
    if (!db || !currentUserId) return;
    let mounted = true;
    void fetchFriendships(db, currentUserId)
      .then(items => { if (mounted) setFriendships(items); })
      .catch(() => toast.error("No pudimos cargar tus amistades."))
      .finally(() => { if (mounted) setFriendshipsLoading(false); });
    return () => { mounted = false; };
  }, [db, currentUserId]);

  useEffect(() => {
    if (!gameToShare) return;
    let mounted = true;
    queueMicrotask(() => {
      if (!mounted) return;
      setSelectedGameId(gameToShare.id);
      setCategory(["Terminado", "Completado"].includes(gameToShare.status) ? "Logro" : "Debate");
      setComposerOpen(true);
      onGameShareConsumed?.();
    });
    return () => { mounted = false; };
  }, [gameToShare, onGameShareConsumed]);

  const selectedGame = currentUserGames.find(game => game.id === selectedGameId);
  const activities = useMemo<ActivityEvent[]>(() => profiles.flatMap(profile => profile.games.filter(game => game.status === "Jugando" || ["Terminado", "Completado"].includes(game.status)).map(game => ({ id: `${profile.userId}-${game.id}-${game.updatedAt}`, userId: profile.userId, handle: profile.handle, gameTitle: game.title, platform: game.platform, date: game.finishedAt || game.updatedAt, progress: game.progress }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 20), [profiles]);
  const feed = useMemo<FeedItem[]>(() => {
    const postItems: FeedItem[] = posts.filter(post => filter === "all" || (filter === "questions" && post.category === "Pregunta") || (filter === "milestones" && post.category === "Logro")).map(item => ({ kind: "post", item, date: item.createdAt }));
    const activityItems: FeedItem[] = filter === "all" || filter === "milestones" ? activities.map(item => ({ kind: "activity", item, date: item.date })) : [];
    return [...postItems, ...activityItems].sort((a, b) => b.date.localeCompare(a.date));
  }, [activities, filter, posts]);
  const visibleProfiles = useMemo(() => {
    const query = profileSearch.trim().toLowerCase();
    if (!query) return profiles;
    return profiles.filter(profile => [profile.handle, profile.bio, ...profile.stats.consoles.map(item => item.platform)].join(" ").toLowerCase().includes(query));
  }, [profileSearch, profiles]);
  const trending = useMemo(() => {
    const counts = new Map<string, number>();
    profiles.forEach(profile => profile.games.forEach(game => counts.set(game.title, (counts.get(game.title) || 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  }, [profiles]);
  const relationshipByUser = useMemo(() => {
    const map = new Map<string, Friendship>();
    if (!currentUserId) return map;
    friendships.forEach(friendship => {
      const otherId = friendship.memberIds.find(id => id !== currentUserId);
      if (otherId) map.set(otherId, friendship);
    });
    return map;
  }, [friendships, currentUserId]);

  async function requestFriend(profile: PublicProfileData) {
    if (!db || !currentUserId) { toast.info("Inicia sesión para enviar solicitudes."); return; }
    try {
      const item = await sendFriendRequest(db, { id: currentUserId, name: currentUserName || "Gamer" }, { id: profile.userId, name: profile.handle });
      setFriendships(previous => [...previous.filter(friendship => friendship.id !== item.id), item]);
      toast.success(item.status === "accepted" ? `Ahora tú y ${profile.handle} son amigos.` : `Solicitud enviada a ${profile.handle}.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.includes("already-friends")) toast.info("Ya son amigos.");
      else if (message.includes("request-pending")) toast.info("La solicitud ya está pendiente.");
      else toast.error("No se pudo enviar la solicitud.");
    }
  }

  async function accept(friendship: Friendship) {
    if (!db || !currentUserId) return;
    try {
      const updated = await acceptFriendRequest(db, friendship, currentUserId);
      setFriendships(previous => previous.map(item => item.id === updated.id ? updated : item));
      toast.success("Solicitud aceptada.");
    } catch { toast.error("No se pudo aceptar la solicitud."); }
  }

  async function remove(friendship: Friendship) {
    if (!db) return;
    try {
      await removeFriendship(db, friendship.id);
      setFriendships(previous => previous.filter(item => item.id !== friendship.id));
      toast.success(friendship.status === "accepted" ? "Amistad eliminada." : "Solicitud descartada.");
    } catch { toast.error("No se pudo actualizar la solicitud."); }
  }

  function openComposer(nextCategory: CommunityPost["category"] = "Debate") {
    if (!currentUserId) { toast.info("Inicia sesión para publicar en la comunidad."); return; }
    setCategory(nextCategory);
    setComposerOpen(true);
  }

  async function handleScreenshot(file?: File) {
    if (!file) return;
    setProcessingImage(true);
    try { setAttachmentUrl(await compressScreenshot(file)); setComposerOpen(true); }
    catch { toast.error("Usa una imagen JPG, PNG o WebP de hasta 10 MB."); }
    finally { setProcessingImage(false); if (screenshotInput.current) screenshotInput.current.value = ""; }
  }

  async function publish() {
    if (!db || !currentUserId) return;
    if (!content.trim() && !selectedGame && !attachmentUrl) { toast.error("Escribe algo o adjunta un juego o captura."); return; }
    setSubmitting(true);
    try {
      const fallback = selectedGame ? `Estoy jugando ${selectedGame.title}.` : "Compartió una captura con la comunidad.";
      const created = await createCommunityPost(db, {
        authorId: currentUserId, authorName: currentUserName || "Gamer", authorPhoto: currentUserPhoto || undefined, title: "", content: content.trim() || fallback, category,
        gameTitle: selectedGame?.title, platform: selectedGame?.platform, attachmentUrl: attachmentUrl || undefined,
        sharedGame: selectedGame ? { id: selectedGame.id, title: selectedGame.title, platform: selectedGame.platform, status: selectedGame.status, progress: selectedGame.progress, hours: selectedGame.hours, rating: selectedGame.rating, coverUrl: selectedGame.coverUrl || undefined } : undefined,
      });
      setPosts(previous => [created, ...previous]);
      setContent(""); setSelectedGameId(""); setAttachmentUrl(""); setComposerOpen(false); setFilter("all");
      toast.success("Publicado en Comunidad Gamer");
    } catch (error) {
      console.error("Error al publicar en Comunidad Gamer:", error);
      const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
      if (code.includes("permission-denied")) {
        toast.error("No tienes permiso para publicar. Cierra sesión, vuelve a entrar e inténtalo de nuevo.");
      } else if (code.includes("unavailable") || !navigator.onLine) {
        toast.error("No hay conexión con el servidor. Comprueba tu internet e inténtalo de nuevo.");
      } else {
        toast.error("No pudimos publicar ahora. Inténtalo de nuevo en unos segundos.");
      }
    }
    finally { setSubmitting(false); }
  }

  async function like(post: CommunityPost) {
    if (!db || !currentUserId) { toast.info("Inicia sesión para reaccionar."); return; }
    try { const result = await togglePostLike(db, post.id, currentUserId, post.likes || 0, post.likedBy || []); setPosts(previous => previous.map(item => item.id === post.id ? { ...item, ...result } : item)); }
    catch { toast.error("No se pudo guardar tu reacción."); }
  }

  async function reply(post: CommunityPost) {
    if (!db || !currentUserId) { toast.info("Inicia sesión para comentar."); return; }
    const text = (replyDrafts[post.id] || "").trim(); if (!text) return;
    try {
      const created = await addCommunityReply(db, post.id, post.replies || [], { authorId: currentUserId, authorName: currentUserName || "Gamer", authorPhoto: currentUserPhoto || undefined, content: text });
      setPosts(previous => previous.map(item => item.id === post.id ? { ...item, replies: [...(item.replies || []), created] } : item));
      setReplyDrafts(previous => ({ ...previous, [post.id]: "" }));
    } catch { toast.error("No se pudo publicar el comentario."); }
  }

  async function sharePost(post: CommunityPost) {
    const url = `${window.location.href.split("#")[0]}#publicacion-${post.id}`;
    const data = { title: `${post.authorName} en Mi Bóveda Gamer`, text: post.content, url };
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(`${data.text}\n${url}`); toast.success("Enlace copiado"); } }
    catch (error) { if ((error as DOMException)?.name !== "AbortError") toast.error("No se pudo compartir."); }
  }

  const navItems: Array<{ id: FeedFilter; label: string; icon: typeof Globe2 }> = [
    { id: "all", label: "Para ti", icon: Sparkles }, { id: "questions", label: "Preguntas", icon: MessageCircle }, { id: "milestones", label: "Logros", icon: Trophy }, { id: "profiles", label: "Jugadores", icon: Users }, { id: "friends", label: "Amigos", icon: UserPlus },
  ];

  return (
    <div className="min-h-[calc(100vh-72px)] bg-[#07101f] text-slate-100">
      <input ref={screenshotInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={event => void handleScreenshot(event.target.files?.[0])} />
      <div className="mx-auto max-w-[1500px] px-3 py-5 sm:px-4 lg:px-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><p className="text-sm font-semibold text-cyan-300">Tu espacio social</p><h1 className="mt-1 text-3xl font-black tracking-[-.04em]">Comunidad Gamer</h1><p className="mt-1 max-w-2xl text-sm text-slate-400">Comparte lo que juegas, tus capturas y esos momentos que merecen conversación.</p></div>
          <Button onClick={() => openComposer()} className="hidden bg-violet-500 text-white hover:bg-violet-400 sm:flex"><Plus />Publicar</Button>
        </div>
        <div className="scrollbar-none -mx-3 mb-4 flex snap-x gap-2 overflow-x-auto px-3 pb-1 sm:-mx-4 sm:px-4 lg:hidden">{navItems.map(item => <Button key={item.id} size="sm" variant="outline" onClick={() => setFilter(item.id)} className={`shrink-0 snap-start ${filter === item.id ? "border-cyan-400/40 bg-cyan-400/10 text-cyan-200" : "border-white/10"}`}><item.icon className="size-4" />{item.label}</Button>)}</div>
        <div className="grid items-start gap-5 lg:grid-cols-[210px_minmax(0,700px)_minmax(260px,1fr)] xl:gap-7">
          <aside className="sticky top-24 hidden space-y-2 lg:block">
            {navItems.map(item => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold transition ${filter === item.id ? "border border-cyan-400/20 bg-gradient-to-r from-violet-500/20 to-cyan-400/10 text-white" : "text-slate-400 hover:bg-white/[.05] hover:text-slate-100"}`}><item.icon className={`size-5 ${filter === item.id ? "text-cyan-300" : "text-slate-500"}`} />{item.label}</button>)}
            <div className="my-3 border-t border-white/8" />
            <button type="button" onClick={onBackToLibrary} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-400 transition hover:bg-white/[.05] hover:text-white"><Library className="size-5 text-violet-300" />Mi biblioteca</button>
            {onOpenShareSettings && <button type="button" onClick={onOpenShareSettings} className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-semibold text-slate-400 transition hover:bg-white/[.05] hover:text-white"><Globe2 className="size-5 text-cyan-300" />Perfil público</button>}
          </aside>

          <main className="min-w-0 space-y-4">
            {filter !== "profiles" && filter !== "friends" && <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#0b1628] shadow-[0_18px_50px_rgba(0,0,0,.18)]">
              <div className="flex gap-2.5 p-3 sm:gap-3 sm:p-5">
                <Avatar className="size-9 shrink-0 border border-white/15 sm:size-11"><AvatarImage src={currentUserPhoto || undefined} alt={currentUserName || "Gamer"} /><AvatarFallback className="bg-gradient-to-br from-violet-500 to-cyan-500 font-bold text-white">{initials(currentUserName)}</AvatarFallback></Avatar>
                <div className="min-w-0 flex-1">{composerOpen ? <div className="space-y-3">
                  <Textarea autoFocus value={content} onChange={event => setContent(event.target.value)} placeholder="¿Qué está pasando en tu partida?" rows={3} maxLength={3000} className="resize-none border-0 bg-transparent p-0 text-base leading-7 shadow-none focus-visible:ring-0" />
                  {selectedGame && <GameShareCard game={selectedGame} onRemove={() => setSelectedGameId("")} />}
                  {attachmentUrl && <div className="relative overflow-hidden rounded-2xl border border-white/10"><img src={attachmentUrl} alt="Captura para publicar" className="max-h-[430px] w-full bg-black/30 object-contain" /><Button size="icon-sm" variant="secondary" aria-label="Quitar captura" onClick={() => setAttachmentUrl("")} className="absolute right-2 top-2 rounded-full bg-black/70"><X /></Button></div>}
                  <div className="grid gap-2 sm:grid-cols-2"><label className="sr-only" htmlFor="community-game">Juego de tu biblioteca</label><select id="community-game" value={selectedGameId} onChange={event => setSelectedGameId(event.target.value)} className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-[#07101f] px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/50"><option value="">Adjuntar juego de mi biblioteca</option>{currentUserGames.map(game => <option key={game.id} value={game.id}>{game.title} · {game.platform}</option>)}</select><select aria-label="Tipo de publicación" value={category} onChange={event => setCategory(event.target.value as CommunityPost["category"])} className="h-10 w-full min-w-0 rounded-xl border border-white/10 bg-[#07101f] px-3 text-sm text-slate-200 outline-none focus:border-cyan-400/50"><option value="Debate">Conversación</option><option value="Pregunta">Pregunta</option><option value="Recomendación">Recomendación</option><option value="Logro">Logro</option></select></div>
                  <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/8 pt-3"><div className="flex min-w-0 items-center"><Button variant="ghost" size="sm" onClick={() => screenshotInput.current?.click()} disabled={processingImage} className="px-2 text-slate-300 hover:text-cyan-200 sm:px-3"><Camera className="text-cyan-300" />{processingImage ? "Preparando…" : "Captura"}</Button><Button variant="ghost" size="sm" onClick={() => setComposerOpen(false)} className="px-2 text-slate-400 sm:px-3">Cancelar</Button></div><Button size="sm" onClick={() => void publish()} disabled={submitting || processingImage || (!content.trim() && !selectedGame && !attachmentUrl)} className="ml-auto bg-cyan-400 font-bold text-slate-950 hover:bg-cyan-300"><Send />{submitting ? "Publicando…" : "Publicar"}</Button></div>
                </div> : <button type="button" onClick={() => openComposer()} className="flex min-h-11 w-full items-center rounded-2xl bg-white/[.055] px-4 text-left text-sm text-slate-400 transition hover:bg-white/[.08] hover:text-slate-200">Comparte una partida, captura, pregunta o descubrimiento…</button>}</div>
              </div>
              {!composerOpen && <div className="grid grid-cols-3 border-t border-white/8"><ComposerAction icon={Gamepad2} label="Juego" onClick={() => openComposer("Recomendación")} /><ComposerAction icon={ImageIcon} label="Captura" onClick={() => { if (!currentUserId) return openComposer(); screenshotInput.current?.click(); }} /><ComposerAction icon={Trophy} label="Logro" onClick={() => openComposer("Logro")} /></div>}
            </section>}
            {filter === "profiles" ? <ProfilesExplorer profiles={visibleProfiles} loading={loadingProfiles} query={profileSearch} setQuery={setProfileSearch} currentUserId={currentUserId} relationships={relationshipByUser} onRequestFriend={profile => void requestFriend(profile)} onAccept={friendship => void accept(friendship)} onViewProfile={onViewProfile} /> : filter === "friends" ? <FriendsPanel friendships={friendships} loading={friendshipsLoading} currentUserId={currentUserId} onAccept={friendship => void accept(friendship)} onRemove={friendship => void remove(friendship)} onViewProfile={onViewProfile} /> : loadingPosts || loadingProfiles ? [1, 2, 3].map(item => <Skeleton key={item} className="h-56 rounded-3xl bg-white/5" />) : feed.length === 0 ? <section className="rounded-3xl border border-dashed border-white/12 px-6 py-14 text-center"><MessageCircle className="mx-auto size-9 text-slate-500" /><h2 className="mt-3 font-bold">Aquí puede empezar una buena conversación</h2><p className="mx-auto mt-1 max-w-sm text-sm text-slate-400">Comparte una partida o haz la primera pregunta.</p><Button className="mt-4 bg-violet-500 hover:bg-violet-400" onClick={() => openComposer()}><Plus />Crear publicación</Button></section> : feed.map(entry => entry.kind === "post" ? <PostCard key={`post-${entry.item.id}`} post={entry.item} currentUserId={currentUserId} activeReplyId={activeReplyId} replyDraft={replyDrafts[entry.item.id] || ""} currentUserName={currentUserName} currentUserPhoto={currentUserPhoto} onViewProfile={onViewProfile} onLike={() => void like(entry.item)} onShare={() => void sharePost(entry.item)} onToggleReplies={() => setActiveReplyId(activeReplyId === entry.item.id ? null : entry.item.id)} onReplyChange={value => setReplyDrafts(previous => ({ ...previous, [entry.item.id]: value }))} onReply={() => void reply(entry.item)} /> : <ActivityCard key={`activity-${entry.item.id}`} activity={entry.item} onViewProfile={onViewProfile} />)}
          </main>

          <aside className="sticky top-24 hidden space-y-4 xl:block">
            <section className="rounded-3xl border border-white/8 bg-white/[.035] p-5"><div className="flex items-center justify-between"><h2 className="font-bold">Tu perfil gamer</h2><Badge className={publicProfileSettings?.isPublic ? "bg-emerald-400/10 text-emerald-300" : "bg-white/8 text-slate-400"}>{publicProfileSettings?.isPublic ? "Público" : "Privado"}</Badge></div><p className="mt-2 text-sm leading-6 text-slate-400">{publicProfileSettings?.isPublic ? "Tu biblioteca ya forma parte de la comunidad." : "Haz visible tu biblioteca para que otros jugadores descubran tus partidas."}</p>{onOpenShareSettings && <Button variant="outline" className="mt-4 w-full border-white/10" onClick={onOpenShareSettings}><Globe2 className="text-cyan-300" />{publicProfileSettings?.isPublic ? "Configurar perfil" : "Activar perfil público"}</Button>}</section>
            <section className="rounded-3xl border border-white/8 bg-white/[.035] p-5"><div className="flex items-center justify-between"><h2 className="flex items-center gap-2 font-bold"><Users className="size-4 text-violet-300" />Jugadores</h2><button type="button" className="text-xs font-semibold text-cyan-300" onClick={() => setFilter("profiles")}>Ver todos</button></div><div className="mt-4 space-y-3">{profiles.slice(0, 4).map(profile => <button key={profile.userId} type="button" onClick={() => onViewProfile(profile.userId)} className="flex w-full items-center gap-3 text-left"><Avatar className="size-9 border border-white/10"><AvatarFallback className="bg-violet-500/15 text-violet-200">{initials(profile.handle)}</AvatarFallback></Avatar><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{profile.handle}</span><span className="block text-xs text-slate-500">{profile.stats.active} jugando · {profile.stats.done} terminados</span></span></button>)}{!profiles.length && <p className="text-sm text-slate-500">Aún no hay perfiles públicos.</p>}</div></section>
            {trending.length > 0 && <section className="rounded-3xl border border-white/8 bg-white/[.035] p-5"><h2 className="flex items-center gap-2 font-bold"><Flame className="size-4 text-amber-300" />En la comunidad</h2><div className="mt-3 space-y-3">{trending.map(([title, count], index) => <div key={title} className="flex items-start gap-3"><span className="text-xs font-black text-slate-600">{String(index + 1).padStart(2, "0")}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{title}</span><span className="text-xs text-slate-500">{count} {count === 1 ? "jugador" : "jugadores"}</span></span></div>)}</div></section>}
          </aside>
        </div>
      </div>
    </div>
  );
}

function ComposerAction({ icon: Icon, label, onClick }: { icon: typeof Gamepad2; label: string; onClick: () => void }) { return <button type="button" onClick={onClick} className="flex items-center justify-center gap-2 py-3 text-sm font-semibold text-slate-400 transition hover:bg-white/[.04] hover:text-white"><Icon className="size-4 text-cyan-300" />{label}</button>; }

function GameShareCard({ game, onRemove }: { game: Game; onRemove: () => void }) {
  return <div className="flex min-w-0 gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/8 p-2.5 sm:gap-3 sm:p-3"><div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg bg-white/5">{game.coverUrl ? <div className="h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(game.coverUrl).slice(1, -1)})` }} /> : <div className="grid h-full place-items-center"><Gamepad2 className="text-slate-500" /></div>}</div><div className="min-w-0 flex-1"><p className="truncate font-bold">{game.title}</p><p className="mt-1 truncate text-xs text-slate-400">{game.platform} · {game.status}</p><div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${game.progress}%` }} /></div><p className="mt-1 text-[11px] text-slate-500">{game.progress}% completado</p></div><Button size="icon-sm" variant="ghost" aria-label="Quitar juego" onClick={onRemove} className="shrink-0"><X /></Button></div>;
}

function PostCard({ post, currentUserId, activeReplyId, replyDraft, currentUserName, currentUserPhoto, onViewProfile, onLike, onShare, onToggleReplies, onReplyChange, onReply }: { post: CommunityPost; currentUserId?: string | null; activeReplyId: string | null; replyDraft: string; currentUserName?: string | null; currentUserPhoto?: string | null; onViewProfile: (id: string) => void; onLike: () => void; onShare: () => void; onToggleReplies: () => void; onReplyChange: (value: string) => void; onReply: () => void }) {
  const liked = (post.likedBy || []).includes(currentUserId || ""); const replies = post.replies || []; const repliesOpen = activeReplyId === post.id;
  return <article id={`publicacion-${post.id}`} className="scroll-mt-28 overflow-hidden rounded-3xl border border-white/10 bg-[#0b1628] shadow-[0_18px_50px_rgba(0,0,0,.16)]"><div className="p-4 sm:p-5">
    <header className="flex items-start gap-3"><button type="button" onClick={() => onViewProfile(post.authorId)}><Avatar className="size-11 border border-white/15"><AvatarImage src={post.authorPhoto} /><AvatarFallback className="bg-gradient-to-br from-violet-500 to-cyan-500 font-bold">{initials(post.authorName)}</AvatarFallback></Avatar></button><div className="min-w-0 flex-1"><button type="button" onClick={() => onViewProfile(post.authorId)} className="font-bold hover:text-cyan-300">{post.authorName}</button><div className="flex items-center gap-2 text-xs text-slate-500"><span>{timeAgo(post.createdAt)}</span><span>·</span><span>{post.category === "Debate" ? "Conversación" : post.category}</span></div></div>{post.authorId === currentUserId && <Badge variant="outline" className="border-cyan-400/20 text-cyan-300">Tú</Badge>}</header>
    <p className="mt-4 whitespace-pre-wrap text-[0.98rem] leading-7 text-slate-200">{post.content}</p>
    {post.sharedGame && <div className="mt-4 flex overflow-hidden rounded-2xl border border-white/10 bg-[#07101f]"><div className="w-24 shrink-0 bg-white/5 sm:w-28">{post.sharedGame.coverUrl ? <div className="h-full min-h-32 bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(post.sharedGame.coverUrl).slice(1, -1)})` }} /> : <div className="grid h-full min-h-32 place-items-center"><Gamepad2 className="size-7 text-slate-600" /></div>}</div><div className="min-w-0 flex-1 p-4"><Badge className="bg-violet-400/10 text-violet-300">De mi biblioteca</Badge><h3 className="mt-2 truncate text-lg font-black">{post.sharedGame.title}</h3><p className="text-sm text-slate-400">{post.sharedGame.platform} · {post.sharedGame.status}</p><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full bg-gradient-to-r from-violet-500 to-cyan-400" style={{ width: `${post.sharedGame.progress}%` }} /></div><p className="mt-1 text-xs text-slate-500">{post.sharedGame.progress}% · {post.sharedGame.hours} h</p></div></div>}
    {post.attachmentUrl && <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/30"><img src={post.attachmentUrl} alt={`Captura compartida por ${post.authorName}`} className="max-h-[560px] w-full object-contain" /></div>}
    <div className="mt-4 grid grid-cols-3 border-t border-white/8 pt-2"><button type="button" onClick={onLike} className={`flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-xs font-semibold transition hover:bg-white/5 sm:gap-2 sm:px-3 sm:text-sm ${liked ? "text-rose-400" : "text-slate-400"}`}><Heart className={`size-4 shrink-0 ${liked ? "fill-current" : ""}`} /><span className="truncate">{post.likes || "Me gusta"}</span></button><button type="button" onClick={onToggleReplies} className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white sm:gap-2 sm:px-3 sm:text-sm"><MessageCircle className="size-4 shrink-0" /><span className="truncate">{replies.length || "Comentar"}</span></button><button type="button" onClick={onShare} className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl px-1 py-2 text-xs font-semibold text-slate-400 transition hover:bg-white/5 hover:text-white sm:gap-2 sm:px-3 sm:text-sm"><Share2 className="size-4 shrink-0" /><span className="truncate">Compartir</span></button></div>
    {repliesOpen && <div className="mt-3 space-y-3 border-t border-white/8 pt-4">{replies.map(item => <div key={item.id} className="flex gap-2"><Avatar className="size-8"><AvatarImage src={item.authorPhoto} /><AvatarFallback className="bg-white/8 text-xs">{initials(item.authorName)}</AvatarFallback></Avatar><div className="min-w-0 flex-1 rounded-2xl bg-white/[.045] px-3 py-2"><div className="flex justify-between gap-2"><span className="text-sm font-bold">{item.authorName}</span><span className="text-[11px] text-slate-500">{timeAgo(item.createdAt)}</span></div><p className="mt-0.5 text-sm leading-6 text-slate-300">{item.content}</p></div></div>)}<div className="flex gap-2"><Avatar className="size-8"><AvatarImage src={currentUserPhoto || undefined} /><AvatarFallback className="bg-violet-500/20 text-xs">{initials(currentUserName)}</AvatarFallback></Avatar><div className="relative flex-1"><Input value={replyDraft} onChange={event => onReplyChange(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); onReply(); } }} placeholder="Escribe una respuesta…" className="h-9 border-white/10 bg-[#07101f] pr-10" /><Button size="icon-sm" onClick={onReply} disabled={!replyDraft.trim()} className="absolute right-1 top-1/2 -translate-y-1/2 bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Send /></Button></div></div></div>}
  </div></article>;
}

function ActivityCard({ activity, onViewProfile }: { activity: ActivityEvent; onViewProfile: (id: string) => void }) { return <article className="flex gap-4 rounded-3xl border border-white/8 bg-white/[.035] p-4"><div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><Trophy className="size-5" /></div><div className="min-w-0 flex-1"><p className="text-sm leading-6 text-slate-300"><button type="button" onClick={() => onViewProfile(activity.userId)} className="font-bold text-white hover:text-cyan-300">{activity.handle}</button> avanzó en <strong className="text-white">{activity.gameTitle}</strong></p><p className="mt-1 text-xs text-slate-500">{activity.platform} · {activity.progress}% · {timeAgo(activity.date)}</p></div></article>; }

function ProfilesExplorer({ profiles, loading, query, setQuery, currentUserId, relationships, onRequestFriend, onAccept, onViewProfile }: { profiles: PublicProfileData[]; loading: boolean; query: string; setQuery: (value: string) => void; currentUserId?: string | null; relationships: Map<string, Friendship>; onRequestFriend: (profile: PublicProfileData) => void; onAccept: (friendship: Friendship) => void; onViewProfile: (id: string) => void }) {
  return <section className="space-y-4"><div className="relative"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" /><Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar jugador, consola o biografía…" className="h-11 border-white/10 bg-[#0b1628] pl-10" /></div>{loading ? [1, 2, 3].map(item => <Skeleton key={item} className="h-36 rounded-3xl bg-white/5" />) : profiles.length === 0 ? <div className="rounded-3xl border border-dashed border-white/10 py-14 text-center"><Archive className="mx-auto size-9 text-slate-600" /><p className="mt-3 text-slate-400">No encontramos jugadores con esa búsqueda.</p></div> : <div className="grid gap-4 sm:grid-cols-2">{profiles.map(profile => {
    const relationship = relationships.get(profile.userId);
    const isIncoming = relationship?.status === "pending" && relationship.recipientId === currentUserId;
    return <article key={profile.userId} className="rounded-3xl border border-white/10 bg-[#0b1628] p-5 transition hover:-translate-y-0.5 hover:border-cyan-400/30"><button type="button" onClick={() => onViewProfile(profile.userId)} className="w-full text-left"><div className="flex items-center gap-3"><Avatar className="size-12 border border-white/15"><AvatarFallback className="bg-gradient-to-br from-violet-500 to-cyan-500 font-bold">{initials(profile.handle)}</AvatarFallback></Avatar><span className="min-w-0"><span className="flex items-center gap-2 font-bold">{profile.handle}{profile.userId === currentUserId && <Badge variant="outline" className="border-cyan-400/20 text-cyan-300">Tú</Badge>}</span><span className="mt-0.5 block line-clamp-1 text-xs text-slate-500">{profile.bio || "Colección pública"}</span></span></div><div className="mt-4 grid grid-cols-3 rounded-2xl bg-white/[.035] p-3 text-center"><span><strong className="block">{profile.stats.total}</strong><small className="text-slate-500">juegos</small></span><span><strong className="block text-cyan-300">{profile.stats.active}</strong><small className="text-slate-500">jugando</small></span><span><strong className="block text-emerald-300">{profile.stats.done}</strong><small className="text-slate-500">terminados</small></span></div></button>{profile.userId !== currentUserId && <Button type="button" size="sm" variant="outline" disabled={!currentUserId || relationship?.status === "accepted" || (relationship?.status === "pending" && !isIncoming)} onClick={() => isIncoming && relationship ? onAccept(relationship) : onRequestFriend(profile)} className="mt-3 w-full border-white/10">{relationship?.status === "accepted" ? <><Check />Amigos</> : isIncoming ? <><Check />Aceptar solicitud</> : relationship?.status === "pending" ? <><UserPlus />Solicitud enviada</> : <><UserPlus />Agregar amigo</>}</Button>}</article>;
  })}</div>}</section>;
}

function FriendsPanel({ friendships, loading, currentUserId, onAccept, onRemove, onViewProfile }: { friendships: Friendship[]; loading: boolean; currentUserId?: string | null; onAccept: (friendship: Friendship) => void; onRemove: (friendship: Friendship) => void; onViewProfile: (id: string) => void }) {
  if (!currentUserId) return <section className="rounded-3xl border border-dashed border-white/10 py-14 text-center"><Users className="mx-auto size-9 text-slate-600" /><h2 className="mt-3 font-bold">Inicia sesión para gestionar amistades</h2></section>;
  if (loading) return <div className="space-y-3">{[1, 2, 3].map(item => <Skeleton key={item} className="h-24 rounded-3xl bg-white/5" />)}</div>;
  const incoming = friendships.filter(item => item.status === "pending" && item.recipientId === currentUserId);
  const outgoing = friendships.filter(item => item.status === "pending" && item.requesterId === currentUserId);
  const accepted = friendships.filter(item => item.status === "accepted");
  const group = (title: string, items: Friendship[]) => items.length > 0 && <section className="space-y-3"><h2 className="px-1 text-sm font-bold text-slate-300">{title} <Badge variant="outline" className="ml-1 border-white/10">{items.length}</Badge></h2>{items.map(item => {
    const otherId = item.memberIds.find(id => id !== currentUserId) || "";
    const otherName = item.requesterId === currentUserId ? item.recipientName : item.requesterName;
    const canAccept = item.status === "pending" && item.recipientId === currentUserId;
    return <article key={item.id} className="flex flex-wrap items-center gap-3 rounded-3xl border border-white/10 bg-[#0b1628] p-4"><button type="button" onClick={() => onViewProfile(otherId)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><Avatar className="size-11"><AvatarFallback className="bg-gradient-to-br from-violet-500 to-cyan-500 font-bold">{initials(otherName)}</AvatarFallback></Avatar><span className="min-w-0"><strong className="block truncate">{otherName}</strong><small className="text-slate-500">{item.status === "accepted" ? "Amigo" : canAccept ? "Quiere ser tu amigo" : "Solicitud enviada"}</small></span></button><div className="flex gap-2">{canAccept && <Button size="sm" onClick={() => onAccept(item)} className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"><Check />Aceptar</Button>}<Button size="sm" variant="outline" onClick={() => onRemove(item)} className="border-white/10">{item.status === "accepted" ? <><UserMinus />Eliminar</> : <><X />{canAccept ? "Rechazar" : "Cancelar"}</>}</Button></div></article>;
  })}</section>;
  return <div className="space-y-6">{friendships.length === 0 && <section className="rounded-3xl border border-dashed border-white/10 py-14 text-center"><UserPlus className="mx-auto size-9 text-slate-600" /><h2 className="mt-3 font-bold">Aún no tienes solicitudes</h2><p className="mt-1 text-sm text-slate-400">Busca jugadores y envíales una solicitud de amistad.</p></section>}{group("Solicitudes recibidas", incoming)}{group("Mis amigos", accepted)}{group("Solicitudes enviadas", outgoing)}</div>;
}
