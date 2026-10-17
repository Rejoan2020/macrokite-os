// Light, dark or system, saved per device. Shared by the root layout (server) and the theme hook.

export const THEME_KEY = "macrokite-os:theme";
export const THEMES = ["light", "dark", "system"];

/** Inline script for <head>: sets data-theme on <html> from the saved preference before the first paint. */
export const THEME_SCRIPT = `(function(){try{var p=localStorage.getItem(${JSON.stringify(THEME_KEY)});var t=p==="light"||p==="dark"?p:(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark");document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
