export default function BrandMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 36 36"
      aria-hidden="true"
    >
      <rect width="36" height="36" rx="11" fill="#1a080c" />
      <rect x="0.6" y="0.6" width="34.8" height="34.8" rx="10.4" fill="none" stroke="#ff4a12" strokeWidth="1.2" />
      <path
        d="M18 27.2s-8.4-5.2-8.4-10.4A4.2 4.2 0 0 1 18 14.2 4.2 4.2 0 0 1 26.4 16.8C26.4 22 18 27.2 18 27.2z"
        fill="#ff4a12"
      />
    </svg>
  );
}
