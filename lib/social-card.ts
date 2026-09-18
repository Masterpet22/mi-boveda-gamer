import type { PublicGame, PublicProfileData } from "./share";

const PLATFORM_COLORS: Record<string, [string, string]> = {
  "3DS": ["#ef4444", "#f97316"],
  "Series S": ["#10b981", "#86efac"],
  PS2: ["#6366f1", "#60a5fa"],
  GameCube: ["#7c3aed", "#e879f9"],
  GBA: ["#0284c7", "#67e8f9"],
  Switch: ["#f43f5e", "#fda4af"],
  PC: ["#64748b", "#cbd5e1"],
  Otra: ["#f59e0b", "#fde047"],
};

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

async function tryLoadImage(src: string): Promise<HTMLImageElement | null> {
  if (!src) return null;
  return new Promise(resolve => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export async function renderGamerSocialCard(
  canvas: HTMLCanvasElement,
  data: {
    handle: string;
    bio?: string;
    stats: PublicProfileData["stats"];
    games: PublicGame[];
  }
): Promise<void> {
  const width = 1200;
  const height = 630;
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1. Background
  ctx.fillStyle = "#07101f";
  ctx.fillRect(0, 0, width, height);

  // Gradient accents / ambient glow
  const glow1 = ctx.createRadialGradient(200, 100, 10, 200, 100, 500);
  glow1.addColorStop(0, "rgba(139, 92, 246, 0.28)");
  glow1.addColorStop(1, "rgba(7, 16, 31, 0)");
  ctx.fillStyle = glow1;
  ctx.fillRect(0, 0, width, height);

  const glow2 = ctx.createRadialGradient(1000, 500, 10, 1000, 500, 600);
  glow2.addColorStop(0, "rgba(6, 182, 212, 0.22)");
  glow2.addColorStop(1, "rgba(7, 16, 31, 0)");
  ctx.fillStyle = glow2;
  ctx.fillRect(0, 0, width, height);

  // Outer border with glow
  ctx.strokeStyle = "rgba(255, 255, 255, 0.1)";
  ctx.lineWidth = 2;
  roundRect(ctx, 16, 16, width - 32, height - 32, 24);
  ctx.stroke();

  // 2. Header
  // Logo mark box
  const logoGrad = ctx.createLinearGradient(48, 48, 96, 96);
  logoGrad.addColorStop(0, "#8b5cf6");
  logoGrad.addColorStop(1, "#06b6d4");
  ctx.fillStyle = logoGrad;
  roundRect(ctx, 48, 44, 52, 52, 14);
  ctx.fill();

  // Gamepad simple icon inside logo
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(66, 70, 4, 0, Math.PI * 2);
  ctx.arc(82, 70, 4, 0, Math.PI * 2);
  ctx.fill();

  // App Title
  ctx.font = "900 22px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("MI BÓVEDA", 114, 66);
  ctx.font = "800 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#67e8f9";
  ctx.letterSpacing = "3px";
  ctx.fillText("GAMER", 115, 85);
  ctx.letterSpacing = "0px";

  // Player Handle & Badge (Right side)
  ctx.textAlign = "right";
  ctx.font = "800 24px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#ffffff";
  const displayHandle = data.handle ? data.handle.toUpperCase() : "GAMER";
  ctx.fillText(displayHandle, width - 48, 66);

  ctx.font = "600 13px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("COLECCIÓN & HISTORIAL DE PARTIDAS", width - 48, 86);
  ctx.textAlign = "left";

  // Header separator line
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(48, 114);
  ctx.lineTo(width - 48, 114);
  ctx.stroke();

  // 3. Stat Cards Row
  const statBoxY = 132;
  const statBoxHeight = 82;
  const statBoxWidth = 260;
  const statGap = 20;

  const statItems = [
    { label: "BIBLIOTECA", value: `${data.stats.total}`, color: "#a78bfa" },
    { label: "EN CURSO", value: `${data.stats.active}`, color: "#67e8f9" },
    { label: "TERMINADOS", value: `${data.stats.done}`, color: "#34d399" },
    {
      label: data.stats.hours > 0 ? "HORAS JUGADAS" : "COMPLETITUD",
      value: data.stats.hours > 0
        ? `${data.stats.hours} h`
        : `${data.stats.total > 0 ? Math.round((data.stats.done / data.stats.total) * 100) : 0}%`,
      color: "#fbbf24",
    },
  ];

  statItems.forEach((stat, idx) => {
    const x = 48 + idx * (statBoxWidth + statGap);
    ctx.fillStyle = "rgba(255, 255, 255, 0.04)";
    roundRect(ctx, x, statBoxY, statBoxWidth, statBoxHeight, 16);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, statBoxY, statBoxWidth, statBoxHeight, 16);
    ctx.stroke();

    // Value
    ctx.font = "900 32px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = stat.color;
    ctx.fillText(stat.value, x + 20, statBoxY + 44);

    // Label
    ctx.font = "700 11px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#94a3b8";
    ctx.fillText(stat.label, x + 20, statBoxY + 66);
  });

  // 4. Main Body: Left (Active / Featured Games) & Right (Consoles breakdown)
  const contentY = 236;

  // --- Left Section: Featured / Active Games ---
  const leftX = 48;
  const leftW = 670;

  ctx.font = "800 14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#67e8f9";
  ctx.fillText("PARTIDAS DESTACADAS", leftX, contentY);

  // Pick up to 3 games (prefer "Jugando", then most progressed)
  const featured = [
    ...data.games.filter(g => g.status === "Jugando"),
    ...data.games.filter(g => g.status !== "Jugando"),
  ].slice(0, 3);

  const gameY = contentY + 16;
  const gameCardHeight = 88;
  const gameCardGap = 12;

  // Pre-load covers for featured games
  const loadedCovers = await Promise.all(featured.map(g => tryLoadImage(g.coverUrl)));

  featured.forEach((game, i) => {
    const cardY = gameY + i * (gameCardHeight + gameCardGap);

    // Card background
    ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
    roundRect(ctx, leftX, cardY, leftW, gameCardHeight, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
    ctx.lineWidth = 1;
    roundRect(ctx, leftX, cardY, leftW, gameCardHeight, 14);
    ctx.stroke();

    // Cover art or platform gradient
    const coverW = 100;
    const coverH = gameCardHeight - 16;
    const coverX = leftX + 8;
    const coverY = cardY + 8;
    const img = loadedCovers[i];

    ctx.save();
    roundRect(ctx, coverX, coverY, coverW, coverH, 8);
    ctx.clip();
    if (img) {
      ctx.drawImage(img, coverX, coverY, coverW, coverH);
    } else {
      const pColors = PLATFORM_COLORS[game.platform] ?? PLATFORM_COLORS.Otra;
      const grad = ctx.createLinearGradient(coverX, coverY, coverX + coverW, coverY + coverH);
      grad.addColorStop(0, pColors[0]);
      grad.addColorStop(1, pColors[1]);
      ctx.fillStyle = grad;
      ctx.fillRect(coverX, coverY, coverW, coverH);

      ctx.fillStyle = "#ffffff";
      ctx.font = "800 12px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(game.platform, coverX + coverW / 2, coverY + coverH / 2 + 4);
      ctx.textAlign = "left";
    }
    ctx.restore();

    // Game Title
    ctx.font = "800 16px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#f8fafc";
    const truncatedTitle = game.title.length > 34 ? game.title.slice(0, 32) + "…" : game.title;
    ctx.fillText(truncatedTitle, leftX + coverW + 22, cardY + 30);

    // Platform & status badge
    ctx.font = "700 11px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#94a3b8";
    const infoText = `${game.platform} · ${game.status}${game.hours > 0 ? ` · ${game.hours} h` : ""}`;
    ctx.fillText(infoText, leftX + coverW + 22, cardY + 48);

    // Progress bar
    const barX = leftX + coverW + 22;
    const barY = cardY + 60;
    const barW = leftW - coverW - 100;
    const barH = 8;

    ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
    roundRect(ctx, barX, barY, barW, barH, 4);
    ctx.fill();

    if (game.progress > 0) {
      const fillW = Math.max(8, (game.progress / 100) * barW);
      const progGrad = ctx.createLinearGradient(barX, barY, barX + fillW, barY);
      progGrad.addColorStop(0, "#8b5cf6");
      progGrad.addColorStop(1, "#06b6d4");
      ctx.fillStyle = progGrad;
      roundRect(ctx, barX, barY, fillW, barH, 4);
      ctx.fill();
    }

    // Progress %
    ctx.font = "800 12px system-ui, -apple-system, sans-serif";
    ctx.fillStyle = "#67e8f9";
    ctx.fillText(`${game.progress}%`, barX + barW + 14, cardY + 68);
  });

  // --- Right Section: Consoles & Platforms ---
  const rightX = 746;
  const rightW = width - rightX - 48;

  ctx.font = "800 14px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#a78bfa";
  ctx.fillText("DISTRIBUCIÓN POR CONSOLA", rightX, contentY);

  const consoleBoxY = contentY + 16;
  const consoleBoxH = 288;

  ctx.fillStyle = "rgba(255, 255, 255, 0.035)";
  roundRect(ctx, rightX, consoleBoxY, rightW, consoleBoxH, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.07)";
  ctx.lineWidth = 1;
  roundRect(ctx, rightX, consoleBoxY, rightW, consoleBoxH, 16);
  ctx.stroke();

  const topConsoles = (data.stats.consoles ?? []).slice(0, 5);
  const maxConsoleCount = Math.max(...topConsoles.map(c => c.count), 1);

  if (topConsoles.length === 0) {
    ctx.font = "500 14px system-ui, sans-serif";
    ctx.fillStyle = "#64748b";
    ctx.fillText("Sin consolas registradas", rightX + 24, consoleBoxY + 50);
  } else {
    topConsoles.forEach((c, idx) => {
      const rowY = consoleBoxY + 28 + idx * 48;

      ctx.font = "700 13px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#e2e8f0";
      ctx.fillText(c.platform, rightX + 20, rowY + 12);

      ctx.textAlign = "right";
      ctx.font = "700 12px system-ui, -apple-system, sans-serif";
      ctx.fillStyle = "#94a3b8";
      ctx.fillText(`${c.count} ${c.count === 1 ? "juego" : "juegos"}`, rightX + rightW - 20, rowY + 12);
      ctx.textAlign = "left";

      // Bar
      const cBarX = rightX + 20;
      const cBarY = rowY + 20;
      const cBarW = rightW - 40;
      const cBarH = 6;

      ctx.fillStyle = "rgba(255, 255, 255, 0.07)";
      roundRect(ctx, cBarX, cBarY, cBarW, cBarH, 3);
      ctx.fill();

      const cFillW = Math.max(8, (c.count / maxConsoleCount) * cBarW);
      const pColors = PLATFORM_COLORS[c.platform] ?? PLATFORM_COLORS.Otra;
      const cGrad = ctx.createLinearGradient(cBarX, cBarY, cBarX + cFillW, cBarY);
      cGrad.addColorStop(0, pColors[0]);
      cGrad.addColorStop(1, pColors[1]);
      ctx.fillStyle = cGrad;
      roundRect(ctx, cBarX, cBarY, cFillW, cBarH, 3);
      ctx.fill();
    });
  }

  // 5. Footer Watermark
  ctx.font = "600 12px system-ui, -apple-system, sans-serif";
  ctx.fillStyle = "#475569";
  const dateStr = new Intl.DateTimeFormat("es", { dateStyle: "medium" }).format(new Date());
  ctx.fillText(`Generado en Mi Bóveda Gamer · ${dateStr}`, 48, height - 32);

  ctx.textAlign = "right";
  ctx.fillText("mibovedagamer.app", width - 48, height - 32);
  ctx.textAlign = "left";
}

export async function downloadGamerCard(
  canvas: HTMLCanvasElement,
  filename = "mi-boveda-gamer.png"
): Promise<void> {
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
  if (!blob) return;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyGamerCardToClipboard(canvas: HTMLCanvasElement): Promise<boolean> {
  try {
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/png"));
    if (!blob) return false;
    await navigator.clipboard.write([
      new ClipboardItem({ "image/png": blob }),
    ]);
    return true;
  } catch (err) {
    console.warn("Could not copy image to clipboard:", err);
    return false;
  }
}
