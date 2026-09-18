export type Session = {
  id: string;
  date: string;
  hours: number;
  note: string;
};

export type Goals = {
  yearlyFinished: number;
  backlogLimit: number;
  monthlyHours: number;
  activeLimit: number;
};

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

export type Game = {
  id: string;
  title: string;
  platform: string;
  format: string;
  status: string;
  progress: number;
  hours: number;
  estimatedHours: number;
  difficulty: string;
  priority: string;
  series: string;
  lists: string[];
  nextGoal: string;
  notes: string;
  coverUrl: string;
  genre: string;
  developer: string;
  releaseYear: number;
  description: string;
  rating: number;
  startedAt: string;
  finishedAt: string;
  sessions: Session[];
  source: string;
  sourceId: string;
  updatedAt: string;
  isPrivate?: boolean;
};

export type Draft = Omit<Game, "id" | "updatedAt">;

export type ViewMode = "cards" | "list" | "covers" | "series";

export type AppSettings = {
  defaultView: ViewMode;
  density: "comfortable" | "compact";
  coverSize: "small" | "medium" | "large";
  defaultStatus: string;
  defaultPlatform: string;
  defaultFormat: string;
  defaultSort: string;
  hideAbandoned: boolean;
  hidePending: boolean;
  confirmDelete: boolean;
  metadataLanguage: "es" | "en";
  fallbackPlatform: string;
  preserveManualData: boolean;
  quickSessionMinutes: number;
  quickProgress: number;
  autoFinishAt100: boolean;
  inactivityDays: number;
};

export const platforms = ["3DS", "Series S", "PS2", "GameCube", "GBA", "Switch", "PC", "Otra"];
export const statuses = [
  "Jugando",
  "Backlog",
  "Pausado",
  "Terminado",
  "Completado",
  "Abandonado",
  "Pendiente de compra",
];
export const customLists = [
  "Favoritos",
  "Próximos a jugar",
  "Pendientes de comprar",
  "Cooperativos",
  "Completados al 100 %",
];

export const defaultGoals: Goals = {
  yearlyFinished: 12,
  backlogLimit: 20,
  monthlyHours: 20,
  activeLimit: 5,
};

export const defaultSettings: AppSettings = {
  defaultView: "cards",
  density: "comfortable",
  coverSize: "medium",
  defaultStatus: "Backlog",
  defaultPlatform: "Otra",
  defaultFormat: "Digital",
  defaultSort: "updated",
  hideAbandoned: false,
  hidePending: false,
  confirmDelete: true,
  metadataLanguage: "es",
  fallbackPlatform: "Otra",
  preserveManualData: true,
  quickSessionMinutes: 30,
  quickProgress: 10,
  autoFinishAt100: true,
  inactivityDays: 30,
};

export const blank: Draft = {
  title: "",
  platform: "Otra",
  format: "Digital",
  status: "Backlog",
  progress: 0,
  hours: 0,
  estimatedHours: 0,
  difficulty: "Sin indicar",
  priority: "Normal",
  series: "",
  lists: [],
  nextGoal: "",
  notes: "",
  coverUrl: "",
  genre: "",
  developer: "",
  releaseYear: 0,
  description: "",
  rating: 0,
  startedAt: "",
  finishedAt: "",
  sessions: [],
  source: "Manual",
  sourceId: "",
  isPrivate: false,
};

export const statusStyle: Record<string, string> = {
  Jugando: "bg-cyan-400/10 text-cyan-300 border-cyan-400/20",
  Backlog: "bg-violet-400/10 text-violet-300 border-violet-400/20",
  Pausado: "bg-amber-400/10 text-amber-300 border-amber-400/20",
  Terminado: "bg-emerald-400/10 text-emerald-300 border-emerald-400/20",
  Completado: "bg-lime-400/10 text-lime-300 border-lime-400/20",
  Abandonado: "bg-slate-400/10 text-slate-300 border-slate-400/20",
  "Pendiente de compra": "bg-fuchsia-400/10 text-fuchsia-300 border-fuchsia-400/20",
};

export const color: Record<string, string> = {
  "3DS": "from-red-500 to-orange-400",
  "Series S": "from-emerald-500 to-green-300",
  PS2: "from-indigo-500 to-blue-400",
  GameCube: "from-violet-600 to-fuchsia-400",
  GBA: "from-sky-500 to-cyan-300",
  Switch: "from-rose-500 to-red-300",
  PC: "from-slate-500 to-slate-300",
  Otra: "from-amber-500 to-yellow-300",
};

export const normalizeTitle = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export function formatDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Sin registrar";
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime())
    ? "Sin registrar"
    : new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(date);
}

export function formatElapsed(milliseconds: number) {
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return [hours, minutes, seconds % 60].map(v => String(v).padStart(2, "0")).join(":");
}
