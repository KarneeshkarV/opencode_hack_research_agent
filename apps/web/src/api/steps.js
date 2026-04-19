/**
 * Formats Agno SSE events into human-readable intermediate steps.
 * Mirrors the logic from apps/cli/src/app.jsx so the web UI shows the
 * same research trace as the terminal.
 */

export function formatIntermediateStep(event) {
  const name = (event.event ?? event.type ?? '').toString();
  if (!name || isContentDeltaEvent(name)) return null;

  const lower = name.toLowerCase();
  const actor =
    event.agent_name ?? event.team_name ?? event.agent_id ?? event.team_id;

  if (lower.includes('runstarted')) {
    return buildStep(event, 'start', 'cyan', 'started', actor ?? 'run started');
  }
  if (lower.includes('modelrequeststarted')) {
    return buildStep(event, 'model', 'cyan', 'model', event.model ?? 'request started');
  }
  if (lower.includes('modelrequestcompleted')) {
    const tokens = event.total_tokens ? `${event.total_tokens} tokens` : 'request completed';
    return buildStep(event, 'model', 'green', 'model', tokens);
  }
  if (lower.includes('toolcallstarted')) {
    return buildStep(event, 'tool', 'yellow', 'tool started', toolName(event));
  }
  if (lower.includes('toolcallcompleted')) {
    return buildStep(event, 'tool', 'green', 'tool completed', toolName(event));
  }
  if (lower.includes('toolcallerror')) {
    return buildStep(event, 'tool', 'red', 'tool error', event.error ?? toolName(event));
  }
  if (lower.includes('intermediatecontent')) {
    return buildStep(event, 'note', 'yellow', 'update', summarizeContent(event.content));
  }
  if (lower.includes('reasoningstarted')) {
    return buildStep(event, 'think', 'cyan', 'reasoning', 'started');
  }
  if (lower.includes('reasoningstep')) {
    return buildStep(event, 'think', 'yellow', 'reasoning', summarizeContent(event.content));
  }
  if (lower.includes('reasoningcompleted')) {
    return buildStep(event, 'think', 'green', 'reasoning', 'completed');
  }
  if (lower.includes('runcompleted')) {
    return buildStep(event, 'done', 'green', 'completed', actor ?? 'run completed');
  }
  if (lower.includes('runerror')) {
    return buildStep(event, 'error', 'red', 'error', summarizeContent(event.content));
  }
  return null;
}

export function mergeRecentSteps(current, next) {
  const merged = [...current];
  for (const step of next) {
    if (merged[merged.length - 1]?.id !== step.id) merged.push(step);
  }
  return merged.slice(-8);
}

/* helpers */

function isContentDeltaEvent(name) {
  const lower = name.toLowerCase();
  return (
    lower === 'teamruncontent' ||
    lower === 'runcontent' ||
    lower.includes('contentdelta') ||
    lower.includes('contentcompleted')
  );
}

function buildStep(event, marker, color, label, detail) {
  const detailStr = typeof detail === 'string' ? detail : JSON.stringify(detail);
  return {
    id: [event.run_id, event.created_at, event.event, label, detailStr].join(':'),
    marker,
    color,
    label,
    detail: truncate(String(detailStr || 'received'), 160)
  };
}

function toolName(event) {
  const tool = event.tool ?? {};
  return (
    tool.tool_name ??
    tool.function?.name ??
    tool.name ??
    tool.tool_call_id ??
    'tool call'
  );
}

function summarizeContent(content) {
  if (typeof content === 'string') return content.trim() || 'received';
  if (!content) return 'received';
  if (typeof content === 'object') {
    return content.title ?? content.name ?? content.status ?? JSON.stringify(content);
  }
  return String(content);
}

function truncate(value, maxLength) {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}
