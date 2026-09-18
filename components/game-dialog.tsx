"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ImageIcon, Lock, Search } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { AppSettings, Draft, Game } from "@/lib/game-types";
import { customLists, normalizeTitle, platforms, statuses } from "@/lib/game-types";
import {
  getWikidataGame,
  searchWikidataGames,
  type WikidataResult,
} from "@/lib/wikidata";

interface GameDialogProps {
  settings: AppSettings;
  open: boolean;
  setOpen: (v: boolean) => void;
  draft: Draft;
  setDraft: (d: Draft) => void;
  editing: boolean;
  editingId?: string;
  save: () => void;
  saving: boolean;
  games: Game[];
}

export function GameDialog({
  settings,
  open,
  setOpen,
  draft,
  setDraft,
  editing,
  editingId,
  save,
  saving,
  games,
}: GameDialogProps) {
  const [metadataResults, setMetadataResults] = useState<WikidataResult[]>([]);
  const [metadataLoading, setMetadataLoading] = useState(false);
  const [metadataMessage, setMetadataMessage] = useState("");
  const [metadataPreview, setMetadataPreview] = useState<{
    result: WikidataResult;
    data: Partial<Draft>;
  } | null>(null);

  const duplicates = useMemo(
    () =>
      draft.title.trim().length > 1
        ? games.filter(
            game => game.id !== editingId && normalizeTitle(game.title) === normalizeTitle(draft.title)
          )
        : [],
    [games, draft.title, editingId]
  );

  async function searchMetadata() {
    if (draft.title.trim().length < 2) return toast.error("Escribe al menos dos letras del título.");
    setMetadataLoading(true);
    setMetadataMessage("");
    setMetadataPreview(null);
    try {
      const results = await searchWikidataGames(draft.title.trim());
      setMetadataResults(results);
      if (!results.length) {
        setMetadataMessage("No encontramos coincidencias. Puedes completar la ficha manualmente.");
      }
    } catch (error) {
      console.error(error);
      setMetadataMessage("Wikidata no respondió. Inténtalo de nuevo o completa la ficha manualmente.");
    } finally {
      setMetadataLoading(false);
    }
  }

  async function previewMetadata(result: WikidataResult) {
    setMetadataLoading(true);
    setMetadataMessage("");
    try {
      const metadata = await getWikidataGame(result, settings);
      setMetadataPreview({ result, data: metadata });
      const missing = [
        !metadata.coverUrl && "carátula",
        !metadata.genre && "género",
        !metadata.developer && "desarrollador",
        !metadata.releaseYear && "año",
        !metadata.series && "saga",
      ].filter(Boolean);
      if (missing.length) {
        setMetadataMessage(
          `Esta edición no incluye: ${missing.join(", ")}. Mostramos otras coincidencias debajo para que puedas compararlas.`
        );
        const alternatives = await searchWikidataGames(String(metadata.title || draft.title));
        setMetadataResults(alternatives);
      }
    } catch (error) {
      console.error(error);
      setMetadataMessage("No pudimos leer esa ficha. Prueba otra coincidencia.");
    } finally {
      setMetadataLoading(false);
    }
  }

  function applyMetadata() {
    if (!metadataPreview) return;
    const data = settings.preserveManualData
      ? Object.fromEntries(
          Object.entries(metadataPreview.data).filter(([key]) => {
            const current = draft[key as keyof Draft];
            return current === "" || current === 0 || current === "Otra";
          })
        )
      : metadataPreview.data;
    setDraft({ ...draft, ...data });
    setMetadataResults([]);
    setMetadataPreview(null);
    setMetadataMessage("");
    toast.success("Información completada desde Wikidata");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={value => {
        setOpen(value);
        if (!value) {
          setMetadataResults([]);
          setMetadataMessage("");
          setMetadataPreview(null);
        }
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Actualizar partida" : "Añadir juego"}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Busca el juego, luego selecciona una coincidencia para completar la ficha. Podrás corregir todos los datos antes de guardar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-2 sm:grid-cols-2">
          <Field label="Juego" wide>
            <div className="flex gap-2">
              <Input
                value={draft.title}
                onChange={e => {
                  setDraft({ ...draft, title: e.target.value, source: "Manual", sourceId: "" });
                  setMetadataResults([]);
                  setMetadataMessage("");
                }}
                onKeyDown={e => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void searchMetadata();
                  }
                }}
                placeholder="Ej. Halo Infinite"
              />
              <Button
                type="button"
                variant="outline"
                onClick={searchMetadata}
                disabled={metadataLoading}
              >
                <Search />
                {metadataLoading ? "Buscando…" : "Buscar datos"}
              </Button>
            </div>
            {metadataResults.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-xl border border-white/10 bg-[#07101f]">
                <p className="border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-300">
                  Selecciona una coincidencia para rellenar los campos
                </p>
                {metadataResults.map(result => (
                  <button
                    type="button"
                    key={result.id}
                    onClick={() => previewMetadata(result)}
                    className="flex w-full items-center justify-between gap-3 border-b border-white/7 px-3 py-2.5 text-left transition last:border-0 hover:bg-white/7"
                  >
                    <span>
                      <span className="block text-sm font-semibold text-slate-100">
                        {result.label}
                      </span>
                      <span className="block text-xs text-slate-400">
                        {result.description || "Sin descripción"} · {result.id}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs font-semibold text-violet-300">
                      Vista previa →
                    </span>
                  </button>
                ))}
              </div>
            )}
            {metadataPreview && (
              <MetadataPreview
                preview={metadataPreview}
                apply={applyMetadata}
                close={() => setMetadataPreview(null)}
              />
            )}
            {metadataMessage && <p className="mt-2 text-sm text-amber-300">{metadataMessage}</p>}
            {duplicates.length > 0 && (
              <p className="mt-2 text-sm text-amber-300">
                Ya existe:{" "}
                {duplicates.map(game => `${game.title} (${game.platform})`).join(", ")}. Las versiones de otra plataforma sí se pueden guardar.
              </p>
            )}
            {draft.sourceId && (
              <p className="mt-2 text-xs text-emerald-300">
                Ficha vinculada a {draft.sourceId} en Wikidata.
              </p>
            )}
          </Field>

          <Field label="URL de la carátula" wide>
            <Input
              type="url"
              value={draft.coverUrl}
              onChange={e => setDraft({ ...draft, coverUrl: e.target.value })}
              placeholder="https://…"
            />
            {draft.coverUrl && (
              <div
                className="mt-2 h-28 rounded-xl bg-cover bg-center"
                style={{
                  backgroundImage: `url(${JSON.stringify(draft.coverUrl).slice(1, -1)})`,
                }}
              />
            )}
          </Field>

          <Field label="Género">
            <Input
              value={draft.genre}
              onChange={e => setDraft({ ...draft, genre: e.target.value })}
              placeholder="Ej. RPG"
            />
          </Field>

          <Field label="Desarrollador">
            <Input
              value={draft.developer}
              onChange={e => setDraft({ ...draft, developer: e.target.value })}
              placeholder="Ej. Xbox Game Studios"
            />
          </Field>

          <Field label="Año de lanzamiento">
            <Input
              type="number"
              min="1950"
              max="2100"
              value={draft.releaseYear || ""}
              onChange={e => setDraft({ ...draft, releaseYear: Number(e.target.value) })}
            />
          </Field>

          <Field label="Saga">
            <Input
              value={draft.series}
              onChange={e => setDraft({ ...draft, series: e.target.value })}
              placeholder="Ej. Halo"
            />
          </Field>

          <Field label="Descripción" wide>
            <Textarea
              value={draft.description}
              onChange={e => setDraft({ ...draft, description: e.target.value })}
              placeholder="Resumen breve del juego..."
              className="min-h-20"
            />
          </Field>

          <Pick
            label="Consola"
            value={draft.platform}
            items={platforms}
            change={v => setDraft({ ...draft, platform: v })}
          />
          <Pick
            label="Formato"
            value={draft.format}
            items={["Digital", "Físico"]}
            change={v => setDraft({ ...draft, format: v })}
          />
          <Pick
            label="Estado"
            value={draft.status}
            items={statuses}
            change={v => setDraft({ ...draft, status: v })}
          />
          <Pick
            label="Prioridad"
            value={draft.priority}
            items={["Alta", "Normal", "Baja"]}
            change={v => setDraft({ ...draft, priority: v })}
          />

          <Field label="Horas jugadas">
            <Input
              type="number"
              min="0"
              step="0.1"
              value={draft.hours}
              onChange={e => setDraft({ ...draft, hours: Number(e.target.value) })}
            />
          </Field>

          <Field label="Duración estimada (horas)">
            <Input
              type="number"
              min="0"
              step="1"
              value={draft.estimatedHours || ""}
              onChange={e => setDraft({ ...draft, estimatedHours: Number(e.target.value) })}
              placeholder="Para el selector aleatorio"
            />
          </Field>

          <Pick
            label="Dificultad"
            value={draft.difficulty}
            items={["Sin indicar", "Fácil", "Normal", "Difícil", "Muy difícil"]}
            change={v => setDraft({ ...draft, difficulty: v })}
          />

          <Field label="Calificación (0–10)">
            <Input
              type="number"
              min="0"
              max="10"
              step="0.5"
              value={draft.rating || ""}
              onChange={e =>
                setDraft({
                  ...draft,
                  rating: Math.min(10, Math.max(0, Number(e.target.value))),
                })
              }
            />
          </Field>

          <Field label="Fecha de inicio">
            <Input
              type="date"
              value={draft.startedAt}
              onChange={e => setDraft({ ...draft, startedAt: e.target.value })}
            />
          </Field>

          <Field label="Fecha de finalización">
            <Input
              type="date"
              value={draft.finishedAt}
              onChange={e => setDraft({ ...draft, finishedAt: e.target.value })}
            />
          </Field>

          <Field label={`Progreso · ${draft.progress}%`} wide>
            <Slider
              value={[draft.progress]}
              onValueChange={v => setDraft({ ...draft, progress: Array.isArray(v) ? v[0] : v })}
              max={100}
              step={1}
              className="py-3"
            />
          </Field>

          <Field label="Listas personalizadas" wide>
            <div className="flex flex-wrap gap-2">
              {customLists.map(list => (
                <button
                  type="button"
                  key={list}
                  onClick={() =>
                    setDraft({
                      ...draft,
                      lists: (draft.lists ?? []).includes(list)
                        ? (draft.lists ?? []).filter(item => item !== list)
                        : [...(draft.lists ?? []), list],
                    })
                  }
                  className={`rounded-full border px-3 py-1.5 text-sm transition ${
                    (draft.lists ?? []).includes(list)
                      ? "border-violet-400 bg-violet-500/20 text-violet-200"
                      : "border-white/10 bg-white/[.03] text-slate-400 hover:border-white/25"
                  }`}
                >
                  {list}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Próximo objetivo" wide>
            <Input
              value={draft.nextGoal}
              onChange={e => setDraft({ ...draft, nextGoal: e.target.value })}
              placeholder="¿Qué debes hacer cuando vuelvas?"
            />
          </Field>

          <Field label="Notas" wide>
            <Textarea
              value={draft.notes}
              onChange={e => setDraft({ ...draft, notes: e.target.value })}
              placeholder="Build, misión, ubicación, objetos pendientes..."
              className="min-h-24"
            />
          </Field>

          <div className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[.02] p-3 sm:col-span-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-200">
                <Lock className="size-4 text-amber-400" />
                <span>Marcar como juego privado</span>
              </div>
              <p className="text-xs text-slate-400">
                Este juego no aparecerá en tu perfil público compartido ni en las tarjetas de resumen.
              </p>
            </div>
            <Switch
              checked={!!draft.isPrivate}
              onCheckedChange={checked => setDraft({ ...draft, isPrivate: checked })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="bg-violet-500" onClick={save} disabled={saving || metadataLoading}>
            {saving ? "Guardando..." : editing ? "Guardar cambios" : "Añadir a la bóveda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MetadataPreview({
  preview,
  apply,
  close,
}: {
  preview: { result: WikidataResult; data: Partial<Draft> };
  apply: () => void;
  close: () => void;
}) {
  const { data, result } = preview;
  const fields = [
    data.coverUrl && "Carátula",
    data.genre && "Género",
    data.developer && "Desarrollador",
    data.releaseYear && "Año",
    data.series && "Saga",
    data.platform && data.platform !== "Otra" && "Plataforma",
    data.description && "Descripción",
  ].filter(Boolean);

  return (
    <div className="mt-3 rounded-2xl border border-violet-400/25 bg-violet-500/10 p-4">
      <div className="flex gap-4">
        {data.coverUrl ? (
          <div
            className="h-28 w-20 shrink-0 rounded-lg bg-cover bg-center"
            style={{ backgroundImage: `url(${JSON.stringify(data.coverUrl).slice(1, -1)})` }}
          />
        ) : (
          <div className="grid h-28 w-20 shrink-0 place-items-center rounded-lg bg-white/5">
            <ImageIcon className="text-slate-500" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-300">
            Vista previa · {result.id}
          </p>
          <h3 className="mt-1 font-bold">{String(data.title || result.label)}</h3>
          <p className="mt-1 text-sm text-slate-400">
            {[data.developer, data.releaseYear, data.platform].filter(Boolean).join(" · ")}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {fields.length ? (
              fields.map(field => (
                <Badge key={String(field)} variant="secondary">
                  {field}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-amber-300">La ficha contiene pocos datos útiles.</span>
            )}
          </div>
        </div>
      </div>
      {data.description && (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-300">{data.description}</p>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={close}>
          Probar otra
        </Button>
        <Button type="button" size="sm" className="bg-violet-500" onClick={apply}>
          Aplicar estos datos
        </Button>
      </div>
    </div>
  );
}

export function Field({
  label,
  wide,
  children,
}: {
  label: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={`space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

export function Pick({
  label,
  value,
  items,
  change,
}: {
  label: string;
  value: string;
  items: string[];
  change: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <Select value={value} onValueChange={change}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {items.map(i => (
            <SelectItem key={i} value={i}>
              {i}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
