/**
 * Browser-side streaming client for the research agent backend.
 * Mirrors apps/cli/src/api/client.js but targets the Vite dev proxy (`/api`).
 */

const DEFAULT_API_BASE = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : '/api';
const DEFAULT_IDLE_MS = 90_000;

export async function* runResearchStream(
  message,
  {
    apiBase = DEFAULT_API_BASE,
    sessionId,
    ticker,
    idleTimeoutMs = DEFAULT_IDLE_MS,
    signal
  } = {}
) {
  const body = new URLSearchParams();
  body.set('message', message);
  body.set('stream', 'true');
  body.set('stream_events', 'true');
  body.set('stream_member_events', 'true');
  if (sessionId) body.set('session_id', sessionId);
  if (ticker) body.set('ticker', ticker);

  const controller = new AbortController();
  const externalAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason);
    else signal.addEventListener('abort', externalAbort, {once: true});
  }

  let idleTimer = null;
  const resetIdle = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (idleTimeoutMs > 0) {
      idleTimer = setTimeout(() => {
        controller.abort(
          new Error(`API stream went idle for ${Math.round(idleTimeoutMs / 1000)}s`)
        );
      }, idleTimeoutMs);
    }
  };

  resetIdle();
  try {
    const response = await fetch(`${apiBase}/teams/financial-research-team/runs`, {
      method: 'POST',
      headers: {'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/event-stream'},
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`API request failed with ${response.status}: ${detail || response.statusText}`);
    }
    if (!response.body) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      resetIdle();
      yield decoder.decode(value, {stream: true});
    }

    const tail = decoder.decode();
    if (tail) yield tail;
  } catch (caught) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      throw reason instanceof Error ? reason : new Error('API stream was aborted');
    }
    throw caught;
  } finally {
    if (idleTimer) clearTimeout(idleTimer);
    if (signal) signal.removeEventListener('abort', externalAbort);
  }
}

export async function fetchSessionCost(sessionId, {apiBase = DEFAULT_API_BASE} = {}) {
  if (!sessionId) throw new Error('sessionId is required');
  const response = await fetch(
    `${apiBase}/sessions/${encodeURIComponent(sessionId)}/cost`
  );
  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(`cost fetch failed with ${response.status}: ${detail || response.statusText}`);
  }
  return response.json();
}

/* ─────────────── SSE parsing ─────────────── */

export function parseSseEvents(raw) {
  const normalized = raw.replace(/\r\n/g, '\n');
  const chunks = normalized.split('\n\n');
  const remainder = chunks.pop() ?? '';
  const events = [];
  for (const chunk of chunks) {
    const event = parseSseEvent(chunk);
    if (event) events.push(event);
  }
  return {events, remainder};
}

function parseSseEvent(chunk) {
  let eventName = 'message';
  const dataLines = [];
  for (const line of chunk.split('\n')) {
    if (line.startsWith('event:')) eventName = line.slice(6).trim();
    else if (line.startsWith('data:')) dataLines.push(line.slice(5).trimStart());
  }
  if (dataLines.length === 0) return null;
  const parsed = tryParseJSON(dataLines.join('\n'));
  if (!parsed) return null;
  return {...parsed, event: parsed.event ?? eventName};
}

function tryParseJSON(text) {
  if (!text || (text[0] !== '{' && text[0] !== '[')) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export function extractFinalResponse(raw) {
  if (!raw) return '';
  const trimmed = raw.trim();
  const events = [];
  for (const line of trimmed.split(/\r?\n/)) {
    const candidate = line.trim();
    if (!candidate) continue;
    const json = tryParseJSON(candidate) ?? tryParseJSON(stripSsePrefix(candidate));
    if (json) events.push(json);
  }
  if (events.length > 0) {
    const completed = [...events].reverse().find(e => {
      const ev = (e.event ?? e.type ?? '').toString().toLowerCase();
      return ev.includes('completed') || ev.includes('final') || ev === 'runresponse';
    });
    const source = completed ?? events[events.length - 1];
    const content = source?.content ?? source?.message ?? source?.response;
    if (typeof content === 'string' && content.trim()) return content.trim();
    if (content && typeof content === 'object' && typeof content.content === 'string') {
      return content.content.trim();
    }
  }
  return trimmed;
}

function stripSsePrefix(line) {
  return line.startsWith('data:') ? line.slice(5).trim() : line;
}
