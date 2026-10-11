/**
 * Product logo: a minimalist decision-path symbol — two inputs converge
 * through a decision junction into a single accented outcome.
 * Uses the brand's navy surface, white strokes and one teal accent.
 * Recognizable at favicon size (16–32 px); purely geometric, no text.
 */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      role="img"
      aria-hidden="true"
      focusable="false"
    >
      <rect width="24" height="24" rx="5" className="fill-primary" />
      <g
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-primary-foreground"
      >
        <path d="M7 8h4.5l3 4" />
        <path d="M7 16h4.5l3-4" />
        <circle cx="5.2" cy="8" r="1.4" />
        <circle cx="5.2" cy="16" r="1.4" />
      </g>
      <circle cx="18.6" cy="12" r="2" fill="oklch(0.72 0.09 195)" />
    </svg>
  );
}
