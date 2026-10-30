export default function Logo({ grande = false }) {
  return (
    <span className={`logo ${grande ? 'logo-grande' : ''}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="var(--acento)" />
        <path d="M24 18v28l22-14z" fill="var(--lima)" />
      </svg>
      Clipazo
    </span>
  );
}
