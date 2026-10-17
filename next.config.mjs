/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Pages that moved when the menu was reorganized; old links and bookmarks still land somewhere useful.
  redirects() {
    return [
      { source: "/messages", destination: "/inbox", permanent: false },
      { source: "/messages/:id", destination: "/inbox/:id", permanent: false },
      { source: "/general", destination: "/inbox", permanent: false },
      { source: "/team", destination: "/company", permanent: false },
      { source: "/projects", destination: "/company", permanent: false },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
