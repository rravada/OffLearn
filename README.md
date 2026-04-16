# OffLearn

Offline-first learning in the browser: **curriculum**, **SAT/ACT-style test prep**, and **in-browser language-model assistance** with **local retrieval** — no subscription, no user data sent to third parties, works after the first load without a network.

## About

OffLearn is a **static PWA** (Next.js export) that bundles authored **lesson content** and **practice questions** with a **Gemma**-based inference stack running **entirely on the client**. You get a structured learn-and-practice experience; the model is built in for **lesson help**, **explanations**, and **RAG-grounded answers** from packaged knowledge, not as a thin wrapper around a chat window. Inference uses **MediaPipe GenAI** and **WebGPU**; embeddings and vector search use **Transformers.js** and **Voy**. There is **no backend** for tutoring — only static hosting and local storage (**IndexedDB**).

## Features

- **Offline use** — After initial load and cache warm-up, core flows work without network; installable as a PWA on supported desktop browsers.
- **Structured curriculum** — Math, science, history, English, economics, and computer science tracks with sequenced lessons.
- **Test prep** — SAT Reading, SAT Math, and ACT Math practice modes.
- **In-browser LLM + RAG** — Local Gemma inference for interactive help; retrieval-augmented prompts over bundled knowledge packs for grounded responses.
- **Privacy** — No accounts required for the above; study data stays on device in IndexedDB.

## Tech stack

| Area | Choices |
| --- | --- |
| App | [Next.js 14](https://nextjs.org/) (static export), [React 18](https://react.dev/), [TypeScript](https://www.typescriptlang.org/), [Tailwind CSS 3](https://tailwindcss.com/) |
| LLM | [MediaPipe GenAI](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) — Gemma `.task` asset, WebGPU; prompts under `lib/inference/` |
| Embeddings & search | [Transformers.js](https://huggingface.co/docs/transformers.js), [Voy](https://github.com/nicksrandall/voy) |
| State & persistence | [Zustand](https://zustand-demo.pmnd.rs/), [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) via [`idb`](https://github.com/jakearchibald/idb) |

## Architecture notes

| Component | Role |
| --- | --- |
| **Lessons & test prep** | JSON under `public/curriculum/` and `public/testprep/`; primary UI in `components/views/`. |
| **LLM session** | MediaPipe loads `gemma-4-E2B-it-web.task` (see `lib/inference/gemmaModelUrl.ts`). Override remote URL with **`NEXT_PUBLIC_GEMMA_MODEL_URL`** for production; build scripts integrate caching for offline use. |
| **RAG** | Knowledge packs in `public/knowledge-packs/` → chunking and Voy index in `lib/rag/`. |
| **Offline delivery** | Service worker + precache manifests and build helpers in `scripts/` so assets including the model can be available offline after first successful load. |

**Requirements:** Desktop browsers with **WebGPU** (e.g. Chrome 113+). **Mobile browsers are not supported** (layout, capability, and model constraints assume desktop).

## Getting started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm
- A **desktop** browser with **WebGPU**

### Install

```bash
npm install
```

The `postinstall` script copies MediaPipe WASM into `public/mediapipe-wasm/`.

### Development

```bash
npm run dev
```

Open the local URL in a **desktop** browser.

### Production build

```bash
npm run build
```

Output is static files in `out/`. Serve with any static file server, for example:

```bash
npx serve out
```

### Lint

```bash
npm run lint
```

## Project structure

```
OffLearn/
├── app/                    # Next.js App Router
├── components/             # UI (layout, Learn, Test Prep, etc.)
├── lib/
│   ├── db/                 # IndexedDB
│   ├── inference/          # MediaPipe LLM, prompts
│   ├── rag/                # Vector store, chunks
│   └── store/              # Zustand
├── public/
│   ├── curriculum/
│   ├── testprep/
│   ├── knowledge-packs/
│   └── mediapipe-wasm/     # Generated on install
├── scripts/                # Build & precache helpers
└── types/
```

## License

[MIT](LICENSE)
