// Makes the site installable as an app (home screen on phones, an app window on desktop), and is
// what the Play Store package is built from.
export default function manifest() {
  return {
    id: "/",
    name: "Macrokite OS",
    short_name: "Macrokite",
    description: "The Macrokite team hub: clients, projects, tasks, meetings and conversation in one place.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#0e1014",
    theme_color: "#0e1014",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
