/**
 * cf_ai_study_coach - Main Worker Entry Point
 *
 * Routes:
 *   GET  /           → Serve chat UI (index.html)
 *   POST /chat        → Stream LLM response via Workers AI (Llama 3.3)
 *   GET  /session/:id → Fetch session memory from Durable Object
 *   POST /quiz        → Generate a quiz from session history
 *   GET  /progress    → Return progress summary for the session
 */

import { StudySession } from "./durable-object.js";

export { StudySession };

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>CF AI Study Coach</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0f1117;
      --surface: #1a1d27;
      --surface2: #22263a;
      --border: rgba(255,255,255,0.08);
      --accent: #f6821f;
      --accent2: #fbad41;
      --text: #e8eaf0;
      --muted: #8b8fa8;
      --user-bubble: #1e3a5f;
      --ai-bubble: #1a1d27;
      --success: #22c55e;
      --radius: 14px;
      --font: 'Inter', system-ui, sans-serif;
    }

    body {
      font-family: var(--font);
      background: var(--bg);
      color: var(--text);
      height: 100dvh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px 20px;
      border-bottom: 1px solid var(--border);
      background: var(--surface);
      flex-shrink: 0;
    }

    .logo {
      width: 32px;
      height: 32px;
      background: linear-gradient(135deg, var(--accent), var(--accent2));
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;
    }

    header h1 {
      font-size: 16px;
      font-weight: 600;
      color: var(--text);
    }

    header span {
      font-size: 12px;
      color: var(--muted);
      margin-left: 4px;
    }

    .header-right {
      margin-left: auto;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .progress-pill {
      font-size: 12px;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 4px 12px;
      color: var(--muted);
      cursor: pointer;
      transition: border-color 0.2s;
    }

    .progress-pill:hover { border-color: var(--accent); color: var(--accent); }

    .quiz-btn {
      font-size: 12px;
      background: var(--accent);
      border: none;
      border-radius: 20px;
      padding: 5px 14px;
      color: #fff;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }

    .quiz-btn:hover { opacity: 0.85; }

    .layout {
      display: flex;
      flex: 1;
      overflow: hidden;
    }

    .sidebar {
      width: 220px;
      background: var(--surface);
      border-right: 1px solid var(--border);
      padding: 16px 12px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex-shrink: 0;
      overflow-y: auto;
    }

    .sidebar-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: var(--muted);
      padding: 0 4px 4px;
    }

    .topic-tag {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 7px 10px;
      border-radius: 8px;
      font-size: 13px;
      color: var(--text);
      background: transparent;
      border: 1px solid transparent;
      cursor: default;
      transition: background 0.15s;
    }

    .topic-tag .dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: var(--accent);
      flex-shrink: 0;
    }

    .topic-tag.new { background: var(--surface2); border-color: var(--border); }

    .stats-block {
      margin-top: auto;
      border-top: 1px solid var(--border);
      padding-top: 12px;
    }

    .stat-row {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      color: var(--muted);
      padding: 3px 4px;
    }

    .stat-row strong { color: var(--text); }

    .chat-area {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }

    .messages {
      flex: 1;
      overflow-y: auto;
      padding: 24px 20px;
      display: flex;
      flex-direction: column;
      gap: 16px;
      scroll-behavior: smooth;
    }

    .messages::-webkit-scrollbar { width: 4px; }
    .messages::-webkit-scrollbar-track { background: transparent; }
    .messages::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }

    .msg {
      display: flex;
      gap: 10px;
      max-width: 780px;
      width: 100%;
    }

    .msg.user { margin-left: auto; flex-direction: row-reverse; }

    .avatar {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 13px;
      font-weight: 600;
    }

    .msg.ai .avatar { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; }
    .msg.user .avatar { background: var(--user-bubble); color: var(--text); font-size: 11px; }

    .bubble {
      padding: 12px 16px;
      border-radius: var(--radius);
      font-size: 14px;
      line-height: 1.65;
      max-width: calc(100% - 42px);
    }

    .msg.ai .bubble {
      background: var(--ai-bubble);
      border: 1px solid var(--border);
      border-top-left-radius: 4px;
    }

    .msg.user .bubble {
      background: var(--user-bubble);
      border: 1px solid rgba(59,130,246,0.2);
      border-top-right-radius: 4px;
    }

    .bubble pre {
      background: rgba(0,0,0,0.3);
      border-radius: 8px;
      padding: 12px;
      overflow-x: auto;
      font-size: 13px;
      margin: 8px 0;
      border: 1px solid var(--border);
    }

    .bubble code { font-family: 'Fira Code', monospace; font-size: 13px; }

    .bubble p + p { margin-top: 8px; }

    .bubble strong { color: var(--accent2); font-weight: 600; }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 4px 0;
    }

    .typing-indicator span {
      width: 6px; height: 6px;
      background: var(--muted);
      border-radius: 50%;
      animation: bounce 1.2s infinite;
    }

    .typing-indicator span:nth-child(2) { animation-delay: 0.2s; }
    .typing-indicator span:nth-child(3) { animation-delay: 0.4s; }

    @keyframes bounce {
      0%, 60%, 100% { transform: translateY(0); }
      30% { transform: translateY(-5px); }
    }

    .quiz-card {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 16px;
      margin-top: 8px;
    }

    .quiz-card .question { font-weight: 600; margin-bottom: 12px; font-size: 14px; }

    .quiz-option {
      display: block;
      width: 100%;
      text-align: left;
      background: transparent;
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 9px 14px;
      color: var(--text);
      font-size: 13px;
      cursor: pointer;
      margin-bottom: 7px;
      transition: border-color 0.15s, background 0.15s;
    }

    .quiz-option:hover { border-color: var(--accent); background: rgba(246,130,31,0.06); }
    .quiz-option.correct { border-color: var(--success); background: rgba(34,197,94,0.08); color: var(--success); }
    .quiz-option.wrong { border-color: #ef4444; background: rgba(239,68,68,0.08); color: #ef4444; }

    .input-bar {
      border-top: 1px solid var(--border);
      background: var(--surface);
      padding: 14px 20px;
      display: flex;
      gap: 10px;
      align-items: flex-end;
      flex-shrink: 0;
    }

    .input-wrap {
      flex: 1;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 12px;
      display: flex;
      align-items: flex-end;
      gap: 8px;
      padding: 10px 14px;
      transition: border-color 0.2s;
    }

    .input-wrap:focus-within { border-color: var(--accent); }

    #user-input {
      flex: 1;
      background: transparent;
      border: none;
      outline: none;
      color: var(--text);
      font-size: 14px;
      font-family: var(--font);
      resize: none;
      max-height: 120px;
      line-height: 1.5;
    }

    #user-input::placeholder { color: var(--muted); }

    .send-btn {
      width: 32px; height: 32px;
      background: var(--accent);
      border: none;
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: opacity 0.2s;
    }

    .send-btn:hover { opacity: 0.85; }
    .send-btn:disabled { opacity: 0.4; cursor: not-allowed; }

    .send-btn svg { width: 16px; height: 16px; fill: #fff; }

    .welcome {
      text-align: center;
      padding: 40px 20px;
      color: var(--muted);
    }

    .welcome h2 { font-size: 22px; color: var(--text); margin-bottom: 8px; }
    .welcome p { font-size: 14px; margin-bottom: 24px; line-height: 1.6; }

    .suggestion-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      max-width: 500px;
      margin: 0 auto;
    }

    .suggestion {
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 13px;
      color: var(--text);
      cursor: pointer;
      text-align: left;
      transition: border-color 0.15s;
    }

    .suggestion:hover { border-color: var(--accent); }
    .suggestion .icon { font-size: 18px; display: block; margin-bottom: 4px; }

    @media (max-width: 640px) {
      .sidebar { display: none; }
      .suggestion-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>

<header>
  <div class="logo">&#9998;</div>
  <h1>Study Coach <span>powered by Cloudflare AI</span></h1>
  <div class="header-right">
    <div class="progress-pill" onclick="loadProgress()">&#128200; Progress</div>
    <button class="quiz-btn" onclick="requestQuiz()">Quick Quiz</button>
  </div>
</header>

<div class="layout">
  <aside class="sidebar">
    <div class="sidebar-title">Topics Covered</div>
    <div id="topics-list">
      <div style="font-size:12px;color:var(--muted);padding:4px">Start chatting to track topics...</div>
    </div>
    <div class="stats-block">
      <div class="stat-row">Messages <strong id="msg-count">0</strong></div>
      <div class="stat-row">Topics <strong id="topic-count">0</strong></div>
      <div class="stat-row">Quizzes <strong id="quiz-count">0</strong></div>
    </div>
  </aside>

  <div class="chat-area">
    <div class="messages" id="messages">
      <div class="welcome" id="welcome">
        <h2>&#128218; Your AI Study Coach</h2>
        <p>Ask me anything — I'll explain concepts, answer questions,<br>quiz you, and remember everything we've covered.</p>
        <div class="suggestion-grid">
          <button class="suggestion" onclick="sendSuggestion(this)">
            <span class="icon">&#9889;</span>
            Explain how Cloudflare Workers handle requests
          </button>
          <button class="suggestion" onclick="sendSuggestion(this)">
            <span class="icon">&#128200;</span>
            What is a Durable Object and when should I use one?
          </button>
          <button class="suggestion" onclick="sendSuggestion(this)">
            <span class="icon">&#128274;</span>
            How does TLS termination work at the edge?
          </button>
          <button class="suggestion" onclick="sendSuggestion(this)">
            <span class="icon">&#127760;</span>
            Explain DNS resolution step by step
          </button>
        </div>
      </div>
    </div>

    <div class="input-bar">
      <div class="input-wrap">
        <textarea id="user-input" rows="1" placeholder="Ask anything you want to learn..." maxlength="2000"></textarea>
        <button class="send-btn" id="send-btn" onclick="sendMessage()">
          <svg viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  </div>
</div>

<script>
  const SESSION_ID = 'session_' + Math.random().toString(36).slice(2, 10);
  let messageCount = 0;
  let quizCount = 0;
  let topics = new Set();
  let isStreaming = false;

  const messagesEl = document.getElementById('messages');
  const inputEl = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');

  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  function removeWelcome() {
    const w = document.getElementById('welcome');
    if (w) w.remove();
  }

  function addMessage(role, content, streaming = false) {
    removeWelcome();
    const div = document.createElement('div');
    div.className = 'msg ' + role;
    const avatar = document.createElement('div');
    avatar.className = 'avatar';
    avatar.textContent = role === 'ai' ? '&#9998;' : 'YOU';
    if (role === 'ai') avatar.innerHTML = '&#9998;';
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    if (streaming) {
      bubble.innerHTML = '<div class="typing-indicator"><span></span><span></span><span></span></div>';
    } else {
      bubble.innerHTML = formatContent(content);
    }
    div.appendChild(avatar);
    div.appendChild(bubble);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return bubble;
  }

  function formatContent(text) {
    text = text.replace(/```[\s\S]*?```/g, function(m) {
      var code = m.slice(3).replace(/^[^\n]*\n/, '').slice(0, -3);
      return '<pre><code>' + code + '</code></pre>';
    });
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\n/g, '<br>');
    return text;
  }

  function updateStats() {
    document.getElementById('msg-count').textContent = messageCount;
    document.getElementById('topic-count').textContent = topics.size;
    document.getElementById('quiz-count').textContent = quizCount;
  }

  function addTopicTag(topic) {
    if (topics.has(topic)) return;
    topics.add(topic);
    const list = document.getElementById('topics-list');
    if (topics.size === 1) list.innerHTML = '';
    const tag = document.createElement('div');
    tag.className = 'topic-tag new';
    tag.innerHTML = '<div class="dot"></div>' + topic;
    list.appendChild(tag);
    updateStats();
  }

  async function sendMessage(text) {
    const msg = text || inputEl.value.trim();
    if (!msg || isStreaming) return;
    isStreaming = true;
    sendBtn.disabled = true;
    inputEl.value = '';
    inputEl.style.height = 'auto';
    messageCount++;
    updateStats();

    addMessage('user', msg);
    const aiBubble = addMessage('ai', '', true);

    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, sessionId: SESSION_ID })
      });

      if (!res.ok) throw new Error('API error');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      aiBubble.innerHTML = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6).trim();
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.response) {
                fullText += parsed.response;
                aiBubble.innerHTML = formatContent(fullText);
                messagesEl.scrollTop = messagesEl.scrollHeight;
              }
              if (parsed.topic) addTopicTag(parsed.topic);
            } catch {}
          }
        }
      }
    } catch (err) {
      aiBubble.innerHTML = '<span style="color:#ef4444">Error connecting to AI. Please try again.</span>';
    }

    isStreaming = false;
    sendBtn.disabled = false;
    inputEl.focus();
  }

  function sendSuggestion(btn) {
    sendMessage(btn.textContent.trim());
  }

  async function requestQuiz() {
    if (messageCount === 0) {
      alert('Chat with your study coach first, then request a quiz on what you have learned!');
      return;
    }
    quizCount++;
    updateStats();
    addMessage('user', '&#x1F9E0; Give me a quiz on what we have covered.');
    const aiBubble = addMessage('ai', '', true);

    try {
      const res = await fetch('/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: SESSION_ID })
      });
      const data = await res.json();
      if (data.quiz) renderQuiz(aiBubble, data.quiz);
      else aiBubble.innerHTML = 'No quiz available yet. Keep studying!';
    } catch {
      aiBubble.innerHTML = '<span style="color:#ef4444">Failed to generate quiz.</span>';
    }
  }

  function renderQuiz(bubble, quiz) {
    bubble.innerHTML = '';
    quiz.forEach((q, qi) => {
      const card = document.createElement('div');
      card.className = 'quiz-card';
      card.innerHTML = '<div class="question">Q' + (qi + 1) + ': ' + q.question + '</div>';
      q.options.forEach((opt, oi) => {
        const btn = document.createElement('button');
        btn.className = 'quiz-option';
        btn.textContent = opt;
        btn.onclick = () => {
          card.querySelectorAll('.quiz-option').forEach(b => b.disabled = true);
          if (oi === q.correct) btn.classList.add('correct');
          else {
            btn.classList.add('wrong');
            card.querySelectorAll('.quiz-option')[q.correct].classList.add('correct');
          }
        };
        card.appendChild(btn);
      });
      bubble.appendChild(card);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function loadProgress() {
    try {
      const res = await fetch('/progress?sessionId=' + SESSION_ID);
      const data = await res.json();
      const summary = data.topics && data.topics.length > 0
        ? 'Topics covered: ' + data.topics.join(', ') + '. Messages exchanged: ' + data.messageCount + '.'
        : 'No progress yet. Start studying!';
      addMessage('ai', '&#128200; **Your Progress**\\n\\n' + summary);
    } catch {
      addMessage('ai', 'Could not load progress.');
    }
  }
</script>

</body>
</html>`;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/" || url.pathname === "") {
      return new Response(HTML, {
        headers: { "Content-Type": "text/html;charset=UTF-8" },
      });
    }

    if (url.pathname === "/chat" && request.method === "POST") {
      return handleChat(request, env);
    }

    if (url.pathname === "/quiz" && request.method === "POST") {
      return handleQuiz(request, env);
    }

    if (url.pathname === "/progress" && request.method === "GET") {
      return handleProgress(request, env);
    }

    return new Response("Not Found", { status: 404 });
  },
};

// ─── /chat ────────────────────────────────────────────────────────────────────
async function handleChat(request, env) {
  const { message, sessionId } = await request.json();

  if (!message || !sessionId) {
    return new Response(JSON.stringify({ error: "Missing message or sessionId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Get or create Durable Object for this session
  const id = env.STUDY_SESSION.idFromName(sessionId);
  const stub = env.STUDY_SESSION.get(id);

  // Fetch conversation history from Durable Object
  const historyRes = await stub.fetch("https://do/history");
  const { history } = await historyRes.json();

  // Add user message to Durable Object memory
  await stub.fetch("https://do/add", {
    method: "POST",
    body: JSON.stringify({ role: "user", content: message }),
  });

  // Build system prompt
  const systemPrompt = `You are an expert AI Study Coach. Your job is to explain concepts clearly, answer questions accurately, and help users learn effectively. You:
- Break down complex topics into digestible explanations
- Use examples and analogies to clarify difficult concepts
- Encourage deeper understanding with follow-up context
- Keep responses focused, structured, and educational
- When appropriate, suggest related topics to explore

After your explanation, on a NEW LINE output exactly:
TOPIC: <2-4 word topic name>

Be concise but thorough. Use markdown formatting (bold for key terms, code blocks for code).`;

  // Build messages array for LLM
  const messages = [
    ...history.slice(-8), // keep last 8 messages for context window
    { role: "user", content: message },
  ];

  // Stream from Workers AI (Llama 3.3)
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  (async () => {
    try {
      const stream = await env.AI.run(
        "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
        {
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          stream: true,
          max_tokens: 1024,
        }
      );

      let fullResponse = "";
      let topicSent = false;

      for await (const chunk of stream) {
        const token = chunk.response || "";
        fullResponse += token;

        // Check if we have a TOPIC: line and strip it from output
        if (!topicSent && fullResponse.includes("TOPIC:")) {
          const topicMatch = fullResponse.match(/TOPIC:\s*(.+)/);
          if (topicMatch) {
            const topic = topicMatch[1].trim().slice(0, 40);
            // Send topic metadata
            await writer.write(
              encoder.encode(`data: ${JSON.stringify({ topic })}\n\n`)
            );
            topicSent = true;
            // Remove TOPIC line from full response
            fullResponse = fullResponse.replace(/\nTOPIC:.+/, "");
          }
        }

        // Stream visible token (exclude TOPIC line tokens)
        if (!token.includes("TOPIC:")) {
          await writer.write(
            encoder.encode(
              `data: ${JSON.stringify({ response: token })}\n\n`
            )
          );
        }
      }

      // Save AI response to Durable Object
      const cleanResponse = fullResponse.replace(/\nTOPIC:.+/, "").trim();
      await stub.fetch("https://do/add", {
        method: "POST",
        body: JSON.stringify({ role: "assistant", content: cleanResponse }),
      });

      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } catch (err) {
      await writer.write(
        encoder.encode(
          `data: ${JSON.stringify({ response: "Error: " + err.message })}\n\n`
        )
      );
    } finally {
      await writer.close();
    }
  })();

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

// ─── /quiz ────────────────────────────────────────────────────────────────────
async function handleQuiz(request, env) {
  const { sessionId } = await request.json();

  const id = env.STUDY_SESSION.idFromName(sessionId);
  const stub = env.STUDY_SESSION.get(id);

  const historyRes = await stub.fetch("https://do/history");
  const { history } = await historyRes.json();

  if (history.length === 0) {
    return new Response(JSON.stringify({ quiz: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  const context = history
    .filter((m) => m.role === "assistant")
    .map((m) => m.content)
    .join("\n\n")
    .slice(0, 3000);

  const prompt = `Based on this study session content, generate exactly 3 multiple choice quiz questions to test understanding.

Content:
${context}

Respond ONLY with valid JSON in this exact format, no other text:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correct": 0
  }
]

The "correct" field is the 0-based index of the correct option.`;

  const response = await env.AI.run(
    "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 800,
    }
  );

  try {
    const text = response.response || "";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const quiz = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    return new Response(JSON.stringify({ quiz }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ quiz: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

// ─── /progress ────────────────────────────────────────────────────────────────
async function handleProgress(request, env) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");

  if (!sessionId) {
    return new Response(JSON.stringify({ error: "Missing sessionId" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const id = env.STUDY_SESSION.idFromName(sessionId);
  const stub = env.STUDY_SESSION.get(id);

  const progressRes = await stub.fetch("https://do/progress");
  const progress = await progressRes.json();

  return new Response(JSON.stringify(progress), {
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
