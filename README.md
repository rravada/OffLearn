# OffLearn

**A fully equipped school that fits in a browser tab — no internet required, no cost, no data collected, ever.**

OffLearn is an offline-first AI learning platform that runs entirely in your browser. It uses on-device AI models (MediaPipe, Transformers.js) so students can learn without an internet connection, without paying for API calls, and without sending any data to external servers.

## Features

- **100% Offline** — Works without internet after initial load. Installable as a PWA.
- **On-Device AI Tutor** — Uses MediaPipe GenAI and Xenova/Transformers for local inference.
- **Structured Curriculum** — Math, Science, History, English, Economics, and Computer Science.
- **Test Prep** — SAT Reading, SAT Math, and ACT Math practice.
- **RAG-Powered** — Local vector search (Voy) over knowledge packs for grounded responses.
- **Zero Data Collection** — All data stays in IndexedDB on your device.

## Tech Stack

- [Next.js 14](https://nextjs.org/) (Static Export)
- [React 18](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Tailwind CSS 3](https://tailwindcss.com/)
- [MediaPipe GenAI](https://ai.google.dev/edge/mediapipe/solutions/genai/llm_inference/web_js) — on-device LLM inference
- [Transformers.js](https://huggingface.co/docs/transformers.js) — local embedding models
- [Voy](https://github.com/nicksrandall/voy) — in-browser vector search
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (via `idb`) — local persistence
- [Zustand](https://zustand-demo.pmnd.rs/) — state management

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- npm

### Install

```bash
npm install
```

> The `postinstall` script automatically copies MediaPipe WASM files into `public/mediapipe-wasm/`.

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production Build

```bash
npm run build
```

This generates a static site in the `out/` directory. Serve it with any static file server:

```bash
npx serve out
```

### Lint

```bash
npm run lint
```

## Project Structure

```
OffLearn/
├── app/                    # Next.js App Router (layout, page, styles)
├── components/             # React components
│   ├── layout/             #   Sidebar, TutorPanel
│   └── views/              #   LearnView, TestPrepView
├── lib/                    # Core logic
│   ├── db/                 #   IndexedDB persistence
│   ├── inference/          #   MediaPipe LLM, subject prompts
│   ├── rag/                #   Vector store, chunk loader
│   └── store/              #   Zustand app store
├── public/                 # Static assets
│   ├── curriculum/         #   Subject lesson JSON files
│   ├── testprep/           #   SAT/ACT practice JSON files
│   ├── knowledge-packs/    #   RAG knowledge pack JSON files
│   └── mediapipe-wasm/     #   MediaPipe WASM (generated on install)
├── scripts/                # Build helpers
└── types/                  # TypeScript type definitions
```

## License

[MIT](LICENSE)
