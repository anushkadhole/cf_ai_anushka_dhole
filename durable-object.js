/**
 * StudySession Durable Object
 *
 * Provides persistent memory for each user study session.
 * Stores the full conversation history and tracks topics covered.
 *
 * Endpoints (internal):
 *   GET  /history  → returns { history: Message[] }
 *   POST /add      → appends { role, content } to history
 *   GET  /progress → returns { messageCount, topics, topicsLearned }
 */

export class StudySession {
  constructor(state, env) {
    this.state = state;
    this.env = env;
    // Durable Object storage is automatically persisted
    this.history = [];
    this.topics = [];
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    // Load persisted state from Durable Object storage
    this.history = (await this.state.storage.get("history")) || [];
    this.topics = (await this.state.storage.get("topics")) || [];
    this.initialized = true;
  }

  async fetch(request) {
    await this.initialize();
    const url = new URL(request.url);

    // GET /history — return conversation history
    if (url.pathname === "/history") {
      return new Response(
        JSON.stringify({ history: this.history }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // POST /add — append a message to history
    if (url.pathname === "/add" && request.method === "POST") {
      const { role, content } = await request.json();

      this.history.push({
        role,
        content,
        timestamp: Date.now(),
      });

      // Extract and store topic if present in assistant messages
      if (role === "assistant") {
        const topicMatch = content.match(/TOPIC:\s*(.+)/);
        if (topicMatch) {
          const topic = topicMatch[1].trim().slice(0, 40);
          if (!this.topics.includes(topic)) {
            this.topics.push(topic);
          }
        }
      }

      // Persist to Durable Object storage
      await this.state.storage.put("history", this.history);
      await this.state.storage.put("topics", this.topics);

      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // GET /progress — return session progress summary
    if (url.pathname === "/progress") {
      const userMessages = this.history.filter((m) => m.role === "user");
      const assistantMessages = this.history.filter(
        (m) => m.role === "assistant"
      );

      return new Response(
        JSON.stringify({
          messageCount: this.history.length,
          userMessages: userMessages.length,
          assistantMessages: assistantMessages.length,
          topics: this.topics,
          topicsLearned: this.topics.length,
          sessionStarted:
            this.history.length > 0
              ? new Date(this.history[0].timestamp).toISOString()
              : null,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // GET /clear — wipe session (useful for testing)
    if (url.pathname === "/clear" && request.method === "POST") {
      this.history = [];
      this.topics = [];
      await this.state.storage.delete("history");
      await this.state.storage.delete("topics");
      return new Response(JSON.stringify({ ok: true }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("Not Found", { status: 404 });
  }
}
