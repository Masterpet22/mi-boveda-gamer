"use client";

import { useState } from "react";
import { Check, Copy, Eye, Globe, Lock, Search, Share2, Sparkles, UserCheck } from "lucide-react";
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
import type { PublicProfileSettings } from "@/lib/share";

interface ProfilesDialogProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  userId?: string | null;
  userName?: string | null;
  publicSettings?: PublicProfileSettings;
  onViewMyProfile?: () => void;
  onOpenShareSettings?: () => void;
  onLoadProfile: (targetUid: string) => void;
}

export function ProfilesDialog({
  open,
  setOpen,
  userId,
  userName = "Jugador",
  publicSettings,
  onViewMyProfile,
  onOpenShareSettings,
  onLoadProfile,
}: ProfilesDialogProps) {
  const [inputUrlOrId, setInputUrlOrId] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  const isPublic = publicSettings?.isPublic ?? false;

  const myShareUrl = typeof window !== "undefined" && userId
    ? `${window.location.origin}${window.location.pathname.replace(/\/$/, "")}/?share=${encodeURIComponent(userId)}`
    : "";

  function handleSearchProfile() {
    const raw = inputUrlOrId.trim();
    if (!raw) {
      toast.error("Introduce un enlace de compartir o un ID de usuario.");
      return;
    }

    let targetUid = raw;

    // If a full URL was pasted, extract ?share= or ?user=
    if (raw.includes("?") || raw.includes("http")) {
      try {
        const parsed = new URL(raw.startsWith("http") ? raw : `https://dummy.local/${raw}`);
        const extracted = parsed.searchParams.get("share") || parsed.searchParams.get("user");
        if (extracted) {
          targetUid = extracted;
        }
      } catch {
        // Fallback to regex matching
        const match = raw.match(/[?&](?:share|user)=([^&#]+)/);
        if (match?.[1]) {
          targetUid = decodeURIComponent(match[1]);
        }
      }
    }

    if (!targetUid || targetUid.length < 3) {
      toast.error("El enlace o ID proporcionado no es válido.");
      return;
    }

    setOpen(false);
    setInputUrlOrId("");
    onLoadProfile(targetUid);
  }

  function copyMyLink() {
    if (!myShareUrl) return;
    navigator.clipboard.writeText(myShareUrl);
    setCopiedLink(true);
    toast.success("Enlace de tu perfil público copiado");
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5">
            <div className="grid size-10 place-items-center rounded-xl bg-cyan-500/15 text-cyan-300">
              <Globe className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold">Ver Perfiles Públicos</DialogTitle>
              <DialogDescription className="text-slate-400">
                Explora colecciones compartidas de otros jugadores o consulta tu propio perfil.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Section 1: Mi Perfil */}
          {userId ? (
            <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4.5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-lg bg-violet-500/20 text-violet-300 font-bold">
                    <UserCheck className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-white">Tu Perfil Gamer</h3>
                    <p className="text-xs text-slate-400">{userName}</p>
                  </div>
                </div>
                {isPublic ? (
                  <Badge className="border-emerald-400/30 bg-emerald-500/15 text-emerald-300">
                    <span className="mr-1.5 size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Público activo
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-400/30 bg-amber-500/10 text-amber-300">
                    <Lock className="mr-1 size-3" />
                    No publicado
                  </Badge>
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onViewMyProfile?.();
                  }}
                  className="bg-gradient-to-r from-violet-600 to-cyan-600 text-white font-semibold shadow hover:brightness-110"
                >
                  <Eye className="mr-1.5 size-4" />
                  Ver mi perfil público ahora
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setOpen(false);
                    onOpenShareSettings?.();
                  }}
                  className="border-white/10 text-slate-300 hover:text-white"
                >
                  <Share2 className="mr-1.5 size-4 text-cyan-300" />
                  Configurar y compartir
                </Button>

                {isPublic && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={copyMyLink}
                    title="Copiar mi enlace"
                    className="border border-white/10 text-slate-300 hover:text-white"
                  >
                    {copiedLink ? <Check className="size-4 text-emerald-400" /> : <Copy className="size-4" />}
                  </Button>
                )}
              </div>

              {!isPublic && (
                <p className="mt-3 text-xs text-amber-300/80">
                  Tu perfil está en modo privado. Solo tú puedes ver la vista previa. Para que tus amigos puedan verlo con tu enlace, actívalo en &quot;Configurar y compartir&quot;.
                </p>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[.02] p-4 text-center">
              <p className="text-sm text-slate-300">Inicia sesión con Google para crear y compartir tu propio perfil.</p>
            </div>
          )}

          {/* Section 2: Cargar perfil de otro usuario */}
          <div className="rounded-2xl border border-cyan-400/20 bg-cyan-500/[.03] p-4.5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-300">
              <Search className="size-4" />
              <span>Ver la colección de otro jugador</span>
            </div>
            <p className="text-xs leading-5 text-slate-400">
              ¿Un amigo te compartió su enlace o su ID de usuario? Pégalo a continuación para acceder a su biblioteca pública:
            </p>

            <div className="space-y-1.5">
              <Label htmlFor="search-profile-input" className="text-xs text-slate-300">
                Enlace para compartir o ID de usuario
              </Label>
              <div className="flex gap-2">
                <Input
                  id="search-profile-input"
                  value={inputUrlOrId}
                  onChange={(e) => setInputUrlOrId(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleSearchProfile();
                    }
                  }}
                  placeholder="Ej. https://.../?share=123abc456 o 123abc456"
                  className="border-white/10 bg-[#07101f] text-slate-100 placeholder:text-slate-500"
                />
                <Button
                  type="button"
                  onClick={handleSearchProfile}
                  className="bg-cyan-500 text-slate-950 font-semibold hover:bg-cyan-400 shrink-0"
                >
                  <Search className="mr-1 size-4" />
                  Ver perfil
                </Button>
              </div>
            </div>
          </div>

          {/* Section 3: Privacidad y seguridad */}
          <div className="rounded-xl border border-white/8 bg-white/[.02] p-3 text-xs leading-5 text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-300">
              <Sparkles className="size-3.5 text-violet-400" />
              <span>¿Qué información se muestra en los perfiles?</span>
            </div>
            <p>
              Los perfiles compartidos son de <strong>solo lectura</strong>. Los juegos marcados como privados, así como las notas o sesiones personales que decidas ocultar, jamás son accesibles para los visitantes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
