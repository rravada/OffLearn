"use client";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  size?: number;
};

/** Compact mark: layered arcs + spark — reads well at 24–32px. */
export function BrandLogo({ className, size = 28 }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id="ol-ring" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#5EEAD4" />
          <stop offset="50%" stopColor="#F0A500" />
          <stop offset="100%" stopColor="#A78BFA" />
        </linearGradient>
        <linearGradient id="ol-core" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#F0A500" />
          <stop offset="100%" stopColor="#F5C04A" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="14" stroke="url(#ol-ring)" strokeWidth="2.25" opacity={0.95} />
      <path
        d="M10 12c2.5-1.2 5.2-1.2 7.6 0v9.2c-2.4-1-5.1-1-7.6 0V12Z"
        fill="url(#ol-core)"
        opacity={0.92}
      />
      <path
        d="M14.4 12c2.5-1.2 5.2-1.2 7.6 0v9.2c-2.4-1-5.1-1-7.6 0V12Z"
        fill="url(#ol-core)"
        opacity={0.55}
      />
      <path
        d="M22 9.5c1.2.6 2 1.8 2.2 3.2.3 1.8-.4 3.5-1.8 4.5"
        stroke="#5EEAD4"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
}
