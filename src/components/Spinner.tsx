/** Shared pending-state spinner — one visual for every async action in the
 *  app (PDF generation, auth submit, AR session init) rather than each
 *  screen inventing its own. Reuses the `dlSpin` keyframe already defined
 *  in App.css. `currentColor`, so it inherits whatever text colour the
 *  caller's button already uses. */
export default function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      style={{ animation: 'dlSpin 0.8s linear infinite' }}
    >
      <circle cx={8} cy={8} r={6.25} stroke="currentColor" strokeOpacity={0.25} strokeWidth={1.6} />
      <path d="M14.25 8a6.25 6.25 0 0 0-6.25-6.25" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" />
    </svg>
  );
}
