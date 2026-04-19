const DEFAULT_API_URL = 'http://localhost:7777';
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 90_000;

export async function* runResearchStream(
  message,
  {
    apiUrl = process.env.RESEARCH_AGENT_API_URL ?? DEFAULT_API_URL,
    sessionId,
    ticker,
    idleTimeoutMs = getIdleTimeoutMs()
  } = {}
) {
  const body = new URLSearchParams();
  body.set('message', message);
  body.set('stream', 'true');
  body.set('stream_events', 'true');
  body.set('stream_member_events', 'true');

  if (sessionId) {
    body.set('session_id', sessionId);
  }
  if (ticker) {
    body.set('ticker', ticker);
  }

  const controller = new AbortController();
  let idleTimer = null;
  const resetIdleTimer = () => {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
    if (idleTimeoutMs > 0) {
      idleTimer = setTimeout(() => {
        controller.abort(new Error(`API stream went idle for ${formatDuration(idleTimeoutMs)}`));
      }, idleTimeoutMs);
    }
  };

  resetIdleTimer();

  try {
    const response = await fetch(`${apiUrl}/teams/financial-research-team/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body,
      signal: controller.signal
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`API request failed with ${response.status}: ${detail}`);
    }

    if (!response.body) {
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const {done, value} = await reader.read();

      if (done) {
        break;
      }

      resetIdleTimer();
      yield decoder.decode(value, {stream: true});
    }

    const remaining = decoder.decode();

    if (remaining) {
      yield remaining;
    }
  } catch (caught) {
    if (controller.signal.aborted) {
      const reason = controller.signal.reason;
      throw reason instanceof Error ? reason : new Error('API stream was aborted');
    }
    throw caught;
  } finally {
    if (idleTimer) {
      clearTimeout(idleTimer);
    }
  }
}

function getIdleTimeoutMs() {
  const value = Number(process.env.RESEARCH_AGENT_STREAM_IDLE_TIMEOUT_MS);
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }
  return DEFAULT_STREAM_IDLE_TIMEOUT_MS;
}

function formatDuration(milliseconds) {
  if (milliseconds < 1000) {
    return `${milliseconds}ms`;
  }
  return `${Math.round(milliseconds / 1000)}s`;
}

export async function fetchSessionCost(
  sessionId,
  {apiUrl = process.env.RESEARCH_AGENT_API_URL ?? DEFAULT_API_URL} = {}
) {
  if (!sessionId) throw new Error('sessionId is required');
  const response = await fetch(
    `${apiUrl}/sessions/${encodeURIComponent(sessionId)}/cost`
  );
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`cost fetch failed with ${response.status}: ${detail}`);
  }
  return response.json();
}
