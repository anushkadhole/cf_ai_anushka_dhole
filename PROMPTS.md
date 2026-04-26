# PROMPTS.md

All AI prompts used during the development of `cf_ai_study_coach`, as required by the Cloudflare internship assignment instructions.

---

## 1. Project Architecture Design

**Prompt used:**
> "I'm building a Cloudflare AI app for a software engineering internship assignment. Requirements: LLM (Llama 3.3 on Workers AI), workflow/coordination via Durable Objects or Workflows, user chat input, and persistent memory/state. What's a compelling app idea that uses all four components naturally, and how should I structure the Worker routes and Durable Object?"

**Output used for:** Deciding on the Study Coach concept and the route structure (`/chat`, `/quiz`, `/progress`), and the design pattern of one Durable Object per session identified by a client-generated session ID.

---

## 2. System Prompt for the Study Coach LLM

**Prompt used to design the system prompt:**
> "Write a system prompt for an AI study coach powered by Llama 3.3. It should explain concepts clearly, use examples, encourage deeper learning, and automatically output a TOPIC tag on a new line so the app can extract what subject was covered. The tag format should be 'TOPIC: <2-4 word topic name>'."

**Resulting system prompt (used in `/chat`):**
```
You are an expert AI Study Coach. Your job is to explain concepts clearly,
answer questions accurately, and help users learn effectively. You:
- Break down complex topics into digestible explanations
- Use examples and analogies to clarify difficult concepts
- Encourage deeper understanding with follow-up context
- Keep responses focused, structured, and educational
- When appropriate, suggest related topics to explore

After your explanation, on a NEW LINE output exactly:
TOPIC: <2-4 word topic name>

Be concise but thorough. Use markdown formatting (bold for key terms,
code blocks for code).
```

---

## 3. Quiz Generation Prompt

**Prompt used to design the quiz generation prompt:**
> "Write a prompt for Llama 3.3 that takes a block of study session content and generates exactly 3 multiple choice questions as a JSON array. Each question should have a 'question' string, an 'options' array of 4 strings, and a 'correct' integer (0-based index). The model should return only valid JSON with no surrounding text."

**Resulting prompt (used in `/quiz`):**
```
Based on this study session content, generate exactly 3 multiple choice
quiz questions to test understanding.

Content:
{context}

Respond ONLY with valid JSON in this exact format, no other text:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }
]

The "correct" field is the 0-based index of the correct option.
```

---

## 4. Durable Object Memory Design

**Prompt used:**
> "In a Cloudflare Durable Object for a chat app, what's the best way to persist conversation history and a list of topics? Should I use storage.put on every message or batch writes? What internal fetch endpoints should I expose for the main Worker to call?"

**Output used for:** The `initialize()` pattern loading state once per DO instance, using `storage.put` on every message write (acceptable at chat frequency), and the `/history`, `/add`, `/progress`, `/clear` internal endpoint design.

---

## 5. Streaming SSE Implementation

**Prompt used:**
> "How do I stream tokens from Workers AI (Llama 3.3 with stream: true) to a browser using Server-Sent Events in a Cloudflare Worker? Show me the TransformStream + writer pattern and how to parse the async iterable from the AI binding."

**Output used for:** The `TransformStream` / `ReadableStream` pattern in the `/chat` handler, the `for await (const chunk of stream)` loop, and the `data: {...}\n\n` SSE format.

---

## 6. Chat UI Design

**Prompt used:**
> "Design a dark-mode chat UI in a single HTML file (no frameworks) for an AI study coach. It should have: a sidebar showing topics covered and session stats, a message area with user/AI bubbles, a streaming typing indicator, a textarea input with Enter to send, and a quiz card component with clickable multiple choice buttons. Use CSS variables for theming. Keep everything in one HTML string that can be served from a Cloudflare Worker."

**Output used for:** The overall UI layout, color variables, message bubble structure, typing indicator animation, and quiz card component. Heavily modified for the final implementation.

---

## 7. Topic Extraction Pattern

**Prompt used:**
> "In my Cloudflare Worker, I'm streaming tokens from Llama 3.3. The model outputs a 'TOPIC: xyz' line at the end. How do I extract the topic from the streaming buffer without sending it to the browser, but still send a separate SSE event with the topic metadata?"

**Output used for:** The `fullResponse` accumulation pattern, the regex `match(/TOPIC:\s*(.+)/)` check inside the streaming loop, and sending `{ topic }` as a separate JSON SSE event while filtering out TOPIC tokens from the visible stream.

---

*All implementation, architecture decisions, integration logic, error handling, and UI polish were written and verified by the developer. AI prompts were used for design input and pattern research, not for copy-paste code generation.*
