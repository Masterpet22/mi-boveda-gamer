import type { AppSettings, Draft } from "./game-types";
import { defaultSettings } from "./game-types";

export type WikidataResult = {
  id: string;
  label: string;
  description?: string;
};

export type WikidataClaim = {
  mainsnak?: {
    datavalue?: {
      value?: unknown;
    };
  };
};

export async function searchWikidataEntities(
  title: string,
  language = "es",
  limit = 10
): Promise<WikidataResult[]> {
  const params = new URLSearchParams({
    action: "wbsearchentities",
    search: title,
    language,
    uselang: "es",
    type: "item",
    limit: String(Math.min(50, Math.max(10, limit))),
    format: "json",
    origin: "*",
  });
  const response = await fetch(`https://www.wikidata.org/w/api.php?${params}`);
  if (!response.ok) throw new Error("Wikidata search failed");
  const data = (await response.json()) as { search?: WikidataResult[] };
  return data.search ?? [];
}

export async function searchWikidataGames(title: string, limit = 6): Promise<WikidataResult[]> {
  const results = await searchWikidataEntities(title, "es", limit);
  const looksLikeGame = (item: WikidataResult) =>
    /videojuego|video game|juego electrónico|jeu vidéo/i.test(item.description ?? "");
  return [
    ...results.filter(looksLikeGame),
    ...results.filter(item => !looksLikeGame(item)),
  ].slice(0, limit);
}

export async function getWikidataSeriesGames(seriesId: string): Promise<WikidataResult[]> {
  if (!/^Q\d+$/.test(seriesId)) return [];
  const sparql = `SELECT DISTINCT ?game WHERE { ?game wdt:P179+ wd:${seriesId}; wdt:P31/wdt:P279* wd:Q7889. } LIMIT 50`;
  const params = new URLSearchParams({ query: sparql, format: "json", origin: "*" });
  const response = await fetch(`https://query.wikidata.org/sparql?${params}`);
  if (!response.ok) throw new Error("Wikidata series failed");
  const data = (await response.json()) as {
    results?: { bindings?: Array<{ game?: { value?: string } }> };
  };
  const ids = [
    ...new Set(
      (data.results?.bindings ?? [])
        .map(item => item.game?.value?.split("/").pop() ?? "")
        .filter(id => /^Q\d+$/.test(id))
    ),
  ];
  if (!ids.length) return [];
  const entityParams = new URLSearchParams({
    action: "wbgetentities",
    ids: ids.join("|"),
    props: "labels|descriptions",
    languages: "es|en",
    languagefallback: "1",
    format: "json",
    origin: "*",
  });
  const entityResponse = await fetch(`https://www.wikidata.org/w/api.php?${entityParams}`);
  if (!entityResponse.ok) throw new Error("Wikidata labels failed");
  const entities = (await entityResponse.json()) as {
    entities?: Record<
      string,
      {
        labels?: Record<string, { value: string }>;
        descriptions?: Record<string, { value: string }>;
      }
    >;
  };
  return ids.map(id => ({
    id,
    label:
      entities.entities?.[id]?.labels?.es?.value ??
      entities.entities?.[id]?.labels?.en?.value ??
      id,
    description:
      entities.entities?.[id]?.descriptions?.es?.value ??
      entities.entities?.[id]?.descriptions?.en?.value ??
      "Videojuego de la saga",
  }));
}

export async function searchWikidataCatalog(title: string): Promise<WikidataResult[]> {
  const [spanish, english] = await Promise.all([
    searchWikidataEntities(title, "es", 40),
    searchWikidataEntities(title, "en", 40),
  ]);
  const combined = [...new Map([...spanish, ...english].map(item => [item.id, item])).values()];
  const seriesPattern =
    /serie de videojuegos|franquicia de videojuegos|video game series|video game franchise/i;
  const gamePattern = /videojuego|video game|juego electrónico|jeu vidéo/i;
  const series = combined.filter(item => seriesPattern.test(item.description ?? "")).slice(0, 2);
  const direct = combined.filter(
    item => gamePattern.test(item.description ?? "") && !seriesPattern.test(item.description ?? "")
  );
  const sagaGames: WikidataResult[] = [];
  for (const item of series) {
    try {
      sagaGames.push(...(await getWikidataSeriesGames(item.id)));
    } catch (error) {
      console.warn("Wikidata series", error);
    }
  }
  return [...new Map([...sagaGames, ...direct].map(item => [item.id, item])).values()].slice(0, 50);
}

function claimEntityIds(claims: Record<string, WikidataClaim[]>, property: string): string[] {
  return (claims[property] ?? [])
    .map(claim => (claim.mainsnak?.datavalue?.value as { id?: string } | undefined)?.id)
    .filter((id): id is string => !!id);
}

function claimText(claims: Record<string, WikidataClaim[]>, property: string): string {
  return String(claims[property]?.[0]?.mainsnak?.datavalue?.value ?? "");
}

function claimTime(claims: Record<string, WikidataClaim[]>, property: string): string {
  const value = claims[property]?.[0]?.mainsnak?.datavalue?.value;
  return typeof value === "object" && value !== null && "time" in value
    ? String((value as { time?: unknown }).time ?? "")
    : "";
}

function platformFromLabels(labels: string[]): string {
  const text = labels.join(" ").toLowerCase();
  if (text.includes("nintendo switch")) return "Switch";
  if (text.includes("xbox series")) return "Series S";
  if (text.includes("playstation 2")) return "PS2";
  if (text.includes("nintendo 3ds")) return "3DS";
  if (text.includes("gamecube")) return "GameCube";
  if (text.includes("game boy advance")) return "GBA";
  if (/windows|linux|macos|mac os|personal computer/.test(text)) return "PC";
  return "Otra";
}

export async function getWikidataGame(
  result: WikidataResult,
  settings: AppSettings = defaultSettings
): Promise<Partial<Draft>> {
  const preferred = settings.metadataLanguage;
  const fallback = preferred === "es" ? "en" : "es";
  const languages = `${preferred}|${fallback}`;
  const params = new URLSearchParams({
    action: "wbgetentities",
    ids: result.id,
    props: "claims|labels|sitelinks|descriptions",
    sitefilter: "eswiki|enwiki",
    languages,
    languagefallback: "1",
    format: "json",
    origin: "*",
  });
  const response = await fetch(`https://www.wikidata.org/w/api.php?${params}`);
  if (!response.ok) throw new Error("Wikidata entity failed");
  const data = (await response.json()) as {
    entities?: Record<
      string,
      {
        labels?: Record<string, { value: string }>;
        descriptions?: Record<string, { value: string }>;
        claims?: Record<string, WikidataClaim[]>;
        sitelinks?: Record<string, { title: string }>;
      }
    >;
  };
  const entity = data.entities?.[result.id];
  const claims = entity?.claims ?? {};
  let referenceClaims: Record<string, WikidataClaim[]> = {};
  const referenceId = claimEntityIds(claims, "P144")[0];
  if (referenceId) {
    const referenceParams = new URLSearchParams({
      action: "wbgetentities",
      ids: referenceId,
      props: "claims",
      format: "json",
      origin: "*",
    });
    const referenceResponse = await fetch(`https://www.wikidata.org/w/api.php?${referenceParams}`);
    if (referenceResponse.ok) {
      const referenceData = (await referenceResponse.json()) as {
        entities?: Record<string, { claims?: Record<string, WikidataClaim[]> }>;
      };
      referenceClaims = referenceData.entities?.[referenceId]?.claims ?? {};
    }
  }
  const relatedIds = [
    ...new Set([
      ...claimEntityIds(claims, "P136"),
      ...claimEntityIds(claims, "P178"),
      ...claimEntityIds(claims, "P179"),
      ...claimEntityIds(claims, "P400"),
      ...claimEntityIds(referenceClaims, "P136"),
      ...claimEntityIds(referenceClaims, "P179"),
    ]),
  ];
  const labels: Record<string, string> = {};
  if (relatedIds.length) {
    const labelParams = new URLSearchParams({
      action: "wbgetentities",
      ids: relatedIds.join("|"),
      props: "labels",
      languages,
      languagefallback: "1",
      format: "json",
      origin: "*",
    });
    const labelResponse = await fetch(`https://www.wikidata.org/w/api.php?${labelParams}`);
    if (labelResponse.ok) {
      const labelData = (await labelResponse.json()) as {
        entities?: Record<string, { labels?: Record<string, { value: string }> }>;
      };
      for (const [id, item] of Object.entries(labelData.entities ?? {})) {
        labels[id] = item.labels?.[preferred]?.value ?? item.labels?.[fallback]?.value ?? "";
      }
    }
  }
  const names = (property: string, source: Record<string, WikidataClaim[]> = claims) =>
    claimEntityIds(source, property).map(id => labels[id]).filter(Boolean);
  const image = claimText(claims, "P18");
  const release = claimTime(claims, "P577");
  let coverUrl = image
    ? `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(image)}?width=900`
    : "";
  if (!coverUrl) {
    const wiki = entity?.sitelinks?.eswiki ? "es" : entity?.sitelinks?.enwiki ? "en" : "";
    const title = entity?.sitelinks?.[`${wiki}wiki`]?.title;
    if (wiki && title) {
      const imageParams = new URLSearchParams({
        action: "query",
        prop: "pageimages",
        titles: title,
        pithumbsize: "900",
        format: "json",
        origin: "*",
      });
      const imageResponse = await fetch(`https://${wiki}.wikipedia.org/w/api.php?${imageParams}`);
      if (imageResponse.ok) {
        const imageData = (await imageResponse.json()) as {
          query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
        };
        coverUrl = Object.values(imageData.query?.pages ?? {})[0]?.thumbnail?.source ?? "";
      }
    }
  }
  const genreNames = names("P136").length ? names("P136") : names("P136", referenceClaims);
  const seriesNames = names("P179").length ? names("P179") : names("P179", referenceClaims);
  const description =
    entity?.descriptions?.[preferred]?.value ??
    entity?.descriptions?.[fallback]?.value ??
    result.description ??
    "";
  const descriptionYear = description.match(/\b(19|20)\d{2}\b/)?.[0];
  const detectedPlatform = platformFromLabels(names("P400"));
  return {
    title: entity?.labels?.[preferred]?.value ?? entity?.labels?.[fallback]?.value ?? result.label,
    coverUrl,
    genre: genreNames.slice(0, 3).join(", "),
    developer: names("P178").slice(0, 3).join(", "),
    series: seriesNames[0] ?? "",
    platform: detectedPlatform === "Otra" ? settings.fallbackPlatform : detectedPlatform,
    releaseYear: /^[+-]\d{4}/.test(release)
      ? Number(release.slice(1, 5))
      : Number(descriptionYear ?? 0),
    description,
    source: "Wikidata",
    sourceId: result.id,
  };
}
