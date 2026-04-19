import {mkdtemp, mkdir, writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildEnrichedMessage,
  findSameSectorMemoryPeers,
  prepareResearchMessage,
  resolveTickersFromPrompt,
  resolveTickersWithRegex
} from './ticker-context.js';

test('regex resolves direct ticker symbols', () => {
  assert.deepEqual(resolveTickersWithRegex('Analyze AAPL this week'), ['AAPL']);
});

test('regex resolves international ticker symbols', () => {
  assert.deepEqual(resolveTickersWithRegex('Research RELIANCE.NS'), ['RELIANCE.NS']);
});

test('regex resolves mapped company names in comparison prompts', () => {
  assert.deepEqual(resolveTickersWithRegex('Compare Apple and Microsoft'), [
    'AAPL',
    'MSFT'
  ]);
});

test('regex resolves Indian company names without llm fallback', () => {
  assert.deepEqual(resolveTickersWithRegex('Compare HDFC Bank, Reliance and Tata Motors'), [
    'HDFCBANK.NS',
    'RELIANCE.NS',
    'TATAMOTORS.NS'
  ]);
});

test('regex ignores common uppercase finance and system words', () => {
  assert.deepEqual(resolveTickersWithRegex('AI API EPS JSON CLI'), []);
});

test('regex result skips llm fallback', async () => {
  const result = await resolveTickersFromPrompt('Analyze NVDA', null, {
    env: {OPENAI_API_KEY: 'test-key'},
    fetchImpl: async () => {
      throw new Error('LLM fallback should not run');
    }
  });

  assert.equal(result.source, 'regex');
  assert.deepEqual(result.tickers, ['NVDA']);
});

test('llm fallback parses structured JSON and filters invalid tickers', async () => {
  const result = await resolveTickersFromPrompt('What stock ticker is OpenAI closest to?', null, {
    env: {OPENAI_API_KEY: 'test-key', RESEARCH_AGENT_TICKER_MODEL: 'gpt-5.4-nano'},
    fetchImpl: async (url, init) => {
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      const body = JSON.parse(init.body);
      assert.equal(body.model, 'gpt-5.4-nano');
      assert.equal(body.response_format.type, 'json_schema');
      return jsonResponse({
        choices: [
          {
            message: {
              content: JSON.stringify({
                tickers: ['MSFT', 'not a ticker', 'NVDA'],
                confidence: 'medium',
                reasoning: 'Public AI exposure.'
              })
            }
          }
        ]
      });
    }
  });

  assert.equal(result.source, 'llm');
  assert.equal(result.confidence, 'medium');
  assert.deepEqual(result.tickers, ['MSFT', 'NVDA']);
});

test('memory scan returns same-sector peers and excludes primary ticker', async () => {
  const root = await makeMemoryFixture();
  const peers = await findSameSectorMemoryPeers('Technology', {
    primaryTicker: 'AAPL',
    env: {COMPANY_MEMORY_DIR: root},
    repoRoot: root
  });

  assert.deepEqual(
    peers.map(peer => peer.ticker),
    ['NVDA', 'MSFT']
  );
  assert.equal(peers[0].runId, '2026-04-19-130000');
  assert.equal(peers[0].sector, 'Technology');
  assert.match(peers[0].synthesisPreview, /GPU leader/);
});

test('prepareResearchMessage injects parseable JSON context and original request', async () => {
  const root = await makeMemoryFixture();
  const prepared = await prepareResearchMessage('Compare Apple with memory peers', {
    env: {COMPANY_MEMORY_DIR: root},
    repoRoot: root,
    fetchImpl: async () => {
      throw new Error('sector should come from memory');
    }
  });

  assert.equal(prepared.ticker, 'AAPL');
  assert.equal(prepared.sector, 'Technology');
  assert.match(prepared.message, /CLI_RESOLVED_MARKET_CONTEXT_JSON:/);
  assert.match(prepared.message, /ORIGINAL_USER_REQUEST:\nCompare Apple/);

  const context = parseInjectedJson(prepared.message);
  assert.equal(context.primaryTicker, 'AAPL');
  assert.equal(context.memoryToolInstructions.required, true);
  assert.deepEqual(
    context.sameSectorMemoryPeers.map(peer => peer.ticker),
    ['NVDA', 'MSFT']
  );
  assert.ok(
    context.memoryToolInstructions.suggestedToolCalls.some(
      call => call.tool === 'read_prior_run' && call.args.ticker === 'NVDA'
    )
  );
});

test('buildEnrichedMessage emits JSON block for agent parsing', () => {
  const message = buildEnrichedMessage('Analyze AAPL', {
    primaryTicker: 'AAPL',
    sameSectorMemoryPeers: []
  });
  const context = parseInjectedJson(message);
  assert.equal(context.primaryTicker, 'AAPL');
});

async function makeMemoryFixture() {
  const root = await mkdtemp(join(tmpdir(), 'research-agent-memory-'));
  await writeRun(root, 'AAPL', '2026-04-19-120000', {
    ticker: 'AAPL',
    sector: 'Technology',
    industry: 'Consumer Electronics',
    query: 'prior apple research',
    synthesis: 'Apple synthesis'
  });
  await writeRun(root, 'MSFT', '2026-04-18-120000', {
    ticker: 'MSFT',
    sector: 'Technology',
    industry: 'Software',
    query: 'prior microsoft research',
    synthesis: 'Microsoft synthesis'
  });
  await writeRun(root, 'NVDA', '2026-04-19-130000', {
    ticker: 'NVDA',
    sector: 'Technology',
    industry: 'Semiconductors',
    query: 'prior nvidia research',
    synthesis: 'GPU leader synthesis'
  });
  await writeRun(root, 'JPM', '2026-04-19-140000', {
    ticker: 'JPM',
    sector: 'Financial Services',
    industry: 'Banks',
    query: 'prior jpm research',
    synthesis: 'Bank synthesis'
  });
  return root;
}

async function writeRun(root, ticker, runId, {sector, industry, query, synthesis}) {
  const runDir = join(root, ticker, runId);
  await mkdir(runDir, {recursive: true});
  await writeFile(
    join(runDir, 'info.md'),
    [
      '---',
      `ticker: "${ticker}"`,
      `run_date: "${runId}"`,
      `run_id: "${runId}"`,
      `query: "${query}"`,
      `sector: "${sector}"`,
      `industry: "${industry}"`,
      '---',
      ''
    ].join('\n'),
    'utf8'
  );
  await writeFile(join(runDir, 'synthesis.md'), synthesis, 'utf8');
}

function parseInjectedJson(message) {
  const match = message.match(/```json\n([\s\S]*?)\n```/);
  assert.ok(match, 'expected JSON code block');
  return JSON.parse(match[1]);
}

function jsonResponse(data) {
  return {
    ok: true,
    status: 200,
    async json() {
      return data;
    }
  };
}
