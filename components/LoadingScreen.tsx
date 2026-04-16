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
        <div className="flex h-24 w-24 items-center justify-center rounded-2xl bg-gradient-to-br from-le-mint/15 via-le-accent/15 to-le-violet/15 ring-1 ring-white/10">
          <BrandLogo size={56} />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="heading text-2xl text-le-text">Getting ready</h1>
          <p className="text-sm text-le-text-secondary">
            Caching lessons and the optional help model so everything works
            offline. This only runs once.
          </p>
        </div>

        <div className="flex w-80 flex-col items-center gap-3">
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-le-surface">
            <div
              className="progress-bar-glow h-full rounded-full bg-le-accent transition-all duration-500 ease-out"
              style={{ width: `${Math.max(progress, 3)}%` }}
            />
          </div>
          <span className="text-sm font-medium tabular-nums text-le-text-secondary">
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
