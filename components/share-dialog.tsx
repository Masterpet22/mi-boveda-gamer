"use client";

import { useEffect, useRef, useState } from "react";
import type { Firestore } from "firebase/firestore";
import {
  Check,
  Copy,
  Download,
  Eye,
  Globe,
  ImageIcon,
  Lock,
  Share2,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  defaultProfileSettings,
  generateLibrarySummaryMarkdown,
  generateLibrarySummaryText,
  savePublicProfileToFirestore,
  sanitizeGamesForPublic,
  type PublicGame,
  type PublicProfileSettings,
} from "@/lib/share";
import {
  copyGamerCardToClipboard,
  downloadGamerCard,
  renderGamerSocialCard,
} from "@/lib/social-card";

interface ShareDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  userId: string;
  defaultHandle?: string;
  games: Array<PublicGame & { isPrivate?: boolean }>;
  db: Firestore | null;
  savedSettings?: Partial<PublicProfileSettings>;
  onSettingsUpdated?: (settings: PublicProfileSettings) => void;
  onPreviewPublic?: () => void;
}

export function ShareDialog({
  open,
  setOpen,
  userId,
  defaultHandle = "Gamer",
  games,
  db,
  savedSettings,
  onSettingsUpdated,
  onPreviewPublic,
}: ShareDialogProps) {
  const [settings, setSettings] = useState<PublicProfileSettings>(() => ({
    ...defaultProfileSettings,
    handle: savedSettings?.handle || defaultHandle,
    bio: savedSettings?.bio || defaultProfileSettings.bio,
    isPublic: savedSettings?.isPublic ?? false,
    hideNotes: savedSettings?.hideNotes ?? true,
    hideSessions: savedSettings?.hideSessions ?? true,
    hideHours: savedSettings?.hideHours ?? false,
    hideWishlist: savedSettings?.hideWishlist ?? false,
  }));

  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<"profile" | "privacy" | "card">("profile");
  const [renderingCard, setRenderingCard] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Compute share URL
  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}/?share=${encodeURIComponent(userId)}`
    : `https://mibovedagamer.app/?share=${userId}`;

  // Sanitize games preview
  const { sanitizedGames, stats } = sanitizeGamesForPublic(games, settings);
  const privateGamesCount = games.filter(g => g.isPrivate).length;

  // Sync initial settings if savedSettings change
  const [prevSavedSettings, setPrevSavedSettings] = useState(savedSettings);
  if (savedSettings !== prevSavedSettings) {
    setPrevSavedSettings(savedSettings);
    if (savedSettings) {
      setSettings(prev => ({
        ...prev,
        ...savedSettings,
        handle: savedSettings.handle || prev.handle || defaultHandle,
      }));
    }
  }

  // Render social card when card tab becomes active
  useEffect(() => {
    if (open && activeTab === "card" && canvasRef.current) {
      let isMounted = true;
      setRenderingCard(true);
      renderGamerSocialCard(canvasRef.current, {
        handle: settings.handle || defaultHandle,
        bio: settings.bio,
        stats,
        games: sanitizedGames,
      }).finally(() => {
        if (isMounted) setRenderingCard(false);
      });
      return () => {
        isMounted = false;
      };
    }
  }, [open, activeTab, settings.handle, settings.bio, stats, sanitizedGames, defaultHandle]);

  async function handleSaveAndPublish(newSettings: PublicProfileSettings) {
    if (!db || !userId) {
      setSettings(newSettings);
      onSettingsUpdated?.(newSettings);
      return;
    }
    setSaving(true);
    try {
      await savePublicProfileToFirestore(db, userId, newSettings, games);
      setSettings(newSettings);
      onSettingsUpdated?.(newSettings);
      if (newSettings.isPublic) {
        toast.success("¡Perfil público actualizado y listo para compartir!");
      } else {
        toast.info("Perfil público desactivado. Tu colección ahora es privada.");
      }
    } catch (err) {
      console.error("Error saving public profile:", err);
      toast.error("No se pudo actualizar el perfil público.");
    } finally {
      setSaving(false);
    }
  }

  function handleTogglePublic(checked: boolean) {
    const next = { ...settings, isPublic: checked };
    setSettings(next);
    void handleSaveAndPublish(next);
  }

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("¡Enlace copiado al portapapeles!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  }

  async function handleNativeShare() {
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({
          title: `Mi Bóveda Gamer - ${settings.handle}`,
          text: `Echa un vistazo a mi colección de videojuegos y mis avances en Mi Bóveda Gamer.`,
          url: shareUrl,
        });
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          toast.error("Error al compartir enlace.");
        }
      }
    } else {
      await copyShareLink();
    }
  }

  async function handleDownloadImage() {
    if (!canvasRef.current) return;
    try {
      await downloadGamerCard(
        canvasRef.current,
        `boveda-gamer-${(settings.handle || "gamer").toLowerCase().replace(/\s+/g, "-")}.png`
      );
      toast.success("Tarjeta gráfica descargada en PNG.");
    } catch {
      toast.error("No se pudo descargar la imagen.");
    }
  }

  async function handleCopyImage() {
    if (!canvasRef.current) return;
    const ok = await copyGamerCardToClipboard(canvasRef.current);
    if (ok) {
      toast.success("¡Imagen copiada al portapapeles!");
    } else {
      toast.error("Tu navegador no soporta copiar imágenes directamente. Usa la opción Descargar.");
    }
  }

  function handleCopyMarkdown() {
    const md = generateLibrarySummaryMarkdown(
      settings.handle,
      stats,
      sanitizedGames,
      settings.isPublic ? shareUrl : undefined
    );
    navigator.clipboard.writeText(md);
    toast.success("Resumen en Markdown copiado.");
  }

  function handleCopyText() {
    const text = generateLibrarySummaryText(
      settings.handle,
      stats,
      sanitizedGames,
      settings.isPublic ? shareUrl : undefined
    );
    navigator.clipboard.writeText(text);
    toast.success("Resumen en texto plano copiado.");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400">
              <Share2 className="size-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl">Compartir mi colección</DialogTitle>
              <DialogDescription className="text-slate-400">
                Comparte un perfil de solo lectura, exporta una tarjeta gráfica o ajusta la privacidad.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as typeof activeTab)} className="mt-2">
          <TabsList className="grid w-full grid-cols-3 border border-white/8 bg-[#07101f]">
            <TabsTrigger value="profile" className="data-[state=active]:bg-violet-500 data-[state=active]:text-white">
              <Globe className="mr-1.5 size-4" />
              Perfil y enlace
            </TabsTrigger>
            <TabsTrigger value="privacy" className="data-[state=active]:bg-violet-500 data-[state=active]:text-white">
              <Lock className="mr-1.5 size-4" />
              Privacidad
            </TabsTrigger>
            <TabsTrigger value="card" className="data-[state=active]:bg-violet-500 data-[state=active]:text-white">
              <Sparkles className="mr-1.5 size-4" />
              Tarjeta & Resumen
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: PERFIL PÚBLICO Y ENLACE */}
          <TabsContent value="profile" className="space-y-4 pt-4">
            {/* Activar / Desactivar switch banner */}
            <div
              className={`flex items-center justify-between rounded-2xl border p-4 transition ${
                settings.isPublic
                  ? "border-emerald-500/30 bg-emerald-500/10"
                  : "border-white/10 bg-white/[.03]"
              }`}
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2 font-bold">
                  <span>Perfil público de solo lectura</span>
                  <Badge
                    variant="outline"
                    className={
                      settings.isPublic
                        ? "border-emerald-400/30 bg-emerald-400/15 text-emerald-300"
                        : "border-slate-500/30 bg-slate-500/15 text-slate-400"
                    }
                  >
                    {settings.isPublic ? "Activo" : "Privado"}
                  </Badge>
                </div>
                <p className="text-xs text-slate-400">
                  {settings.isPublic
                    ? "Cualquier persona con el enlace puede explorar tus juegos de forma segura."
                    : "Tu colección es 100% privada. Solo tú puedes verla con tu cuenta."}
                </p>
              </div>
              <Switch
                checked={settings.isPublic}
                onCheckedChange={handleTogglePublic}
                disabled={saving}
                aria-label="Activar perfil público"
              />
            </div>

            {/* Enlace para compartir */}
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Enlace directo a tu colección</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={settings.isPublic ? shareUrl : "Activa el perfil público para habilitar el enlace"}
                  disabled={!settings.isPublic}
                  className="border-white/10 bg-[#07101f] text-sm text-slate-200"
                />
                <Button
                  variant="outline"
                  onClick={copyShareLink}
                  disabled={!settings.isPublic}
                  title="Copiar enlace"
                >
                  {copied ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  <span className="hidden sm:inline">{copied ? "Copiado" : "Copiar"}</span>
                </Button>
                {typeof navigator !== "undefined" && typeof navigator.share === "function" && (
                  <Button
                    variant="secondary"
                    onClick={handleNativeShare}
                    disabled={!settings.isPublic}
                    title="Compartir enlace"
                  >
                    <Share2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Configurar alias y bio pública */}
            <div className="grid gap-3 pt-2 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="share-handle">Tu alias o nombre gamer</Label>
                <Input
                  id="share-handle"
                  value={settings.handle}
                  onChange={e => setSettings({ ...settings, handle: e.target.value })}
                  placeholder="Ej. Bóveda de Alex"
                  className="border-white/10 bg-[#07101f]"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="share-bio">Frase o biografía breve</Label>
                <Input
                  id="share-bio"
                  value={settings.bio}
                  onChange={e => setSettings({ ...settings, bio: e.target.value })}
                  placeholder="Ej. Coleccionista de clásicos y backlog actual"
                  className="border-white/10 bg-[#07101f]"
                />
              </div>
            </div>

            {/* Vista previa rápida */}
            <div className="flex items-center justify-between rounded-xl border border-white/8 bg-black/20 p-3 text-xs text-slate-400">
              <span>
                {sanitizedGames.length} juegos públicos disponibles{" "}
                {privateGamesCount > 0 && `(${privateGamesCount} privados excluidos)`}
              </span>
              {onPreviewPublic && settings.isPublic && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-cyan-300 hover:text-cyan-200"
                  onClick={() => {
                    setOpen(false);
                    onPreviewPublic();
                  }}
                >
                  <Eye className="mr-1 size-3.5" />
                  Ver como visitante
                </Button>
              )}
            </div>
          </TabsContent>

          {/* TAB 2: PRIVACIDAD */}
          <TabsContent value="privacy" className="space-y-4 pt-4">
            <div className="rounded-2xl border border-white/8 bg-white/[.02] p-4">
              <h4 className="font-semibold text-slate-200">Protección de información privada</h4>
              <p className="mt-1 text-xs text-slate-400">
                Elige qué datos personales se filtran antes de publicar tu colección para visitantes.
              </p>

              <div className="mt-4 space-y-4 divide-y divide-white/6">
                <div className="flex items-center justify-between pt-2">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">Ocultar notas personales de los juegos</Label>
                    <p className="text-xs text-slate-400">
                      Tus anotaciones privadas, builds, ubicaciones o notas de partidas no serán visibles.
                    </p>
                  </div>
                  <Switch
                    checked={settings.hideNotes}
                    onCheckedChange={checked => setSettings({ ...settings, hideNotes: checked })}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">Ocultar historial y registro de sesiones</Label>
                    <p className="text-xs text-slate-400">
                      Oculta las fechas exactas, horas por sesión y comentarios del registro diario.
                    </p>
                  </div>
                  <Switch
                    checked={settings.hideSessions}
                    onCheckedChange={checked => setSettings({ ...settings, hideSessions: checked })}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">Ocultar horas totales jugadas</Label>
                    <p className="text-xs text-slate-400">
                      No mostrará el tiempo acumulado de juego a terceros (solo el % de avance).
                    </p>
                  </div>
                  <Switch
                    checked={settings.hideHours}
                    onCheckedChange={checked => setSettings({ ...settings, hideHours: checked })}
                  />
                </div>

                <div className="flex items-center justify-between pt-4">
                  <div className="space-y-0.5 pr-4">
                    <Label className="text-sm font-medium">Ocultar juegos pendientes de compra</Label>
                    <p className="text-xs text-slate-400">
                      Excluye tu lista de deseos de la colección pública compartida.
                    </p>
                  </div>
                  <Switch
                    checked={settings.hideWishlist}
                    onCheckedChange={checked => setSettings({ ...settings, hideWishlist: checked })}
                  />
                </div>
              </div>
            </div>

            {/* Aviso sobre juegos individuales privados */}
            <div className="rounded-xl border border-violet-400/20 bg-violet-500/10 p-4 text-xs leading-relaxed text-slate-300">
              <div className="flex items-center gap-1.5 font-bold text-violet-300">
                <Lock className="size-4" />
                <span>Juegos individuales privados</span>
              </div>
              <p className="mt-1">
                Puedes marcar cualquier juego individual como <strong>Privado</strong> al editar su ficha en tu
                biblioteca. Esos juegos se omitirán automáticamente del perfil público y de las tarjetas generadas.
              </p>
              <div className="mt-2.5 font-semibold text-cyan-300">
                {privateGamesCount === 0 ? (
                  "Todos tus juegos son públicos actualmente."
                ) : (
                  <span>
                    Tienes {privateGamesCount} juego{privateGamesCount !== 1 ? "s" : ""} marcado
                    {privateGamesCount !== 1 ? "s" : ""} como privado.
                  </span>
                )}
              </div>
            </div>
          </TabsContent>

          {/* TAB 3: TARJETA GRÁFICA & RESUMEN */}
          <TabsContent value="card" className="space-y-4 pt-4">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-slate-200">Tarjeta Gamer para compartir</h4>
                  <p className="text-xs text-slate-400">
                    Infografía en alta resolución con tus estadísticas y partidas activas.
                  </p>
                </div>
                <Badge variant="outline" className="border-cyan-400/30 text-cyan-300">
                  1200 × 630 px
                </Badge>
              </div>

              {/* Contenedor del canvas interactivo */}
              <div className="relative mt-3 overflow-hidden rounded-2xl border border-white/10 bg-[#07101f]">
                {renderingCard && (
                  <div className="absolute inset-0 z-10 grid place-items-center bg-[#07101f]/80 text-xs text-slate-400 backdrop-blur-sm">
                    Generando tarjeta gráfica…
                  </div>
                )}
                <canvas
                  ref={canvasRef}
                  className="w-full aspect-[1200/630] object-contain shadow-2xl"
                  style={{ display: "block" }}
                />
              </div>

              {/* Botones de acción de la imagen */}
              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Button
                  className="bg-violet-500 text-white hover:bg-violet-400"
                  size="sm"
                  onClick={handleDownloadImage}
                  disabled={renderingCard}
                >
                  <Download className="size-4" />
                  Descargar PNG
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyImage}
                  disabled={renderingCard}
                >
                  <ImageIcon className="size-4" />
                  Copiar Imagen
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMarkdown}
                >
                  <Copy className="size-4" />
                  Copiar Markdown
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyText}
                >
                  <Copy className="size-4" />
                  Copiar Texto
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter className="mt-4 gap-2 sm:justify-between">
          <div className="text-xs text-slate-500 self-center">
            {settings.isPublic ? "Perfil público sincronizado" : "Perfil privado"}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cerrar
            </Button>
            <Button
              className="bg-violet-500 text-white hover:bg-violet-400"
              onClick={() => void handleSaveAndPublish(settings)}
              disabled={saving}
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
