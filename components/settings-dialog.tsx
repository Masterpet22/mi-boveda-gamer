"use client";

import { useState, type ReactNode } from "react";
import { Download, FileJson, Settings2, Upload } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import type { AppSettings, ViewMode } from "@/lib/game-types";
import { platforms, statuses } from "@/lib/game-types";

interface SettingsDialogProps {
  settings: AppSettings;
  setOpen: (open: boolean) => void;
  save: (settings: AppSettings) => Promise<void>;
  exportJson: () => void;
  exportCsv: () => void;
  restore: () => void;
  importing: boolean;
}

export function SettingsDialog({
  settings,
  setOpen,
  save,
  exportJson,
  exportCsv,
  restore,
  importing,
}: SettingsDialogProps) {
  const [draft, setDraft] = useState(settings);
  const [section, setSection] = useState("appearance");
  const [saving, setSaving] = useState(false);
  const sections = [
    ["appearance", "Apariencia"],
    ["library", "Biblioteca"],
    ["import", "Importación"],
    ["sessions", "Sesiones y alertas"],
    ["data", "Datos"],
  ];

  async function submit() {
    setSaving(true);
    await save(draft);
    setSaving(false);
  }

  return (
    <Dialog open onOpenChange={setOpen}>
      <DialogContent className="max-h-[92vh] overflow-y-auto border-white/10 bg-[#0b1628] text-slate-100 sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="text-cyan-300" />
            Configuración
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Personaliza la bóveda. Tus preferencias se sincronizan con tu cuenta.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 md:grid-cols-[190px_minmax(0,1fr)]">
          <nav className="flex gap-1 overflow-x-auto md:flex-col" aria-label="Secciones de configuración">
            {sections.map(([id, label]) => (
              <button
                type="button"
                key={id}
                onClick={() => setSection(id)}
                className={`min-w-max rounded-xl px-3 py-2 text-left text-sm font-medium transition ${
                  section === id
                    ? "bg-violet-500 text-white"
                    : "text-slate-400 hover:bg-white/5 hover:text-white"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          <div className="min-h-80 rounded-2xl border border-white/8 bg-black/10 p-4">
            {section === "appearance" && (
              <SettingsSection title="Apariencia" description="Elige cómo quieres ver tu colección.">
                <SettingsSelect
                  label="Vista predeterminada"
                  value={draft.defaultView}
                  change={value => setDraft({ ...draft, defaultView: value as ViewMode })}
                  options={[
                    ["cards", "Tarjetas"],
                    ["list", "Lista"],
                    ["covers", "Carátulas"],
                    ["series", "Sagas"],
                  ]}
                />
                <SettingsSelect
                  label="Densidad"
                  value={draft.density}
                  change={value =>
                    setDraft({ ...draft, density: value as AppSettings["density"] })
                  }
                  options={[
                    ["comfortable", "Cómoda"],
                    ["compact", "Compacta"],
                  ]}
                />
                <SettingsSelect
                  label="Tamaño de carátulas"
                  value={draft.coverSize}
                  change={value =>
                    setDraft({ ...draft, coverSize: value as AppSettings["coverSize"] })
                  }
                  options={[
                    ["small", "Pequeño"],
                    ["medium", "Mediano"],
                    ["large", "Grande"],
                  ]}
                />
              </SettingsSection>
            )}

            {section === "library" && (
              <SettingsSection
                title="Biblioteca"
                description="Define los valores usados al crear y mostrar juegos."
              >
                <SettingsSelect
                  label="Estado predeterminado"
                  value={draft.defaultStatus}
                  change={value => setDraft({ ...draft, defaultStatus: value })}
                  options={statuses.map(value => [value, value])}
                />
                <SettingsSelect
                  label="Plataforma predeterminada"
                  value={draft.defaultPlatform}
                  change={value => setDraft({ ...draft, defaultPlatform: value })}
                  options={platforms.map(value => [value, value])}
                />
                <SettingsSelect
                  label="Formato predeterminado"
                  value={draft.defaultFormat}
                  change={value => setDraft({ ...draft, defaultFormat: value })}
                  options={[
                    ["Digital", "Digital"],
                    ["Físico", "Físico"],
                  ]}
                />
                <SettingsSelect
                  label="Orden predeterminado"
                  value={draft.defaultSort}
                  change={value => setDraft({ ...draft, defaultSort: value })}
                  options={[
                    ["updated", "Actualizados recientemente"],
                    ["title", "Título A–Z"],
                    ["progress", "Mayor progreso"],
                    ["hours", "Más horas jugadas"],
                    ["release", "Lanzamiento más reciente"],
                  ]}
                />
                <SwitchSetting
                  label="Ocultar abandonados"
                  description="No aparecen en la biblioteca salvo que desactives esta opción."
                  checked={draft.hideAbandoned}
                  change={checked => setDraft({ ...draft, hideAbandoned: checked })}
                />
                <SwitchSetting
                  label="Ocultar pendientes de compra"
                  description="Mantiene la vista centrada en juegos que ya posees."
                  checked={draft.hidePending}
                  change={checked => setDraft({ ...draft, hidePending: checked })}
                />
                <SwitchSetting
                  label="Confirmar antes de eliminar"
                  description="Recomendado para evitar eliminaciones accidentales."
                  checked={draft.confirmDelete}
                  change={checked => setDraft({ ...draft, confirmDelete: checked })}
                />
              </SettingsSection>
            )}

            {section === "import" && (
              <SettingsSection
                title="Importación y metadatos"
                description="Controla cómo se completan las fichas desde Wikidata."
              >
                <SettingsSelect
                  label="Idioma de metadatos"
                  value={draft.metadataLanguage}
                  change={value =>
                    setDraft({ ...draft, metadataLanguage: value as "es" | "en" })
                  }
                  options={[
                    ["es", "Español"],
                    ["en", "Inglés"],
                  ]}
                />
                <SettingsSelect
                  label="Plataforma si no se reconoce"
                  value={draft.fallbackPlatform}
                  change={value => setDraft({ ...draft, fallbackPlatform: value })}
                  options={platforms.map(value => [value, value])}
                />
                <SwitchSetting
                  label="Conservar datos escritos manualmente"
                  description="Los metadatos solo completan campos vacíos."
                  checked={draft.preserveManualData}
                  change={checked => setDraft({ ...draft, preserveManualData: checked })}
                />
              </SettingsSection>
            )}

            {section === "sessions" && (
              <SettingsSection
                title="Sesiones y alertas"
                description="Personaliza las acciones rápidas y los recordatorios."
              >
                <NumberSetting
                  label="Duración del registro rápido"
                  suffix="minutos"
                  value={draft.quickSessionMinutes}
                  min={5}
                  max={240}
                  change={value => setDraft({ ...draft, quickSessionMinutes: value })}
                />
                <NumberSetting
                  label="Incremento rápido de progreso"
                  suffix="%"
                  value={draft.quickProgress}
                  min={1}
                  max={50}
                  change={value => setDraft({ ...draft, quickProgress: value })}
                />
                <NumberSetting
                  label="Avisar tras inactividad"
                  suffix="días"
                  value={draft.inactivityDays}
                  min={1}
                  max={365}
                  change={value => setDraft({ ...draft, inactivityDays: value })}
                />
                <SwitchSetting
                  label="Terminar automáticamente al llegar al 100 %"
                  description="Actualiza el estado y la fecha de finalización."
                  checked={draft.autoFinishAt100}
                  change={checked => setDraft({ ...draft, autoFinishAt100: checked })}
                />
              </SettingsSection>
            )}

            {section === "data" && (
              <SettingsSection
                title="Datos y copias"
                description="Descarga o restaura la información de tu bóveda."
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <Button variant="outline" onClick={exportJson}>
                    <FileJson />
                    Exportar copia completa
                  </Button>
                  <Button variant="outline" onClick={exportCsv}>
                    <Download />
                    Exportar lista CSV
                  </Button>
                  <Button variant="outline" onClick={restore} disabled={importing}>
                    <Upload />
                    {importing ? "Importando…" : "Restaurar copia JSON"}
                  </Button>
                </div>
                <p className="text-sm leading-6 text-slate-500">
                  Tus juegos, sesiones y preferencias se guardan de forma privada en Firebase bajo tu usuario.
                </p>
              </SettingsSection>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button className="bg-violet-500" onClick={submit} disabled={saving}>
            {saving ? "Guardando…" : "Guardar configuración"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-bold">{title}</h3>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function SettingsSelect({
  label,
  value,
  change,
  options,
}: {
  label: string;
  value: string;
  change: (value: string) => void;
  options: string[][];
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-400">{label}</Label>
      <Select value={value} onValueChange={change}>
        <SelectTrigger className="border-white/8 bg-[#07101f]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map(([id, text]) => (
            <SelectItem key={id} value={id}>
              {text}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function SwitchSetting({
  label,
  description,
  checked,
  change,
}: {
  label: string;
  description: string;
  checked: boolean;
  change: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-white/[.025] p-3 sm:col-span-2">
      <div>
        <Label className="font-semibold">{label}</Label>
        <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={change} aria-label={label} />
    </div>
  );
}

function NumberSetting({
  label,
  suffix,
  value,
  min,
  max,
  change,
}: {
  label: string;
  suffix: string;
  value: number;
  min: number;
  max: number;
  change: (value: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-slate-400">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          value={value}
          min={min}
          max={max}
          onChange={event =>
            change(Math.min(max, Math.max(min, Number(event.target.value))))
          }
        />
        <span className="text-sm text-slate-500">{suffix}</span>
      </div>
    </div>
  );
}
