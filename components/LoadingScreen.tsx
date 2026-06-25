"use client";

import { BrandLogo } from "@/components/BrandLogo";

interface LoadingScreenProps {
  progress: number;
  visible: boolean;
}

export function LoadingScreen({ progress, visible }: LoadingScreenProps) {
  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-le-bg transition-opacity duration-700 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="flex flex-col items-center gap-10">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-le-accent/10 ring-1 ring-le-accent/20">
          <BrandLogo size={52} />
        </div>

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="font-display font-bold text-2xl text-le-text" style={{ letterSpacing: "-0.025em" }}>
            Getting ready
          </h1>
          <p className="max-w-xs text-sm leading-relaxed text-le-text-secondary">
            Caching lessons and the offline tutor. This only runs once.
          </p>
        </div>

        <div className="flex w-72 flex-col items-center gap-3">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-le-surface">
            <div
              className="progress-bar-glow h-full rounded-full bg-le-accent transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 3)}%` }}
            />
          </div>
          <span className="text-xs font-medium tabular-nums text-le-text-hint">
            {Math.round(progress)}%
          </span>
        </div>

        <p className="text-xs text-le-text-hint">
          Your data never leaves this device — ever.
        </p>
      </div>
    </div>
  );
}
