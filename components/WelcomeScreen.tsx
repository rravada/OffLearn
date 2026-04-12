"use client";

import { BookOpen, Target, WifiOff } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";

interface WelcomeScreenProps {
  onStart: () => void;
}

const FEATURES = [
  {
    icon: WifiOff,
    title: "Runs 100% Offline",
    description:
      "The tutor runs in your browser with WebGPU — no API keys, no servers.",
  },
  {
    icon: BookOpen,
    title: "Structured Curriculum",
    description:
      "Lessons across 6 subjects, sequenced like a real course. Not a search engine — a teacher.",
  },
  {
    icon: Target,
    title: "SAT & ACT Test Prep",
    description:
      "Timed practice with AI-guided explanations. Free. Forever. Offline.",
  },
] as const;

export function WelcomeScreen({ onStart }: WelcomeScreenProps) {
  return (
    <div className="le-app-shell fixed inset-0 z-50 flex flex-col items-center justify-center px-6">
      <div className="flex max-w-2xl flex-col items-center gap-10">
        <BrandLogo size={48} className="drop-shadow-[0_0_24px_rgba(240,165,0,0.35)]" />

        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="heading text-4xl text-le-text sm:text-5xl">
            Every student deserves a great teacher.
          </h1>
          <p className="max-w-lg text-base leading-relaxed text-le-text-secondary">
            OffLearn brings personalized AI tutoring to students with no
            internet, no cost, and no data ever leaving their device.
          </p>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-3">
          {FEATURES.map((feat) => (
            <div
              key={feat.title}
              className="flex flex-col items-center gap-3 rounded-xl border border-le-border-strong bg-le-surface p-6 text-center"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-le-accent-soft">
                <feat.icon className="h-6 w-6 text-le-accent" />
              </div>
              <h3 className="heading text-sm text-le-text">{feat.title}</h3>
              <p className="text-xs leading-relaxed text-le-text-secondary">
                {feat.description}
              </p>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={onStart}
          className="rounded-xl bg-le-accent px-10 py-3.5 text-base font-semibold text-le-bg shadow-lg shadow-le-accent/20 transition-all hover:brightness-110"
        >
          Start Learning →
        </button>

        <p className="text-xs text-le-text-hint">
          Offline-first — your study sessions stay on this device.
        </p>
      </div>
    </div>
  );
}
