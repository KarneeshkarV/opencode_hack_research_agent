import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export function readSseJsonlRunStart(filePath) {
  const resolved = resolve(filePath);
  const text = readFileSync(resolved, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try {
      const record = JSON.parse(line);
      if (record.type === 'run_start') {
        return {
          query: record.query,
          apiUrl: record.apiUrl,
          sessionId: record.sessionId ?? null
        };
      }
    } catch {
      // skip bad lines
    }
  }
  return null;
}

/**
 * Replays a JSONL log written by the CLI (run_start / sse_event / run_end rows)
 * as synthetic SSE chunks so the same parse pipeline as live streaming applies.
 */
export async function* replayFromSseJsonl(filePath, { pacing = 'fast' } = {}) {
  const resolved = resolve(filePath);
  const text = readFileSync(resolved, 'utf8');
  let prevMs = null;

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      continue;
    }
    if (record.type !== 'sse_event' || !record.event) continue;

    const chunk = `data: ${JSON.stringify(record.event)}\n\n`;

    if (pacing === 'recorded' && record.timestamp) {
      const ms = new Date(record.timestamp).getTime();
      if (prevMs !== null) {
        const delta = ms - prevMs;
        const wait = Math.min(Math.max(0, delta), 120);
        await delay(wait);
      }
      prevMs = ms;
    } else if (pacing === 'fast') {
      await delay(1);
    }
    // instant: no delay between events

    yield chunk;
  }
}
