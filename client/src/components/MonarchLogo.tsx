export default function MonarchLogo({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Orange rounded square background */}
      <rect width="100" height="100" rx="22" fill="url(#monarchOrangeGrad)" />

      {/* Castle/battlement crown - three merlons */}
      <path
        d="M25 68V45h10v8h6v-8h8v-8h2v8h8v8h6v-8h10v23H25z"
        fill="white"
      />

      <defs>
        <linearGradient id="monarchOrangeGrad" x1="0" y1="0" x2="100" y2="100">
          <stop offset="0%" stopColor="#F5A623" />
          <stop offset="100%" stopColor="#E8871E" />
        </linearGradient>
      </defs>
    </svg>
  );
}
