"use client";

import { useState, useCallback, useRef } from "react";
import { ArrowLeft, Upload, FileText, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { generateId } from "@/lib/utils";
import { extractTextFromPDF } from "@/lib/pdf/extractText";
import { chunkText } from "@/lib/pdf/chunkText";
import { embedChunks } from "@/lib/pdf/embedChunks";
import { saveTeacherModule } from "@/lib/db/indexeddb";
import type { TeacherModule } from "@/types";

type Step = 1 | 2 | 3;

interface CreateModuleViewProps {
  onBack: () => void;
  onModuleCreated: (module: TeacherModule) => void;
}

export function CreateModuleView({
  onBack,
  onModuleCreated,
}: CreateModuleViewProps) {
  const [step, setStep] = useState<Step>(1);
  const [file, setFile] = useState<File | null>(null);
  const [moduleName, setModuleName] = useState("");
  const [subject, setSubject] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [embedProgress, setEmbedProgress] = useState(0);
  const [createdModule, setCreatedModule] = useState<TeacherModule | null>(
    null
  );
  const [errorMessage, setErrorMessage] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(
    (selectedFile: File) => {
      const isPdf =
        selectedFile.type === "application/pdf" ||
        selectedFile.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) return;
      setFile(selectedFile);
      setErrorMessage("");
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile) handleFileSelect(droppedFile);
    },
    [handleFileSelect]
  );

  const handleProcess = useCallback(async () => {
    if (!file || !moduleName.trim()) return;

    setErrorMessage("");
    setStep(2);
    setEmbedProgress(0);

    try {
      setStatusMessage("Reading PDF...");
      const text = await extractTextFromPDF(file);

      if (!text.trim()) {
        throw new Error("Could not extract any text from this PDF. It may be image-based or scanned.");
      }

      const pageCount = text.split("\n\n").filter((p) => p.trim()).length;

      setStatusMessage("Breaking into study chunks...");
      const chunks = chunkText(text);

      setStatusMessage("Building AI knowledge index... 0%");
      const embedded = await embedChunks(chunks, (pct) => {
        setEmbedProgress(pct);
        setStatusMessage(`Building AI knowledge index... ${pct}%`);
      });

      setStatusMessage("Saving to your device...");
      const newModule: TeacherModule = {
        id: generateId(),
        title: moduleName.trim(),
        subject: subject.trim() || "General",
        createdAt: Date.now(),
        pageCount,
        chunkCount: chunks.length,
        embeddings: embedded,
      };

      await saveTeacherModule(newModule);
      setCreatedModule(newModule);
      setStep(3);
    } catch (err) {
      console.error("Module creation failed:", err);
      const message =
        err instanceof Error ? err.message : "Something went wrong.";
      setErrorMessage(message);
      setStep(1);
    }
  }, [file, moduleName, subject]);

  const fileSizeWarning =
    file && file.size > 10 * 1024 * 1024;

  const STEP_LABELS = ["Upload", "Processing", "Ready"];

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <div className="border-b border-le-border bg-le-surface/50 px-8 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-md p-1.5 text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <h1 className="heading text-lg text-le-text">
            Create Course Module
          </h1>
        </div>

        {/* Step indicator */}
        <div className="mt-4 flex items-center gap-2">
          {STEP_LABELS.map((label, i) => {
            const stepNum = (i + 1) as Step;
            const isActive = step === stepNum;
            const isDone = step > stepNum;
            return (
              <div key={label} className="flex items-center gap-2">
                {i > 0 && (
                  <div
                    className={cn(
                      "h-px w-8",
                      isDone ? "bg-le-accent" : "bg-le-border"
                    )}
                  />
                )}
                <div className="flex items-center gap-1.5">
                  <span
                    className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isActive
                        ? "bg-le-accent text-le-bg"
                        : isDone
                        ? "bg-le-accent/30 text-le-accent"
                        : "bg-le-elevated text-le-text-hint"
                    )}
                  >
                    {stepNum}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-medium",
                      isActive
                        ? "text-le-text"
                        : isDone
                        ? "text-le-text-secondary"
                        : "text-le-text-hint"
                    )}
                  >
                    {label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-[540px]">
          {/* STEP 1 — Upload */}
          {step === 1 && (
            <div className="animate-fade-in space-y-6">
              {/* Drop zone */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-8 py-16 transition-all",
                  dragOver
                    ? "border-le-accent bg-le-accent-soft"
                    : file
                    ? "border-le-accent/40 bg-le-surface"
                    : "border-le-border-strong bg-le-surface hover:border-le-accent/40 hover:bg-le-elevated"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleFileSelect(f);
                  }}
                />

                {file ? (
                  <>
                    <FileText className="mb-3 h-10 w-10 text-le-accent" />
                    <p className="text-sm font-medium text-le-text">
                      {file.name}
                    </p>
                    <p className="mt-1 text-xs text-le-text-secondary">
                      {(file.size / 1024 / 1024).toFixed(1)} MB — Click to
                      change
                    </p>
                  </>
                ) : (
                  <>
                    <Upload className="mb-3 h-10 w-10 text-le-accent" />
                    <p className="text-base font-medium text-le-text">
                      Drop your PDF here
                    </p>
                    <p className="mt-1 text-sm text-le-text-secondary">
                      or click to browse
                    </p>
                    <p className="mt-3 text-xs text-le-text-hint">
                      Accepted: PDF files only
                    </p>
                  </>
                )}
              </div>

              {fileSizeWarning && (
                <p className="text-xs text-le-accent">
                  This is a large file. Processing may take several minutes.
                </p>
              )}

              {/* Module name */}
              <div>
                <label className="label-badge mb-2 block text-le-text-hint">
                  Give this module a name
                </label>
                <input
                  type="text"
                  value={moduleName}
                  onChange={(e) => setModuleName(e.target.value)}
                  placeholder="e.g. Chapter 4 — The Civil War"
                  className="w-full rounded-lg border border-le-border bg-le-elevated px-4 py-3 text-sm text-le-text placeholder:text-le-text-hint outline-none transition-colors focus:border-le-accent"
                />
              </div>

              {/* Subject */}
              <div>
                <label className="label-badge mb-2 block text-le-text-hint">
                  Subject (optional)
                </label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. US History"
                  className="w-full rounded-lg border border-le-border bg-le-elevated px-4 py-3 text-sm text-le-text placeholder:text-le-text-hint outline-none transition-colors focus:border-le-accent"
                />
              </div>

              {errorMessage && (
                <div className="rounded-lg border border-le-red/30 bg-le-red/10 px-4 py-3 text-sm text-le-red">
                  {errorMessage}
                </div>
              )}

              {/* Process button */}
              <button
                type="button"
                onClick={handleProcess}
                disabled={!file || !moduleName.trim()}
                className="w-full rounded-xl bg-le-accent px-6 py-3.5 text-sm font-semibold text-le-bg transition-all hover:brightness-110 disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Process PDF
              </button>
            </div>
          )}

          {/* STEP 2 — Processing */}
          {step === 2 && (
            <div className="animate-fade-in flex flex-col items-center py-16">
              <div className="w-full max-w-sm space-y-6">
                <div className="rounded-xl border border-le-border bg-le-surface p-6">
                  {/* Progress bar */}
                  <div className="h-2 w-full overflow-hidden rounded-full bg-le-elevated">
                    <div
                      className="h-full rounded-full bg-le-accent transition-all duration-300 progress-bar-glow"
                      style={{ width: `${Math.max(embedProgress, 5)}%` }}
                    />
                  </div>

                  {/* Status */}
                  <p className="mt-4 text-center text-sm font-medium text-le-text">
                    {statusMessage}
                  </p>
                  <p className="mt-2 text-center text-xs text-le-text-hint">
                    Large PDFs may take 2-5 minutes
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 — Ready */}
          {step === 3 && createdModule && (
            <div className="animate-fade-in flex flex-col items-center py-16">
              <div className="flex flex-col items-center text-center">
                <div className="celebrate-pulse mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-le-green/15">
                  <CheckCircle2 className="h-8 w-8 text-le-green" />
                </div>
                <h2 className="heading text-xl text-le-text">
                  Your module is ready!
                </h2>
                <p className="mt-2 text-sm text-le-text-secondary">
                  {createdModule.pageCount} pages processed &middot;{" "}
                  {createdModule.chunkCount} study chunks indexed
                </p>

                <div className="mt-8 flex gap-3">
                  <button
                    type="button"
                    onClick={() => onModuleCreated(createdModule)}
                    className="flex items-center gap-2 rounded-xl bg-le-accent px-6 py-3 text-sm font-semibold text-le-bg transition-all hover:brightness-110"
                  >
                    Start Studying &rarr;
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setStep(1);
                      setFile(null);
                      setModuleName("");
                      setSubject("");
                      setEmbedProgress(0);
                      setCreatedModule(null);
                    }}
                    className="rounded-xl border border-le-border px-6 py-3 text-sm font-medium text-le-text-secondary transition-colors hover:bg-le-hover hover:text-le-text"
                  >
                    Create Another
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
