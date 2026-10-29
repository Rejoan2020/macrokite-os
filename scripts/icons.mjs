// Draws the app icons in public/ from the logo (the orange kite with an M). Run: node scripts/icons.mjs
import { writeFile } from "node:fs/promises";
import { createElement as h } from "react";
import { ImageResponse } from "next/og.js";

const PAGE = "#0e1014";
const ACCENT = "#f06a3f";

/** The kite on the app's dark background. `kite` is its size as a share of the icon. */
function icon(size, kite) {
  const k = Math.round(size * kite);
  return h(
    "div",
    { style: { width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center", background: PAGE } },
    h(
      "div",
      {
        style: {
          width: k,
          height: k,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: ACCENT,
          color: "#ffffff",
          fontSize: Math.round(k * 0.45),
          fontWeight: 700,
          // Three round corners and one sharp one, as in the logo.
          borderRadius: `${k / 2}px ${k / 2}px ${k / 2}px ${Math.round(k * 0.14)}px`,
        },
      },
      "M"
    )
  );
}

// Maskable icons are cropped to a circle or squircle by the launcher; the kite stays in the safe zone.
const icons = [
  ["icon-192.png", 192, 0.72],
  ["icon-512.png", 512, 0.72],
  ["icon-maskable-512.png", 512, 0.56],
  ["apple-icon-180.png", 180, 0.66],
];

// Android's status bar shows a white silhouette: the kite alone, on transparent.
function badge(size) {
  const k = Math.round(size * 0.8);
  return h(
    "div",
    { style: { width: size, height: size, display: "flex", alignItems: "center", justifyContent: "center" } },
    h("div", { style: { width: k, height: k, background: "#ffffff", borderRadius: `${k / 2}px ${k / 2}px ${k / 2}px ${Math.round(k * 0.14)}px` } })
  );
}
const badgePng = await new ImageResponse(badge(96), { width: 96, height: 96 }).arrayBuffer();
await writeFile(new URL("../public/badge-96.png", import.meta.url), Buffer.from(badgePng));
console.log("wrote public/badge-96.png");

for (const [name, size, kite] of icons) {
  const png = await new ImageResponse(icon(size, kite), { width: size, height: size }).arrayBuffer();
  await writeFile(new URL(`../public/${name}`, import.meta.url), Buffer.from(png));
  console.log("wrote public/" + name);
}
