# OffLearn

Offline-first learning in the browser: a structured curriculum, SAT/ACT-style test prep, progress tracking with local profiles, and an in-browser AI tutor. No subscription, no server, no user data sent to third parties. After the first load, the app works without a network connection.

## About

OffLearn is a static PWA (Next.js `output: "export"`) that bundles authored lesson content, unit reviews, course finals, and practice questions with a language model running entirely on the client. On WebGPU-capable desktop browsers it runs Google's Gemma (a MediaPipe `.task` asset); on machines without WebGPU it falls back to a smaller ONNX model via Transformers.js on the CPU. The tutor is grounded in the lesson currently open using deterministic, fully offline keyword retrieval, so answers stay on topic without requiring an embedding model at runtime.

There is no backend of any kind: hosting is static files, and all persistence (profiles, progress, chat history, mastery scores) lives in IndexedDB on the device.

## Features

- **Offline use.** A hand-written service worker precaches all curriculum, test prep, WASM, and model assets. Core flows work without network after the first successful load, and the app is installable as a PWA.
- **Structured curriculum.** Nine subjects, including a complete Algebra course and AP Calculus AB, AP Biology, and AP World History tracks, plus Science, History, English, Economics, and Computer Science, with roughly 190 sequenced lessons in total.
- **Assessments.** Unit reviews and course finals with scored questions, tracked per profile.
- **Test prep.** SAT Reading, SAT Math, and ACT Math practice modes.
- **AI tutor.** A chat panel powered by local Gemma inference (WebGPU) with an automatic CPU fallback, grounded in the open lesson's content.
- **Local profiles and progress.** Multiple per-device profiles with optional 4-digit PINs, a progress dashboard with streaks and per-lesson completion, and no accounts or authentication.
- **Portable build.** `npm run export:portable` produces a self-contained zip (app, model, and a tiny static file server per platform) that runs from a USB drive with nothing installed but Chrome.
- **Dark and light themes** with a flash-free theme restore on load.

## Tech stack

| Area | Choices |
| --- | --- |
| App | [Next.js 14](https://nextjs.org/) (static export), [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS 3](https://tailwindcss.com/) |
| GPU inference | [MediaPipe GenAI](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) running a Gemma `.task` asset over WebGPU |
| CPU fallback | [Transformers.js](https://huggingface.co/docs/transformers.js) (onnxruntime-web WASM), default model `Xenova/Qwen1.5-0.5B-Chat` |
| State | [Zustand](https://zustand-demo.pmnd.rs/) (single store) |
| Persistence | [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via [`idb`](https://github.com/jakearchibald/idb) |

## Architecture notes

| Component | Role |
| --- | --- |
| **Curriculum** | Static JSON under `public/curriculum/<subject>/<unit>/<lesson>.json`, indexed by `public/curriculum/index.json` (normalized at runtime). Lesson sections support explanation, example, keypoint, deepdive, steps, quiz, table, and callout types. |
| **Test prep** | Question sets in `public/testprep/*.json`, rendered by `components/views/TestPrepView.tsx`. |
| **Inference engine** | `lib/inference/engine.ts` selects GPU (`mediapipe.ts`) or CPU (`transformers.ts`) once at boot; both implement the same `InferenceEngine` interface. Override with the `?engine=cpu` or `?engine=gpu` query parameter during development. |
| **Model URLs** | The Gemma asset resolves from `NEXT_PUBLIC_GEMMA_MODEL_URL` or falls back to a local file under `public/models/` (gitignored). The CPU model can be swapped with `NEXT_PUBLIC_CPU_MODEL_ID`. |
| **Tutor grounding** | `lib/inference/tutorContext.ts` retrieves relevant lesson chunks with offline keyword scoring and injects them into the system prompt per question. |
| **Offline delivery** | `public/sw.js` plus build scripts in `scripts/` generate and finalize a precache manifest and bake the remote model URL into the service worker so everything, including the model, is cached for offline use. |
| **Profiles and progress** | `lib/db/indexeddb.ts` stores profiles, per-lesson progress entries, activity days for streaks, sessions, messages, and mastery scores. |

**Requirements:** a desktop browser; WebGPU (Chrome 113+) for the full Gemma experience, with an automatic CPU fallback otherwise. Mobile browsers are not supported.

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm
- A desktop browser (Chrome 113+ recommended)

### Install

```bash
npm install
```

The `postinstall` script copies MediaPipe WASM into `public/mediapipe-wasm/`.

### Development

```bash
npm run dev
```

Open the local URL in a desktop browser.

### Production build

```bash
npm run build
```

The build pipeline is sequential and order-dependent: it generates the precache manifest, runs `next build`, finalizes the manifest, and bakes the Gemma URL into the service worker. Running `next build` alone produces a broken service worker.

Output is static files in `out/`. Serve with any static file server, for example:

```bash
npx serve out
```

### Portable build

```bash
npm run build
npm run export:portable
```

Produces `offlearn-portable.zip` containing the app, the Gemma model, and per-platform launcher scripts with a bundled static file server, so it runs on a machine with no installs beyond Chrome.

### Lint

```bash
npm run lint
```

## Project structure

```
OffLearn/
├── app/                    # Next.js App Router (single-page shell)
├── components/
│   ├── layout/             # Sidebar, TutorPanel
│   ├── views/              # Dashboard, Learn, Assessment, Test Prep
│   └── ...                 # ProfilePicker, WelcomeScreen, LoadingScreen
├── lib/
│   ├── curriculum/         # Index normalization
│   ├── db/                 # IndexedDB (profiles, progress, sessions)
│   ├── inference/          # Engine selector, MediaPipe, Transformers.js, tutor grounding
│   ├── offline/            # SW cache priming helpers
│   └── store/              # Zustand store
├── public/
│   ├── curriculum/         # Lesson and assessment JSON per subject
│   ├── testprep/           # SAT/ACT question sets
│   ├── knowledge-packs/    # Bundled reference content
│   ├── mediapipe-wasm/     # Generated on install
│   └── sw.js               # Hand-written service worker
├── scripts/                # Build, precache, portable export, validation
└── types/                  # Shared TypeScript types
```

## License

[MIT](LICENSE)
