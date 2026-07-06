"use strict";
/* ============================================================
   Server connection + OpenAI-compatible streaming chat
   ============================================================ */

function apiBase(url) {
  return (url || DB.settings.url || "http://127.0.0.1:8081").replace(/\/+$/, "");
}

async function checkConnection() {
  const status = $("conn-status");
  const host = apiBase().replace(/^https?:\/\//, "");
  try {
    const r = await fetch(apiBase() + "/v1/models", { signal: AbortSignal.timeout(4000) });
    if (!r.ok) throw new Error("HTTP " + r.status);
    status.classList.add("online");
    status.title = "Online · " + host + " (click to re-check)";
    return true;
  } catch {
    status.classList.remove("online");
    status.title = "Offline · " + host + " (click to re-check)";
    return false;
  }
}

async function fetchModelList(url) {
  const r = await fetch(apiBase(url) + "/v1/models", { signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error("HTTP " + r.status);
  const j = await r.json();
  return (j.data || []).map(m => m.id).filter(Boolean);
}

/* Streams a chat completion; calls onDelta(textChunk) as tokens arrive.
   Returns the number of chunks received (≈ token count). */
async function streamChat({ messages, temperature, topP, signal, onDelta }) {
  const body = {
    model: DB.settings.model || "default",
    messages,
    temperature,
    max_tokens: DB.settings.maxTokens,
    stream: true
  };
  if (topP != null && topP < 1) body.top_p = topP;
  const resp = await fetch(apiBase() + "/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify(body)
  });
  if (!resp.ok) {
    let detail = "";
    try { detail = (await resp.text()).slice(0, 300); } catch {}
    throw new Error("Server error " + resp.status + (detail ? " — " + detail : ""));
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "", chunks = 0, finishReason = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop(); // keep incomplete line for next read
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith("data:")) continue;
      const payload = t.slice(5).trim();
      if (payload === "[DONE]") continue;
      try {
        const j = JSON.parse(payload);
        const delta = j.choices?.[0]?.delta?.content ?? j.choices?.[0]?.text ?? "";
        if (delta) { chunks++; onDelta(delta); }
        if (j.choices?.[0]?.finish_reason) finishReason = j.choices[0].finish_reason;
      } catch { /* ignore malformed keep-alive lines */ }
    }
  }
  return { chunks, finishReason };
}
