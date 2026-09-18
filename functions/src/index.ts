import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

initializeApp();

const steamApiKey = defineSecret("STEAM_API_KEY");

type SteamGame = {
  appid: number;
  name?: string;
  playtime_forever?: number;
};

export const syncSteamLibrary = onCall(
  { region: "southamerica-east1", secrets: [steamApiKey], timeoutSeconds: 120 },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión para importar tu biblioteca.");
    const steamId = String(request.data?.steamId ?? "").trim();
    if (!/^\d{17}$/.test(steamId)) throw new HttpsError("invalid-argument", "SteamID64 no válido.");

    const params = new URLSearchParams({
      key: steamApiKey.value(),
      steamid: steamId,
      include_appinfo: "true",
      include_played_free_games: "true",
      format: "json",
    });
    const response = await fetch(`https://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?${params}`);
    if (!response.ok) throw new HttpsError("unavailable", "Steam no respondió correctamente.");
    const body = await response.json() as { response?: { games?: SteamGame[] } };
    const games = body.response?.games;
    if (!games) throw new HttpsError("failed-precondition", "Steam no devolvió juegos. Revisa la privacidad del perfil.");

    const db = getFirestore();
    const collection = db.collection("users").doc(request.auth.uid).collection("games");
    for (let offset = 0; offset < games.length; offset += 400) {
      const batch = db.batch();
      for (const game of games.slice(offset, offset + 400)) {
        batch.set(collection.doc(`steam_${game.appid}`), {
          title: game.name ?? `Steam App ${game.appid}`,
          platform: "PC",
          format: "Digital",
          status: "Backlog",
          progress: 0,
          hours: Math.round(((game.playtime_forever ?? 0) / 60) * 10) / 10,
          priority: "Normal",
          series: "",
          nextGoal: "",
          notes: "",
          coverUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${game.appid}/header.jpg`,
          genre: "",
          developer: "",
          releaseYear: 0,
          source: "Steam",
          sourceId: String(game.appid),
          steamId,
          updatedAt: FieldValue.serverTimestamp(),
          importedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
      }
      await batch.commit();
    }
    return { imported: games.length };
  },
);
