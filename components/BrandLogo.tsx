"use client";

import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  size?: number;
};

/**
 * OffLearn mark: graduation cap seen from above — the flat square top rendered
 * as a bold diamond, with a mint tassel. Immediately reads as "education" while
 * the geometric treatment keeps it contemporary. Uses currentColor so it
 * adapts to both dark and light themes via the le-accent CSS var.
 */
export function BrandLogo({ className, size = 28 }: BrandLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("flex-shrink-0 text-le-accent", className)}
      aria-hidden
    >
      {/* Cap board — diamond (the flat square top, viewed from above) */}
      <path
        d="M 16 3 L 30.5 11 L 16 19 L 1.5 11 Z"
        fill="currentColor"
      />
      {/* Cap body — small rounded cylinder below the board center */}
      <path
        d="M 12.5 19 L 12.5 23.5 Q 16 26.5 19.5 23.5 L 19.5 19 Z"
        fill="currentColor"
        opacity={0.55}
      />
      {/* Tassel cord */}
      <line
        x1="28.5"
        y1="11"
        x2="28.5"
        y2="21.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        opacity={0.65}
      />
      {/* Tassel end — mint accent node */}
      <circle cx="28.5" cy="24" r="2.2" className="fill-le-mint" />
    </svg>
  );
}
