"use client";

import { useEffect, useState } from "react";
import { Plus, ArrowLeft, Trash2, Pencil, X, Check, Lock, Loader2 } from "lucide-react";
import type { Profile } from "@/types";
import { createProfile, deleteProfile } from "@/lib/db/indexeddb";
import { generateId, cn } from "@/lib/utils";
import { useAppStore } from "@/lib/store/useAppStore";
import { BrandLogo } from "@/components/BrandLogo";

const AVATAR_COLORS = [
  "#5eead4", // mint
  "#f0a500", // accent amber
  "#a78bfa", // violet
  "#60a5fa", // blue
  "#f472b6", // pink
  "#34d399", // green
  "#fb923c", // orange
  "#f87171", // red
] as const;

interface ProfilePickerProps {
  profiles: Profile[];
  /** Called after a profile is chosen (and PIN verified, if any). */
  onSelect: (id: string) => void;
  /** Reload the profile list from IndexedDB after create/delete. */
  onProfilesChanged: () => void;
  /** When true, the picker can be dismissed (i.e. an active profile already exists). */
  dismissable?: boolean;
  onClose?: () => void;
}

type View = "grid" | "create" | "pin";

export function ProfilePicker({
  profiles,
  onSelect,
  onProfilesChanged,
  dismissable = false,
  onClose,
}: ProfilePickerProps) {
  const [view, setView] = useState<View>("grid");
  const [manage, setManage] = useState(false);
  const modelStatus = useAppStore((s) => s.modelStatus);
  const modelProgress = useAppStore((s) => s.modelProgress);
  const modelEngine = useAppStore((s) => s.modelEngine);

  // Never leave the user stranded in manage mode with no profiles and no
  // way to add one (the Manage/Done toggle hides at zero profiles).
  useEffect(() => {
    if (profiles.length === 0 && manage) setManage(false);
  }, [profiles.length, manage]);

  // Create form
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(AVATAR_COLORS[0]);
  const [usePin, setUsePin] = useState(false);
  const [newPin, setNewPin] = useState("");
  const [saving, setSaving] = useState(false);

  // PIN entry
  const [pinTarget, setPinTarget] = useState<Profile | null>(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState(false);

  const resetCreate = () => {
    setName("");
    setColor(AVATAR_COLORS[0]);
    setUsePin(false);
    setNewPin("");
  };

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed || saving) return;
    if (usePin && newPin.length !== 4) return;
    setSaving(true);
    const profile: Profile = {
      id: generateId(),
      name: trimmed,
      color,
      createdAt: Date.now(),
      activeDays: [],
      ...(usePin && newPin.length === 4 ? { pin: newPin } : {}),
    };
    await createProfile(profile);
    onProfilesChanged();
    resetCreate();
    setSaving(false);
    setView("grid");
    onSelect(profile.id);
  };

  const handleTileClick = (profile: Profile) => {
    if (manage) return;
    if (profile.pin) {
      setPinTarget(profile);
      setPinInput("");
      setPinError(false);
      setView("pin");
    } else {
      onSelect(profile.id);
    }
  };

  const handleDelete = async (profile: Profile) => {
    const ok = window.confirm(
      `Delete ${profile.name}? This removes ${profile.name}'s progress, completed lessons, streak, and tutor history from this device. This can't be undone.`
    );
    if (!ok) return;
    await deleteProfile(profile.id);
    onProfilesChanged();
  };

  const verifyPin = () => {
    if (!pinTarget) return;
    if (pinInput === pinTarget.pin) {
      const id = pinTarget.id;
      setPinTarget(null);
      setPinInput("");
      setView("grid");
      onSelect(id);
    } else {
      setPinError(true);
    }
  };

  return (
    <div className="le-app-shell fixed inset-0 z-[60] flex flex-col items-center justify-center px-6">
      {dismissable && view === "grid" && (
        <button
          type="button"
          onClick={onClose}
          className="absolute right-5 top-5 rounded-md p-2 text-le-text-hint transition-colors hover:bg-le-hover hover:text-le-text"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      )}

      <div className="flex w-full max-w-2xl flex-col items-center gap-8">
        <BrandLogo size={40} />

        {view === "grid" && (
          <>
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="heading text-3xl text-le-text sm:text-4xl">
                Who&apos;s learning?
              </h1>
              <p className="text-sm text-le-text-secondary">
                Pick your profile. No account, no internet. Your progress stays
                on this device.
              </p>
            </div>

            <div className="grid w-full grid-cols-2 gap-4 sm:grid-cols-3">
              {profiles.map((p) => (
                <div key={p.id} className="relative">
                  <button
                    type="button"
                    onClick={() => handleTileClick(p)}
                    className={cn(
                      "flex w-full flex-col items-center gap-3 rounded-2xl border border-le-border bg-le-surface p-5 transition-all",
                      manage
                        ? "cursor-default"
                        : "hover:border-le-mint/40 hover:bg-le-elevated"
                    )}
                  >
                    <span
                      className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-le-bg"
                      style={{ backgroundColor: p.color }}
                    >
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="flex items-center gap-1 text-sm font-medium text-le-text">
                      {p.name}
                      {p.pin && <Lock className="h-3 w-3 text-le-text-hint" />}
                    </span>
                  </button>
                  {manage && (
                    <button
                      type="button"
                      onClick={() => handleDelete(p)}
                      className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white shadow-md transition-transform hover:scale-110"
                      aria-label={`Delete ${p.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={() => {
                  resetCreate();
                  setView("create");
                }}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-le-border bg-le-surface/40 p-5 text-le-text-secondary transition-all hover:border-le-mint/40 hover:text-le-text"
              >
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-le-elevated">
                  <Plus className="h-7 w-7" />
                </span>
                <span className="text-sm font-medium">Add student</span>
              </button>
            </div>

            {profiles.length > 0 && (
              <button
                type="button"
                onClick={() => setManage((m) => !m)}
                className="flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
              >
                {manage ? (
                  <>
                    <Check className="h-4 w-4" /> Done
                  </>
                ) : (
                  <>
                    <Pencil className="h-4 w-4" /> Manage profiles
                  </>
                )}
              </button>
            )}

            {/* Model load progress stays visible here since the picker sits
                above the full-screen loading bar. */}
            {modelStatus === "loading" && (
              <div className="flex w-full max-w-xs flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-le-text-secondary">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-le-accent" />
                  {modelEngine === "cpu"
                    ? `Setting up a lighter offline tutor for this device… ${Math.round(modelProgress)}%`
                    : `Setting up the offline tutor… ${Math.round(modelProgress)}%`}
                </div>
                <div className="h-1 w-full overflow-hidden rounded-full bg-le-surface">
                  <div
                    className="h-full rounded-full bg-le-accent transition-all duration-500"
                    style={{ width: `${Math.max(modelProgress, 3)}%` }}
                  />
                </div>
              </div>
            )}
            {modelStatus === "ready" && (
              <p className="flex items-center gap-1.5 text-xs text-le-green">
                <Check className="h-3.5 w-3.5" /> Offline tutor ready
              </p>
            )}
          </>
        )}

        {view === "create" && (
          <div className="flex w-full max-w-sm flex-col gap-6">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView("grid")}
                className="rounded-md p-1.5 text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
                aria-label="Back"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <h2 className="heading text-xl text-le-text">Add a student</h2>
            </div>

            <div className="flex flex-col items-center gap-3">
              <span
                className="flex h-20 w-20 items-center justify-center rounded-full text-3xl font-bold text-le-bg"
                style={{ backgroundColor: color }}
              >
                {(name.trim().charAt(0) || "?").toUpperCase()}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-le-text-secondary">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !usePin) void handleCreate();
                }}
                maxLength={20}
                autoFocus
                placeholder="e.g. Maria"
                className="rounded-xl border border-le-border bg-le-bg px-4 py-2.5 text-sm text-le-text outline-none ring-le-mint/30 focus:border-le-mint/40 focus:ring-2"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-le-text-secondary">
                Color
              </label>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={cn(
                      "h-8 w-8 rounded-full transition-transform",
                      color === c
                        ? "ring-2 ring-le-text ring-offset-2 ring-offset-le-bg"
                        : "hover:scale-110"
                    )}
                    style={{ backgroundColor: c }}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-xs font-medium text-le-text-secondary">
                <input
                  type="checkbox"
                  checked={usePin}
                  onChange={(e) => setUsePin(e.target.checked)}
                  className="accent-le-accent"
                />
                Protect with a 4-digit PIN (optional)
              </label>
              {usePin && (
                <input
                  inputMode="numeric"
                  pattern="\d*"
                  value={newPin}
                  onChange={(e) =>
                    setNewPin(e.target.value.replace(/\D/g, "").slice(0, 4))
                  }
                  placeholder="••••"
                  className="w-28 rounded-xl border border-le-border bg-le-bg px-4 py-2.5 text-center text-lg tracking-[0.3em] text-le-text outline-none ring-le-mint/30 focus:border-le-mint/40 focus:ring-2"
                />
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleCreate()}
              disabled={
                !name.trim() || saving || (usePin && newPin.length !== 4)
              }
              className="rounded-xl bg-le-accent px-6 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110 disabled:opacity-40"
            >
              Create profile
            </button>
          </div>
        )}

        {view === "pin" && pinTarget && (
          <div className="flex w-full max-w-xs flex-col items-center gap-6">
            <span
              className="flex h-16 w-16 items-center justify-center rounded-full text-2xl font-bold text-le-bg"
              style={{ backgroundColor: pinTarget.color }}
            >
              {pinTarget.name.charAt(0).toUpperCase()}
            </span>
            <div className="text-center">
              <h2 className="heading text-xl text-le-text">{pinTarget.name}</h2>
              <p className="mt-1 text-sm text-le-text-secondary">
                Enter your 4-digit PIN
              </p>
            </div>
            <input
              inputMode="numeric"
              pattern="\d*"
              autoFocus
              value={pinInput}
              onChange={(e) => {
                setPinError(false);
                setPinInput(e.target.value.replace(/\D/g, "").slice(0, 4));
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") verifyPin();
              }}
              placeholder="••••"
              className={cn(
                "w-36 rounded-xl border bg-le-bg px-4 py-3 text-center text-2xl tracking-[0.4em] text-le-text outline-none ring-le-mint/30 focus:ring-2",
                pinError
                  ? "border-red-500/70 focus:border-red-500/70"
                  : "border-le-border focus:border-le-mint/40"
              )}
            />
            {pinError && (
              <p className="text-sm text-red-400">Incorrect PIN — try again.</p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setPinTarget(null);
                  setView("grid");
                }}
                className="rounded-xl border border-le-border px-5 py-2.5 text-sm font-medium text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
              >
                Back
              </button>
              <button
                type="button"
                onClick={verifyPin}
                disabled={pinInput.length !== 4}
                className="rounded-xl bg-le-accent px-6 py-2.5 text-sm font-semibold text-le-bg transition-all hover:brightness-110 disabled:opacity-40"
              >
                Unlock
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
