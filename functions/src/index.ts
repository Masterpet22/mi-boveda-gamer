import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { randomUUID } from "node:crypto";
import { HttpsError, onCall, onRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";

initializeApp();

const steamApiKey = defineSecret("STEAM_API_KEY");
const xboxClientId = defineSecret("XBOX_CLIENT_ID");
const xboxClientSecret = defineSecret("XBOX_CLIENT_SECRET");
const xboxRedirectUri = "https://southamerica-east1-bovedavideojuegos.cloudfunctions.net/xboxAuthCallback";
const appReturnUri = "https://masterpet22.github.io/mi-boveda-gamer/";

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

export const startXboxConnection = onCall(
  { region: "southamerica-east1", secrets: [xboxClientId] },
  async request => {
    if (!request.auth) throw new HttpsError("unauthenticated", "Inicia sesión para conectar Xbox.");
    const state = randomUUID();
    await getFirestore().collection("oauthStates").doc(state).set({
      uid: request.auth.uid,
      provider: "xbox",
      createdAt: FieldValue.serverTimestamp(),
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
    const params = new URLSearchParams({
      client_id: xboxClientId.value(),
      response_type: "code",
      approval_prompt: "auto",
      scope: "XboxLive.signin XboxLive.offline_access",
      redirect_uri: xboxRedirectUri,
      state,
    });
    return { url: `https://login.live.com/oauth20_authorize.srf?${params}` };
  },
);

type XboxTitle = {
  titleId?: string | number;
  name?: string;
  displayImage?: string;
  devices?: string[];
  achievement?: { progressPercentage?: number };
};

export const xboxAuthCallback = onRequest(
  { region: "southamerica-east1", secrets: [xboxClientId, xboxClientSecret], timeoutSeconds: 120 },
  async (request, response) => {
    const redirect = (status: string, detail?: string) => {
      const destination = new URL(appReturnUri);
      destination.searchParams.set("xbox", status);
      if (detail) destination.searchParams.set("reason", detail);
      response.redirect(destination.toString());
    };
    try {
      const code = String(request.query.code ?? "");
      const state = String(request.query.state ?? "");
      if (!code || !state) return redirect("error", "missing_callback_data");

      const db = getFirestore();
      const stateRef = db.collection("oauthStates").doc(state);
      const stateSnapshot = await stateRef.get();
      const stateData = stateSnapshot.data() as { uid?: string; provider?: string; expiresAt?: number } | undefined;
      if (!stateData?.uid || stateData.provider !== "xbox" || (stateData.expiresAt ?? 0) < Date.now()) {
        return redirect("error", "invalid_or_expired_state");
      }
      await stateRef.delete();

      const tokenResponse = await fetch("https://login.live.com/oauth20_token.srf", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: xboxClientId.value(),
          client_secret: xboxClientSecret.value(),
          code,
          grant_type: "authorization_code",
          redirect_uri: xboxRedirectUri,
          scope: "XboxLive.signin XboxLive.offline_access",
        }),
      });
      if (!tokenResponse.ok) throw new Error(`microsoft_token_${tokenResponse.status}`);
      const microsoft = await tokenResponse.json() as { access_token: string; refresh_token?: string; expires_in?: number };

      const userTokenResponse = await fetch("https://user.auth.xboxlive.com/user/authenticate", {
        method: "POST",
        headers: { "content-type": "application/json", "x-xbl-contract-version": "1" },
        body: JSON.stringify({
          RelyingParty: "http://auth.xboxlive.com",
          TokenType: "JWT",
          Properties: { AuthMethod: "RPS", SiteName: "user.auth.xboxlive.com", RpsTicket: `d=${microsoft.access_token}` },
        }),
      });
      if (!userTokenResponse.ok) throw new Error(`xbox_user_token_${userTokenResponse.status}`);
      const userToken = await userTokenResponse.json() as { Token: string };

      const xstsResponse = await fetch("https://xsts.auth.xboxlive.com/xsts/authorize", {
        method: "POST",
        headers: { "content-type": "application/json", "x-xbl-contract-version": "1" },
        body: JSON.stringify({
          Properties: { SandboxId: "RETAIL", UserTokens: [userToken.Token] },
          RelyingParty: "http://xboxlive.com",
          TokenType: "JWT",
        }),
      });
      if (!xstsResponse.ok) throw new Error(`xsts_token_${xstsResponse.status}`);
      const xsts = await xstsResponse.json() as {
        Token: string;
        DisplayClaims: { xui: Array<{ uhs: string; xid?: string }> };
      };
      const claim = xsts.DisplayClaims.xui[0];
      const xuid = claim.xid;
      if (!xuid) throw new Error("xbox_xuid_missing");

      const historyResponse = await fetch(`https://achievements.xboxlive.com/users/xuid(${xuid})/history/titles?maxItems=1000`, {
        headers: {
          authorization: `XBL3.0 x=${claim.uhs};${xsts.Token}`,
          "x-xbl-contract-version": "2",
          "accept-language": "es-ES",
        },
      });
      if (!historyResponse.ok) throw new Error(`xbox_history_${historyResponse.status}`);
      const history = await historyResponse.json() as { titles?: XboxTitle[] };
      const titles = history.titles ?? [];
      const games = db.collection("users").doc(stateData.uid).collection("games");
      for (let offset = 0; offset < titles.length; offset += 400) {
        const batch = db.batch();
        for (const title of titles.slice(offset, offset + 400)) {
          const sourceId = String(title.titleId ?? "");
          if (!sourceId) continue;
          const progress = Math.round(title.achievement?.progressPercentage ?? 0);
          batch.set(games.doc(`xbox_${sourceId}`), {
            title: title.name ?? `Xbox ${sourceId}`,
            platform: "Series S",
            format: "Digital",
            status: progress >= 100 ? "Completado" : "Backlog",
            progress,
            hours: 0,
            priority: "Normal",
            series: "",
            nextGoal: "",
            notes: "",
            coverUrl: title.displayImage ?? "",
            genre: "",
            developer: "",
            releaseYear: 0,
            source: "Xbox",
            sourceId,
            devices: title.devices ?? [],
            updatedAt: FieldValue.serverTimestamp(),
            importedAt: FieldValue.serverTimestamp(),
          }, { merge: true });
        }
        await batch.commit();
      }
      await db.collection("users").doc(stateData.uid).collection("privateConnections").doc("xbox").set({
        xuid,
        refreshToken: microsoft.refresh_token ?? null,
        expiresIn: microsoft.expires_in ?? null,
        connectedAt: FieldValue.serverTimestamp(),
        importedTitles: titles.length,
      }, { merge: true });
      return redirect("connected");
    } catch (error) {
      console.error("Xbox OAuth callback failed", error);
      return redirect("error", "connection_failed");
    }
  },
);
