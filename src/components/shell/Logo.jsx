export function Logo({ className }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="8" fill="var(--surface-3)" />
      <path d="M16 5 L25 14 L16 27 L7 14 Z" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 5 L16 27 M7 14 L25 14" stroke="var(--accent)" strokeWidth="1.4" opacity="0.55" />
      <circle cx="16" cy="14" r="2" fill="var(--accent)" />
    </svg>
  );
}
