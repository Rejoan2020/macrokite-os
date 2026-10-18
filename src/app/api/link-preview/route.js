import { cacheLife } from "next/cache";
import { socialLink } from "@/lib/text";

// The photo, caption and title a Facebook / Instagram post shares with link previews (its og: tags).
// Only those hosts are fetched, at every redirect, so this can't be used to reach anything else.
export async function GET(request) {
  const url = new URL(request.url).searchParams.get("url");
  if (!url || !socialLink(url)) return Response.json({ error: "Unsupported link." }, { status: 400 });
  try {
    return Response.json(await readPreview(url), { headers: { "Cache-Control": "private, max-age=3600" } });
  } catch {
    return Response.json({ error: "No preview." }, { status: 404, headers: { "Cache-Control": "no-store" } });
  }
}

const MAX_REDIRECTS = 5;
const MAX_BYTES = 1_500_000;

// Failures throw, so only previews that worked are cached. The image links are signed and expire
// after a while, hence hours rather than days.
async function readPreview(url) {
  "use cache";
  cacheLife("hours");

  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    const res = await fetch(current, {
      redirect: "manual",
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "Mozilla/5.0", Accept: "text/html", "Accept-Language": "en" },
    });
    const location = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).toString();
      if (!socialLink(current)) throw new Error("Redirected off-platform");
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const html = (await res.text()).slice(0, MAX_BYTES);
    const tag = (name) => decodeEntities(html.match(new RegExp(`<meta[^>]+property="og:${name}"[^>]+content="([^"]*)"`, "i"))?.[1] ?? "");
    const image = tag("image");
    if (!image.startsWith("https://")) throw new Error("No image");
    const title = tag("title").replace(/\s*\|\s*(Facebook|Instagram)\s*$/i, "");
    const description = tag("description");
    return {
      image,
      title: title.slice(0, 300),
      description: description && description !== title ? description.slice(0, 300) : "",
      video: tag("type").startsWith("video"),
    };
  }
  throw new Error("Too many redirects");
}

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", "#39": "'" };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, code) => {
    if (code[0] === "#") {
      const n = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTITIES[code.toLowerCase()] ?? m;
  });
}
