// Panonun o anki halini PNG olarak kaydeder. DOM'un ekran görüntüsünü almak
// yerine aynı ızgara ölçüleriyle bir canvas'a yeniden çizer: ek kütüphane
// gerekmez ve çıktı ekran çözünürlüğünde (retina dahil) net olur.

import { BRAND } from "@/lib/i18n";

export type BoardLayout = {
  cols: number;
  rows: number;
  cw: number;
  ch: number;
  gap: number;
  rowGap: number;
  pad: number;
  bezel: number;
  width: number;
  height: number;
};

const FALLBACK = {
  housing: "#0b0b0b",
  "housing-hi": "#1b1b1b",
  frame: "#121212",
  "frame-hi": "#232323",
  "flap-hi": "#212121",
  flap: "#1a1a1a",
  "flap-lo": "#151515",
  ink: "#ececec",
  slot: "#040404",
  hinge: "#000000",
};

/** Renkleri globals.css'teki temadan okur; bulunamazsa yedeğe döner. */
function themeColor(name: keyof typeof FALLBACK): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(`--color-${name}`).trim();
  return v || FALLBACK[name];
}

export function drawBoard(
  layout: BoardLayout,
  lines: string[],
  width: number,
  height: number,
  scale = window.devicePixelRatio || 1,
): HTMLCanvasElement {
  const { cols, rows, cw, ch, gap, rowGap, pad, bezel } = layout;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  const c = {
    housing: themeColor("housing"),
    housingHi: themeColor("housing-hi"),
    frame: themeColor("frame"),
    frameHi: themeColor("frame-hi"),
    hi: themeColor("flap-hi"),
    flap: themeColor("flap"),
    lo: themeColor("flap-lo"),
    ink: themeColor("ink"),
    slot: themeColor("slot"),
    hinge: themeColor("hinge"),
  };

  // dış çerçeve
  const frame = ctx.createLinearGradient(0, 0, 0, height);
  frame.addColorStop(0, c.frameHi);
  frame.addColorStop(1, c.frame);
  ctx.fillStyle = frame;
  ctx.fillRect(0, 0, width, height);

  // çerçeveye gömülü pano yüzeyi: sağ üstten gelen hafif ışık
  const pw = width - 2 * bezel;
  const ph = height - 2 * bezel;
  ctx.save();
  ctx.beginPath();
  ctx.rect(bezel, bezel, pw, ph);
  ctx.clip();
  const glow = ctx.createRadialGradient(width * 0.72, bezel, 0, width * 0.72, bezel, Math.hypot(pw, ph) * 0.65);
  glow.addColorStop(0, c.housingHi);
  glow.addColorStop(1, c.housing);
  ctx.fillStyle = glow;
  ctx.fillRect(bezel, bezel, pw, ph);
  // üst kenardan düşen iç gölge, derinlik hissi için
  const depth = (cw / 0.74) * 1.1;
  const shade = ctx.createLinearGradient(0, bezel, 0, bezel + depth);
  const depthColor =
    getComputedStyle(document.documentElement).getPropertyValue("--depth").trim() || "rgba(0,0,0,.8)";
  shade.addColorStop(0, depthColor);
  shade.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = shade;
  ctx.fillRect(bezel, bezel, pw, depth);
  ctx.restore();
  ctx.strokeStyle = c.slot;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.rect(bezel + 0.5, bezel + 0.5, pw - 1, ph - 1);
  ctx.stroke();

  const fontSize = cw / 0.74; // Board.tsx ile aynı oran
  const rim = fontSize * 0.045;
  const notch = fontSize * 0.07;
  ctx.font = `700 ${fontSize * 0.8}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let r = 0; r < rows; r++) {
    const line = (lines[r] ?? "").padEnd(cols);
    const y = pad + r * (ch + rowGap);
    for (let i = 0; i < cols; i++) {
      const x = pad + i * (cw + gap);
      const half = ch / 2;

      // gömme çerçeve
      ctx.fillStyle = c.slot;
      ctx.fillRect(x - rim, y - rim, cw + 2 * rim, ch + 2 * rim);

      const top = ctx.createLinearGradient(0, y, 0, y + half);
      top.addColorStop(0, "#0c0c0c"); // yuva kenarının gölgesi
      top.addColorStop(0.15, c.hi);
      top.addColorStop(1, c.flap);
      ctx.fillStyle = top;
      ctx.fillRect(x, y, cw, half);

      const bottom = ctx.createLinearGradient(0, y + half, 0, y + ch);
      bottom.addColorStop(0, "#080808"); // üst kartın gölgesi
      bottom.addColorStop(0.22, c.lo);
      bottom.addColorStop(0.88, c.flap);
      bottom.addColorStop(1, "#101010");
      ctx.fillStyle = bottom;
      ctx.fillRect(x, y + half, cw, half);

      const char = line[i];
      if (char && char !== " ") {
        ctx.fillStyle = c.ink;
        ctx.fillText(char, x + cw / 2, y + half);
      }

      // menteşe çizgisi harfin de üstünden geçer
      ctx.fillStyle = c.hinge;
      ctx.fillRect(x, y + half - 0.5, cw, 1);

      // menteşe çentikleri
      ctx.fillStyle = c.housing;
      ctx.fillRect(x, y + half - notch, notch, notch * 2);
      ctx.fillRect(x + cw - notch, y + half - notch, notch, notch * 2);
    }
  }

  // alt nefes boşluğunda marka yazısı; harfler tek tek, aralıklı çizilir
  const label = BRAND;
  const labelSize = fontSize * 0.2;
  const spacing = labelSize * 0.42;
  ctx.font = `500 ${labelSize}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  const widths = [...label].map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (label.length - 1);
  // hücrelerin altındaki kenar payı (0,12em) düşülerek, görünen boşluğa ortalanır
  const labelY = height - bezel - (pad - bezel - fontSize * 0.12) / 2;
  let lx = (width - total) / 2;
  [...label].forEach((ch, i) => {
    ctx.fillStyle = "rgba(0,0,0,.9)";
    ctx.fillText(ch, lx, labelY - 1);
    ctx.fillStyle = "#4a4a4a";
    ctx.fillText(ch, lx, labelY);
    lx += widths[i] + spacing;
  });

  // panoya tek yönden düşen ışık: sağ üst aydınlık, alt kısım gölgede
  ctx.save();
  ctx.beginPath();
  ctx.rect(bezel, bezel, pw, ph);
  ctx.clip();
  const light = ctx.createRadialGradient(
    bezel + pw * 0.72, bezel - ph * 0.08, 0,
    bezel + pw * 0.72, bezel - ph * 0.08, Math.max(pw * 1.1, ph * 0.85) * 0.6,
  );
  light.addColorStop(0, "rgba(255,255,255,.09)");
  light.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = light;
  ctx.fillRect(bezel, bezel, pw, ph);
  const dim = ctx.createLinearGradient(0, bezel + ph * 0.45, 0, bezel + ph);
  dim.addColorStop(0, "rgba(0,0,0,0)");
  dim.addColorStop(1, "rgba(0,0,0,.32)");
  ctx.fillStyle = dim;
  ctx.fillRect(bezel, bezel, pw, ph);
  ctx.restore();
  return canvas;
}

export function savePng(layout: BoardLayout, lines: string[]) {
  const canvas = drawBoard(layout, lines, layout.width, layout.height);
  canvas.toBlob((blob) => {
    if (!blob) return;
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `splitflat-${stamp}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, "image/png");
}
