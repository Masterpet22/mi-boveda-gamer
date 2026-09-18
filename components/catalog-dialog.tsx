"use client";

import { useState } from "react";
import { Check, Library, Plus, Search } from "lucide-react";
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
import type { AppSettings, Draft, Game } from "@/lib/game-types";
import { blank, normalizeTitle } from "@/lib/game-types";
import {
  getWikidataGame,
  searchWikidataCatalog,
  type WikidataResult,
} from "@/lib/wikidata";

interface CatalogDialogProps {
  games: Game[];
  settings: AppSettings;
  setOpen: (open: boolean) => void;
  addGames: (games: Draft[]) => Promise<number>;
}

export function CatalogDialog({ games, settings, setOpen, addGames }: CatalogDialogProps) {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<WikidataResult[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");

  const exists = (result: WikidataResult) =>
    games.some(
      game => game.sourceId === result.id || normalizeTitle(game.title) === normalizeTitle(result.label)
    );

  const available = results.filter(result => !exists(result));

  async function search() {
    if (term.trim().length < 2) return toast.error("Escribe al menos dos letras.");
    setSearching(true);
    setMessage("");
    setSelected(new Set());
    try {
      const matches = await searchWikidataCatalog(term.trim());
      setResults(matches);
      if (!matches.length) {
        setMessage("No encontramos títulos. Prueba con otro nombre o agrega el juego manualmente.");
      }
    } catch (error) {
      console.error(error);
      setMessage("Wikidata no respondió. Inténtalo nuevamente.");
    } finally {
      setSearching(false);
    }
  }

  function toggle(id: string) {
    setSelected(current => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function addSelected() {
    const chosen = results.filter(result => selected.has(result.id) && !exists(result));
    if (!chosen.length) return;
    setAdding(true);
    setProgress(0);
    const entries: Draft[] = [];
    let failed = 0;
    try {
      for (let index = 0; index < chosen.length; index++) {
        try {
          const metadata = await getWikidataGame(chosen[index], settings);
          entries.push({
            ...blank,
            status: settings.defaultStatus,
            platform: settings.defaultPlatform,
            format: settings.defaultFormat,
            ...metadata,
            title: String(metadata.title || chosen[index].label),
            lists: [],
            sessions: [],
          });
        } catch (error) {
          console.error(error);
          failed++;
        }
        setProgress(index + 1);
      }
      const added = await addGames(entries);
      if (failed) {
        toast.warning(
          failed === 1 ? "Una ficha no se pudo importar" : `${failed} fichas no se pudieron importar`
        );
      }
      if (added) setOpen(false);
    } catch (error) {
      console.error(error);
      toast.error("La importación se interrumpió. Inténtalo nuevamente.");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog
      open
      onOpenChange={value => {
        if (!adding) setOpen(value);
      }}
    >
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Search className="text-cyan-300" />
            Explorar catálogo
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Busca un título o escribe el nombre de una saga, selecciona varios juegos y agrégalos juntos. Los que ya tienes aparecen bloqueados.
          </DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <Input
            autoFocus
            value={term}
            onChange={event => setTerm(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") {
                event.preventDefault();
                void search();
              }
            }}
            placeholder="Ej. Halo, Zelda, Final Fantasy…"
          />
          <Button onClick={search} disabled={searching || adding} className="bg-violet-500">
            <Search />
            {searching ? "Buscando…" : "Buscar"}
          </Button>
        </div>
        {message && <p className="text-sm text-amber-300">{message}</p>}
        {results.length > 0 && (
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span className="text-slate-400">
                {available.length} disponible{available.length === 1 ? "" : "s"} ·{" "}
                {results.length - available.length} en tu bóveda
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={!available.length || adding}
                onClick={() => setSelected(new Set(available.map(result => result.id)))}
              >
                Seleccionar disponibles
              </Button>
            </div>
            <div className="max-h-[52vh] space-y-2 overflow-y-auto pr-1">
              {results.map(result => {
                const already = exists(result);
                const checked = selected.has(result.id);
                return (
                  <button
                    type="button"
                    key={result.id}
                    disabled={already || adding}
                    onClick={() => toggle(result.id)}
                    className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition ${
                      already
                        ? "cursor-not-allowed border-emerald-400/15 bg-emerald-400/5 opacity-65"
                        : checked
                        ? "border-violet-400 bg-violet-500/15"
                        : "border-white/8 bg-black/15 hover:border-white/20 hover:bg-white/5"
                    }`}
                  >
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-lg ${
                        already
                          ? "bg-emerald-400/10 text-emerald-300"
                          : checked
                          ? "bg-violet-500 text-white"
                          : "bg-white/7 text-slate-400"
                      }`}
                    >
                      {already ? (
                        <Library className="size-4" />
                      ) : checked ? (
                        <Check className="size-4" />
                      ) : (
                        <Plus className="size-4" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{result.label}</span>
                      <span className="block truncate text-xs text-slate-400">
                        {result.description || "Sin descripción"} · {result.id}
                      </span>
                    </span>
                    {already && (
                      <Badge variant="outline" className="border-emerald-400/20 text-emerald-300">
                        Ya está en tu bóveda
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={adding}>
            Cancelar
          </Button>
          <Button
            className="bg-violet-500"
            onClick={addSelected}
            disabled={!selected.size || adding}
          >
            {adding
              ? `Preparando fichas ${progress}/${selected.size}…`
              : `Agregar ${selected.size || ""} seleccionado${selected.size === 1 ? "" : "s"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
