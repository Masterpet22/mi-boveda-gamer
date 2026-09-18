import { doc, getDoc, setDoc, serverTimestamp, type Firestore } from "firebase/firestore";

export interface PublicProfileSettings {
  isPublic: boolean;
  handle: string;
  bio: string;
  hideNotes: boolean;
  hideSessions: boolean;
  hideHours: boolean;
  hideWishlist: boolean;
}

export interface PublicGame {
  id: string;
  title: string;
  platform: string;
  format: string;
  status: string;
  progress: number;
  hours: number;
  priority: string;
  series: string;
  nextGoal: string;
  notes?: string;
  coverUrl: string;
  genre: string;
  developer: string;
  releaseYear: number;
  description: string;
  rating: number;
  startedAt: string;
  finishedAt: string;
  sessions?: { date: string; hours: number; note: string }[];
  updatedAt: string;
}

export interface PublicProfileData {
  userId: string;
  handle: string;
  bio: string;
  isPublic: boolean;
  updatedAt: string;
  settings: {
    hideNotes: boolean;
    hideSessions: boolean;
    hideHours: boolean;
    hideWishlist: boolean;
  };
  stats: {
    total: number;
    active: number;
    done: number;
    hours: number;
    consoles: { platform: string; count: number }[];
  };
  games: PublicGame[];
}

export const defaultProfileSettings: PublicProfileSettings = {
  isPublic: false,
  handle: "Gamer",
  bio: "Mi colección de videojuegos y registro de partidas en Mi Bóveda Gamer.",
  hideNotes: true,
  hideSessions: true,
  hideHours: false,
  hideWishlist: false,
};

export function sanitizeGamesForPublic(
  rawGames: Array<PublicGame & { isPrivate?: boolean }>,
  settings: PublicProfileSettings
): { sanitizedGames: PublicGame[]; stats: PublicProfileData["stats"] } {
  // 1. Filter out private games
  let list = rawGames.filter(g => !g.isPrivate);

  // 2. Optionally filter wishlist ("Pendiente de compra")
  if (settings.hideWishlist) {
    list = list.filter(g => g.status !== "Pendiente de compra");
  }

  // 3. Sanitize individual fields based on privacy toggles
  const sanitizedGames: PublicGame[] = list.map(g => {
    const rawCover = typeof g.coverUrl === "string" ? g.coverUrl.trim() : "";
    const safeCoverUrl = rawCover.startsWith("data:") || rawCover.length > 2048 ? "" : rawCover;

    return {
      id: g.id,
      title: g.title,
      platform: g.platform,
      format: g.format,
      status: g.status,
      progress: g.progress,
      hours: settings.hideHours ? 0 : g.hours,
      priority: g.priority,
      series: g.series,
      nextGoal: g.nextGoal,
      notes: settings.hideNotes ? "" : g.notes,
      coverUrl: safeCoverUrl,
      genre: g.genre,
      developer: g.developer,
      releaseYear: g.releaseYear,
      description: g.description,
      rating: g.rating,
      startedAt: g.startedAt,
      finishedAt: g.finishedAt,
      sessions: settings.hideSessions
        ? []
        : (g.sessions ?? []).map(s => ({
            date: s.date,
            hours: settings.hideHours ? 0 : s.hours,
            note: settings.hideNotes ? "" : s.note,
          })),
      updatedAt: g.updatedAt,
    };
  });

  // 4. Compute public stats
  const total = sanitizedGames.length;
  const active = sanitizedGames.filter(g => g.status === "Jugando").length;
  const done = sanitizedGames.filter(g => ["Terminado", "Completado"].includes(g.status)).length;
  const hours = settings.hideHours
    ? 0
    : Math.round(sanitizedGames.reduce((acc, g) => acc + g.hours, 0) * 10) / 10;

  const consoleCounts: Record<string, number> = {};
  for (const g of sanitizedGames) {
    consoleCounts[g.platform] = (consoleCounts[g.platform] ?? 0) + 1;
  }
  const consoles = Object.entries(consoleCounts)
    .map(([platform, count]) => ({ platform, count }))
    .sort((a, b) => b.count - a.count);

  return {
    sanitizedGames,
    stats: { total, active, done, hours, consoles },
  };
}

export async function savePublicProfileToFirestore(
  db: Firestore,
  userId: string,
  settings: PublicProfileSettings,
  rawGames: Array<PublicGame & { isPrivate?: boolean }>
): Promise<PublicProfileData> {
  const { sanitizedGames, stats } = sanitizeGamesForPublic(rawGames, settings);

  let finalGames = sanitizedGames;

  // Protect Firestore against 1 MiB (1,048,576 bytes) hard document limit
  const estimateSize = (games: PublicGame[]) => {
    return new TextEncoder().encode(
      JSON.stringify({
        userId,
        handle: settings.handle,
        bio: settings.bio,
        isPublic: settings.isPublic,
        settings,
        stats,
        games,
      })
    ).length;
  };

  if (estimateSize(finalGames) > 850000) {
    // 1st mitigation: trim descriptions and remove notes/sessions
    finalGames = finalGames.map(g => ({
      ...g,
      description: g.description ? g.description.slice(0, 180) : "",
      notes: "",
      sessions: [],
    }));
  }

  // 2nd mitigation: if still excessively large, cap games to fit safely under 900KB
  while (finalGames.length > 50 && estimateSize(finalGames) > 900000) {
    finalGames = finalGames.slice(0, Math.floor(finalGames.length * 0.85));
  }

  const payload: PublicProfileData = {
    userId,
    handle: settings.handle.trim() || "Gamer",
    bio: settings.bio.trim(),
    isPublic: settings.isPublic,
    updatedAt: new Date().toISOString(),
    settings: {
      hideNotes: settings.hideNotes,
      hideSessions: settings.hideSessions,
      hideHours: settings.hideHours,
      hideWishlist: settings.hideWishlist,
    },
    stats,
    games: finalGames,
  };

  const ref = doc(db, "publicProfiles", userId);
  await setDoc(ref, {
    ...payload,
    timestamp: serverTimestamp(),
  });

  return payload;
}

export async function fetchPublicProfileFromFirestore(
  db: Firestore,
  userId: string
): Promise<PublicProfileData | null> {
  try {
    const ref = doc(db, "publicProfiles", userId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    const data = snap.data() as PublicProfileData;
    if (!data.isPublic) return null;
    return data;
  } catch (err) {
    console.error("Error fetching public profile:", err);
    return null;
  }
}

export async function disablePublicProfileInFirestore(
  db: Firestore,
  userId: string
): Promise<void> {
  const ref = doc(db, "publicProfiles", userId);
  await setDoc(ref, { isPublic: false, updatedAt: new Date().toISOString() }, { merge: true });
}

export function generateLibrarySummaryMarkdown(
  handle: string,
  stats: PublicProfileData["stats"],
  games: PublicGame[],
  shareUrl?: string
): string {
  const playing = games.filter(g => g.status === "Jugando");
  const completed = games.filter(g => ["Terminado", "Completado"].includes(g.status));

  let md = `### 🎮 Bóveda Gamer de ${handle}\n\n`;
  md += `**Resumen de la colección:**\n`;
  md += `- 📚 **Total de juegos:** ${stats.total}\n`;
  md += `- 🕹️ **Jugando actualmente:** ${stats.active}\n`;
  md += `- 🏆 **Terminados/Completados:** ${stats.done}\n`;
  if (stats.hours > 0) {
    md += `- ⏱️ **Horas registradas:** ${stats.hours} h\n`;
  }

  if (playing.length > 0) {
    md += `\n**Partidas activas:**\n`;
    for (const g of playing.slice(0, 5)) {
      md += `- **${g.title}** (${g.platform}) — ${g.progress}%\n`;
    }
  }

  if (completed.length > 0) {
    md += `\n**Últimos terminados:**\n`;
    for (const g of completed.slice(0, 5)) {
      const rating = g.rating > 0 ? ` ⭐ ${g.rating}/10` : "";
      md += `- **${g.title}** (${g.platform})${rating}\n`;
    }
  }

  if (stats.consoles.length > 0) {
    md += `\n**Plataformas:** ` + stats.consoles.map(c => `${c.platform} (${c.count})`).join(" · ") + `\n`;
  }

  if (shareUrl) {
    md += `\n🔗 *Explora la colección completa en*: ${shareUrl}\n`;
  }

  return md;
}

export function generateLibrarySummaryText(
  handle: string,
  stats: PublicProfileData["stats"],
  games: PublicGame[],
  shareUrl?: string
): string {
  const playing = games.filter(g => g.status === "Jugando");
  let text = `🎮 Mi Bóveda Gamer — ${handle}\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `📚 ${stats.total} juegos | 🕹️ ${stats.active} jugando | 🏆 ${stats.done} terminados`;
  if (stats.hours > 0) text += ` | ⏱️ ${stats.hours}h`;
  text += `\n\n`;

  if (playing.length > 0) {
    text += `Partidas en curso:\n`;
    for (const g of playing.slice(0, 5)) {
      text += `• ${g.title} [${g.platform}] (${g.progress}%)\n`;
    }
    text += `\n`;
  }

  if (shareUrl) {
    text += `Ver colección interactiva: ${shareUrl}\n`;
  }

  return text.trim();
}
