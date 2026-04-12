"use client";

import { Zap } from "lucide-react";

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
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-le-accent/20">
          <Zap className="h-10 w-10 text-le-accent" />
        </div>

        <div className="flex flex-col items-center gap-2">
          <h1 className="heading text-2xl text-le-text">
            Preparing your offline classroom
          </h1>
          <p className="text-sm text-le-text-secondary">
            The AI model is loading to your device. This only happens once.
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
