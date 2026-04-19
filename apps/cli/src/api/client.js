const DEFAULT_API_URL = 'http://localhost:7777';

export async function* runResearchStream(
  message,
  {apiUrl = process.env.RESEARCH_AGENT_API_URL ?? DEFAULT_API_URL, sessionId} = {}
) {
  const body = new URLSearchParams();
  body.set('message', message);
  body.set('stream', 'true');
  body.set('stream_events', 'true');
  body.set('stream_member_events', 'true');

  if (sessionId) {
    body.set('session_id', sessionId);
  }

  const response = await fetch(`${apiUrl}/teams/financial-research-team/runs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
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

    yield decoder.decode(value, {stream: true});
  }

  const remaining = decoder.decode();

  if (remaining) {
    yield remaining;
  }
}
