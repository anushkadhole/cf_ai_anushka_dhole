# cf_ai_study_coach

An AI-powered study coach built entirely on the Cloudflare stack. Ask it anything, get clear explanations, request quizzes on what you've learned, and track your progress — all with persistent memory across your session.

## Architecture

User Browser
     │
     ▼
Cloudflare Workers (src/index.js)
     │
     ├── GET  /          → Serves the full chat UI (single-file HTML)
     │
     ├── POST /chat      → Streams LLM tokens via Workers AI (Llama 3.3 70B)
     │       │               + reads/writes memory via Durable Object
     │       ▼
     │   StudySession Durable Object (src/durable-object.js)
     │       └── Persistent storage: conversation history + topics list
     │
     ├── POST /quiz      → Fetches session history → asks LLM to generate
     │                     a 3-question multiple choice quiz as JSON
     │
     └── GET  /progress  → Returns session stats from Durable Object

### Components

| Requirement | Implementation |
|---|---|
| **LLM** | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` via Workers AI |
| **Workflow / coordination** | Durable Objects orchestrate per-session state; Worker routes coordinate chat → DO → AI → stream pipeline |
| **User input via chat** | Streaming chat UI served by the Worker (SSE / ReadableStream) |
| **Memory / state** | `StudySession` Durable Object persists full conversation history and topics to Durable Object storage |

---


```bash
git clone https://github.com/<your-username>/cf_ai_study_coach.git
cd cf_ai_study_coach
npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create a KV namespace (used for session lookups)

```bash
wrangler kv namespace create SESSIONS_KV
```

Copy the `id` from the output and paste it into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "SESSIONS_KV"
id = "PASTE_YOUR_ID_HERE"
```

### 4. Run locally

```bash
wrangler dev
```

Open `http://localhost:8787` in your browser.

### 5. Deploy to Cloudflare

```bash
wrangler deploy
```

Your app will be live at `https://cf-ai-study-coach.<your-subdomain>.workers.dev`.

---

## Project Structure

```
cf_ai_study_coach/
├── src/
│   ├── index.js          # Main Worker: routing, /chat, /quiz, /progress, UI
│   └── durable-object.js # StudySession Durable Object: memory & state
├── wrangler.toml         # Cloudflare Workers config
├── package.json
├── README.md             # This file
└── PROMPTS.md            # AI prompts used during development
```

---

## API Reference


## How It Works

1. **User sends a message** → POST /chat
2. **Worker fetches history** from the `StudySession` Durable Object for that session
3. **Worker calls Workers AI** (Llama 3.3 70B) with system prompt + history + new message, streaming enabled
4. **Tokens stream back** to the browser via Server-Sent Events as they are generated
5. **The AI embeds a TOPIC tag** in its response; the Worker extracts it, strips it from the visible output, and sends it as metadata
6. **Completed response + topic saved** to the Durable Object for the next turn
7. **Quiz** — on demand, session history is fed back to the LLM with a structured JSON prompt; the UI renders interactive buttons

---

## Tech Stack

| Technology | Role |
|---|---|
| Cloudflare Workers | Serverless compute + request routing |
| Workers AI (Llama 3.3 70B) | LLM inference, streaming |
| Durable Objects | Per-session persistent memory and state |
| KV Namespaces | Session namespace management |
| Server-Sent Events | Real-time token streaming to browser |
| Vanilla JS + HTML/CSS | Zero-dependency chat UI |

---

## License

MIT
