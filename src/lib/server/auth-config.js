// Which settings sign-in needs. Kept free of other imports so the proxy can use it too.

const AUTH_ENV = ["WORKOS_CLIENT_ID", "WORKOS_API_KEY", "WORKOS_COOKIE_PASSWORD", "NEXT_PUBLIC_WORKOS_REDIRECT_URI"];

export const missingAuthConfig = () => AUTH_ENV.filter((name) => !process.env[name]?.trim());
export const isAuthConfigured = () => missingAuthConfig().length === 0;
