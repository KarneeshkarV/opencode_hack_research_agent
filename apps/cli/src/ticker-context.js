import {readdir, readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve} from 'node:path';
import {promisify} from 'node:util';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const DEFAULT_TICKER_MODEL = 'gpt-5.4-nano';
const MAX_TICKERS = 5;
const execFileAsync = promisify(execFile);

const TICKER_MAP = {
  apple: 'AAPL',
  microsoft: 'MSFT',
  google: 'GOOGL',
  alphabet: 'GOOGL',
  amazon: 'AMZN',
  meta: 'META',
  facebook: 'META',
  tesla: 'TSLA',
  nvidia: 'NVDA',
  amd: 'AMD',
  netflix: 'NFLX',
  salesforce: 'CRM',
  oracle: 'ORCL',
  adobe: 'ADBE',
  broadcom: 'AVGO',
  'jpmorgan chase': 'JPM',
  jpmorgan: 'JPM',
  'goldman sachs': 'GS',
  'bank of america': 'BAC',
  'wells fargo': 'WFC',
  exxon: 'XOM',
  'exxon mobil': 'XOM',
  chevron: 'CVX',
  pfizer: 'PFE',
  'johnson and johnson': 'JNJ',
  'johnson & johnson': 'JNJ',
  unitedhealth: 'UNH',
  costco: 'COST',
  walmart: 'WMT',
  disney: 'DIS',
  nike: 'NKE',
  'coca cola': 'KO',
  'coca-cola': 'KO',
  pepsi: 'PEP',
  mcdonalds: 'MCD',
  "mcdonald's": 'MCD',
  starbucks: 'SBUX',
  reliance: 'RELIANCE.NS',
  'reliance industries': 'RELIANCE.NS',
  tcs: 'TCS.NS',
  'tata consultancy services': 'TCS.NS',
  infosys: 'INFY.NS',
  'hdfc bank': 'HDFCBANK.NS',
  'icici bank': 'ICICIBANK.NS',
  sbi: 'SBIN.NS',
  'state bank of india': 'SBIN.NS',
  'axis bank': 'AXISBANK.NS',
  'kotak bank': 'KOTAKBANK.NS',
  'kotak mahindra bank': 'KOTAKBANK.NS',
  'bajaj finance': 'BAJFINANCE.NS',
  'bajaj finserv': 'BAJAJFINSV.NS',
  'larsen and toubro': 'LT.NS',
  'larsen & toubro': 'LT.NS',
  'l&t': 'LT.NS',
  'hindustan unilever': 'HINDUNILVR.NS',
  hul: 'HINDUNILVR.NS',
  'itc': 'ITC.NS',
  'asian paints': 'ASIANPAINT.NS',
  'maruti suzuki': 'MARUTI.NS',
  'mahindra and mahindra': 'M&M.NS',
  'mahindra & mahindra': 'M&M.NS',
  'tata motors': 'TATAMOTORS.NS',
  'tata steel': 'TATASTEEL.NS',
  'jsw steel': 'JSWSTEEL.NS',
  'hindalco': 'HINDALCO.NS',
  'sun pharma': 'SUNPHARMA.NS',
  'dr reddy': 'DRREDDY.NS',
  "dr reddy's": 'DRREDDY.NS',
  cipla: 'CIPLA.NS',
  'divis labs': 'DIVISLAB.NS',
  'bharti airtel': 'BHARTIARTL.NS',
  airtel: 'BHARTIARTL.NS',
  'adani enterprises': 'ADANIENT.NS',
  'adani ports': 'ADANIPORTS.NS',
  'ntpc': 'NTPC.NS',
  'power grid': 'POWERGRID.NS',
  'ongc': 'ONGC.NS',
  'coal india': 'COALINDIA.NS',
  'oil india': 'OIL.NS',
  'titan': 'TITAN.NS',
  'ultratech cement': 'ULTRACEMCO.NS',
  'grasim': 'GRASIM.NS',
  'nestle india': 'NESTLEIND.NS',
  'britannia': 'BRITANNIA.NS',
  'eicher motors': 'EICHERMOT.NS',
  'hero motocorp': 'HEROMOTOCO.NS',
  'bajaj auto': 'BAJAJ-AUTO.NS',
  'hcl tech': 'HCLTECH.NS',
  'hcl technologies': 'HCLTECH.NS',
  wipro: 'WIPRO.NS',
  techm: 'TECHM.NS',
  'tech mahindra': 'TECHM.NS',
  'ltimindtree': 'LTIM.NS',
  zomato: 'ZOMATO.NS',
  paytm: 'PAYTM.NS',
  's&p': '^GSPC',
  sp500: '^GSPC',
  's&p 500': '^GSPC',
  dow: '^DJI',
  nasdaq: '^IXIC',
  nifty: '^NSEI',
  'nifty 50': '^NSEI',
  sensex: '^BSESN',
  spy: 'SPY',
  qqq: 'QQQ',
  iwm: 'IWM',
  dia: 'DIA',
  vti: 'VTI',
  voo: 'VOO'
};

const ASSET_PATTERNS = [
  [/\b(bitcoin|btc)\b/i, 'BTC-USD'],
  [/\b(ethereum|eth)\b/i, 'ETH-USD'],
  [/\b(gold|gc)\b/i, 'GC=F'],
  [/\b(silver|si)\b/i, 'SI=F'],
  [/\b(crude|oil|cl)\b/i, 'CL=F'],
  [/\b(brent|bz)\b/i, 'BZ=F'],
  [/\b(natural gas|ng)\b/i, 'NG=F'],
  [/\b(eur\s*usd|eurusd|euro\s*dollar)\b/i, 'EURUSD=X'],
  [/\b(gbp\s*usd|gbpusd|pound\s*dollar)\b/i, 'GBPUSD=X'],
  [/\b(usd\s*inr|usdinr|dollar\s*rupee)\b/i, 'USDINR=X']
];

const STOP_WORDS = new Set([
  'AI',
  'API',
  'USD',
  'EUR',
  'GBP',
  'INR',
  'EPS',
  'PE',
  'PEG',
  'ETF',
  'IPO',
  'CEO',
  'CFO',
  'CTO',
  'USA',
  'UK',
  'EU',
  'GDP',
  'FED',
  'RBI',
  'SEC',
  'FX',
  'OK',
  'ATH',
  'TLDR',
  'FAQ',
  'JSON',
  'CLI',
  'LLM',
  'GPT',
  'NANO',
  'REGEX',
  'PROMPT',
  'MODEL',
  'FAST',
  'CHAT',
  'AGENT',
  'AGENTS',
  'MEMORY',
  'TOOL',
  'TOOLS',
  'FROM',
  'WITH',
  'THIS',
  'THAT',
  'WHAT',
  'YOUR',
  'THEIR',
  'AND',
  'THE',
  'FOR'
]);

const COMPARISON_RE =
  /\b(vs|versus|compare|comparison|against|compared\s+(to|with)|better|difference|choose|which|and)\b/i;

export async function prepareResearchMessage(
  query,
  {explicitTicker, repoRoot = REPO_ROOT, env = process.env, fetchImpl = fetch} = {}
) {
  const resolution = await resolveTickersFromPrompt(query, explicitTicker, {
    env,
    fetchImpl
  });
  const primaryTicker = resolution.tickers[0] ?? null;

  if (!primaryTicker) {
    return {
      originalQuery: query,
      message: query,
      ticker: null,
      context: null,
      resolution,
      sector: '',
      memoryPeers: []
    };
  }

  const sectorInfo = await resolveTickerSector(primaryTicker, {
    repoRoot,
    env,
    fetchImpl
  });
  const memoryPeers = sectorInfo.sector
    ? await findSameSectorMemoryPeers(sectorInfo.sector, {
        primaryTicker,
        repoRoot,
        env,
        limit: 5
      })
    : [];

  const context = buildMarketContext({
    primaryTicker,
    resolution,
    sectorInfo,
    memoryPeers
  });

  return {
    originalQuery: query,
    message: buildEnrichedMessage(query, context),
    ticker: primaryTicker,
    context,
    resolution,
    sector: sectorInfo.sector,
    memoryPeers
  };
}

export async function resolveTickersFromPrompt(
  query,
  explicitTicker,
  {env = process.env, fetchImpl = fetch} = {}
) {
  const explicit = cleanTicker(explicitTicker);
  if (explicit) {
    return {
      tickers: [explicit],
      source: 'explicit',
      confidence: 'high'
    };
  }

  const regexTickers = resolveTickersWithRegex(query);
  if (regexTickers.length > 0) {
    return {
      tickers: regexTickers,
      source: 'regex',
      confidence: 'high'
    };
  }

  return resolveTickersWithLlm(query, {env, fetchImpl});
}

export function resolveTickersWithRegex(query) {
  const text = query || '';
  const queryLower = text.toLowerCase();
  const isComparison = COMPARISON_RE.test(text);
  const found = [];
  const occupiedRanges = [];
  const nameMatches = [];

  for (const [name, ticker] of Object.entries(TICKER_MAP).sort(
    ([a], [b]) => b.length - a.length
  )) {
    const pattern = new RegExp(`\\b${escapeRegex(name)}\\b`, 'gi');
    for (const match of queryLower.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (rangeOverlaps(start, end, occupiedRanges)) continue;
      occupiedRanges.push([start, end]);
      nameMatches.push({ticker, index: start});
    }
  }

  for (const match of nameMatches.sort((a, b) => a.index - b.index)) {
    addTicker(found, match.ticker);
    if (!isComparison) break;
  }

  if (found.length === 0 || isComparison) {
    for (const [pattern, ticker] of ASSET_PATTERNS) {
      if (pattern.test(text)) {
        addTicker(found, ticker);
      }
    }
  }

  if (found.length === 0 || isComparison) {
    for (const ticker of extractExplicitTickerTokens(text, occupiedRanges)) {
      addTicker(found, ticker);
      if (!isComparison && found.length > 0) break;
    }
  }

  return found.slice(0, MAX_TICKERS);
}

async function resolveTickersWithLlm(query, {env, fetchImpl}) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey || !query?.trim()) {
    return {
      tickers: [],
      source: 'llm',
      confidence: 'low'
    };
  }

  try {
    const model = env.RESEARCH_AGENT_TICKER_MODEL || DEFAULT_TICKER_MODEL;
    const body = {
      model,
      messages: [
        {
          role: 'system',
          content: [
            'You extract public market ticker symbols from user prompts.',
            'Return only JSON matching the schema.',
            'Use exchange suffixes for non-US stocks, for example RELIANCE.NS or BP.L.',
            'If the prompt is not about a specific public security, return an empty tickers array.'
          ].join(' ')
        },
        {
          role: 'user',
          content: `Extract up to ${MAX_TICKERS} ticker symbols from this prompt:\n${query}`
        }
      ],
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'ticker_resolution',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              tickers: {
                type: 'array',
                maxItems: MAX_TICKERS,
                items: {type: 'string'}
              },
              confidence: {
                type: 'string',
                enum: ['high', 'medium', 'low']
              },
              reasoning: {type: 'string'}
            },
            required: ['tickers', 'confidence', 'reasoning']
          }
        }
      },
      max_completion_tokens: 256
    };

    const response = await fetchJsonWithTimeout(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      },
      fetchImpl,
      5000
    );
    const content = response?.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);
    return {
      tickers: sanitizeTickerList(parsed.tickers),
      source: 'llm',
      confidence: normalizeConfidence(parsed.confidence)
    };
  } catch {
    return {
      tickers: [],
      source: 'llm',
      confidence: 'low'
    };
  }
}

export async function resolveTickerSector(
  ticker,
  {repoRoot = REPO_ROOT, env = process.env, fetchImpl = fetch} = {}
) {
  const latestInfo = await readLatestTickerInfo(ticker, {repoRoot, env});
  if (latestInfo?.sector) {
    return {
      sector: latestInfo.sector,
      industry: latestInfo.industry || '',
      source: 'memory'
    };
  }

  const yahooInfo = await fetchYahooSector(ticker, {fetchImpl, repoRoot, env});
  return {
    sector: yahooInfo.sector || '',
    industry: yahooInfo.industry || '',
    source: yahooInfo.sector ? 'yahoo' : 'unknown'
  };
}

export async function findSameSectorMemoryPeers(
  sector,
  {primaryTicker, repoRoot = REPO_ROOT, env = process.env, limit = 5} = {}
) {
  const memoryDir = companyMemoryDir({repoRoot, env});
  const primarySlug = slugifyTicker(primaryTicker);
  const normalizedSector = normalizeSector(sector);
  if (!normalizedSector) return [];

  let tickerDirs;
  try {
    tickerDirs = await readdir(memoryDir, {withFileTypes: true});
  } catch {
    return [];
  }

  const peers = [];
  for (const entry of tickerDirs) {
    if (!entry.isDirectory() || entry.name === primarySlug) continue;
    const latest = await readLatestRunInfo(entry.name, memoryDir);
    if (!latest || normalizeSector(latest.info.sector) !== normalizedSector) continue;
    peers.push({
      ticker: latest.info.ticker || entry.name,
      runId: latest.runId,
      runDate: latest.info.run_date || latest.runId,
      sector: latest.info.sector || '',
      industry: latest.info.industry || '',
      query: latest.info.query || '',
      synthesisPreview: latest.synthesisPreview
    });
  }

  return peers.sort((a, b) => b.runId.localeCompare(a.runId)).slice(0, limit);
}

export function buildEnrichedMessage(query, context) {
  return [
    'CLI_RESOLVED_MARKET_CONTEXT_JSON:',
    '```json',
    JSON.stringify(context, null, 2),
    '```',
    '',
    'ORIGINAL_USER_REQUEST:',
    query
  ].join('\n');
}

function buildMarketContext({primaryTicker, resolution, sectorInfo, memoryPeers}) {
  const toolCalls = [
    {
      tool: 'list_prior_runs',
      args: {ticker: primaryTicker}
    },
    ...memoryPeers.flatMap(peer => [
      {
        tool: 'list_prior_runs',
        args: {ticker: peer.ticker}
      },
      {
        tool: 'read_prior_run',
        args: {ticker: peer.ticker, run_id: peer.runId}
      }
    ])
  ];

  return {
    primaryTicker,
    resolvedTickers: resolution.tickers,
    tickerResolution: {
      source: resolution.source,
      confidence: resolution.confidence
    },
    sector: sectorInfo.sector || '',
    industry: sectorInfo.industry || '',
    sectorSource: sectorInfo.source,
    sameSectorMemoryPeers: memoryPeers.map(peer => ({
      ticker: peer.ticker,
      latestRunId: peer.runId,
      runDate: peer.runDate,
      sector: peer.sector,
      industry: peer.industry,
      query: peer.query,
      synthesisPreview: peer.synthesisPreview
    })),
    memoryToolInstructions: {
      required: true,
      instructions: [
        'Before delegating, call list_prior_runs for primaryTicker.',
        'For each sameSectorMemoryPeers item, call list_prior_runs for that ticker.',
        'When a relevant latestRunId exists, call read_prior_run for that ticker and run_id.',
        'Add a Memory sector comparison section comparing primaryTicker with same-sector stocks found in memory.',
        'Only cite prior conclusions returned by memory tools. Do not fabricate memory.'
      ],
      suggestedToolCalls: toolCalls
    }
  };
}

async function fetchYahooSector(ticker, {fetchImpl, repoRoot, env}) {
  const clean = cleanTicker(ticker);
  if (!clean) return {};
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    clean
  )}?modules=assetProfile`;

  try {
    const data = await fetchJsonWithTimeout(
      url,
      {
        headers: {
          'User-Agent': 'research-agent-cli/0.1'
        }
      },
      fetchImpl,
      4000
    );
    const profile = data?.quoteSummary?.result?.[0]?.assetProfile;
    return {
      sector: profile?.sector || '',
      industry: profile?.industry || ''
    };
  } catch {
    return fetchYfinanceSector(clean, {repoRoot, env});
  }
}

async function fetchYfinanceSector(ticker, {repoRoot, env}) {
  if (env.RESEARCH_AGENT_DISABLE_PYTHON_YFINANCE === 'true') {
    return {};
  }

  const code = [
    'import json, sys, yfinance as yf',
    'info = yf.Ticker(sys.argv[1]).info or {}',
    'print(json.dumps({"sector": info.get("sector") or "", "industry": info.get("industry") or ""}))'
  ].join('; ');

  try {
    const {stdout} = await execFileAsync('uv', ['run', 'python', '-c', code, ticker], {
      cwd: join(repoRoot, 'apps/api'),
      env: {...process.env, ...env},
      timeout: 8000,
      maxBuffer: 1024 * 1024
    });
    const parsed = JSON.parse(stdout.trim() || '{}');
    return {
      sector: typeof parsed.sector === 'string' ? parsed.sector : '',
      industry: typeof parsed.industry === 'string' ? parsed.industry : ''
    };
  } catch {
    return {};
  }
}

async function fetchJsonWithTimeout(url, init, fetchImpl, timeoutMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, {...init, signal: controller.signal});
    if (!response?.ok) {
      throw new Error(`Request failed: ${response?.status ?? 'unknown'}`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function readLatestTickerInfo(ticker, {repoRoot, env}) {
  const memoryDir = companyMemoryDir({repoRoot, env});
  const latest = await readLatestRunInfo(slugifyTicker(ticker), memoryDir);
  return latest?.info ?? null;
}

async function readLatestRunInfo(tickerSlug, memoryDir) {
  const tickerDir = join(memoryDir, tickerSlug);
  let entries;
  try {
    entries = await readdir(tickerDir, {withFileTypes: true});
  } catch {
    return null;
  }

  const runIds = entries
    .filter(entry => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}-\d{6}$/.test(entry.name))
    .map(entry => entry.name)
    .sort()
    .reverse();
  const runId = runIds[0];
  if (!runId) return null;

  const runDir = join(tickerDir, runId);
  const info = parseInfoMd(await readText(join(runDir, 'info.md')));
  const synthesisPreview = (await readText(join(runDir, 'synthesis.md'))).slice(0, 600);
  return {runId, info, synthesisPreview};
}

function parseInfoMd(text) {
  const info = {};
  let inFrontmatter = false;
  for (const line of (text || '').split(/\r?\n/)) {
    if (line.trim() === '---') {
      if (inFrontmatter) break;
      inFrontmatter = true;
      continue;
    }
    if (!inFrontmatter || !line.includes(':')) continue;
    const [rawKey, ...rest] = line.split(':');
    const key = rawKey.trim();
    const rawValue = rest.join(':').trim();
    info[key] = rawValue.replace(/^"|"$/g, '').replace(/\\"/g, '"');
  }
  return info;
}

async function readText(path) {
  try {
    return await readFile(path, 'utf8');
  } catch {
    return '';
  }
}

function companyMemoryDir({repoRoot, env}) {
  return env.COMPANY_MEMORY_DIR || join(repoRoot, 'apps/api/company');
}

function extractExplicitTickerTokens(text, occupiedRanges = []) {
  const candidates = [];
  const patterns = [
    /\$([A-Z]{1,10}(?:[.\-=][A-Z0-9]{1,4})?)/g,
    /\b(?:NYSE|NASDAQ|NSE|BSE|LSE|TSX|ASX):([A-Z0-9.^=-]{1,12})\b/gi,
    /\b(\^[A-Z0-9]{2,8})\b/g,
    /\b([A-Z]{2,10}(?:\.[A-Z]{1,4}|-[A-Z]{2,4}|=F|=X)?)\b/g
  ];

  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      const start = match.index;
      const end = start + match[0].length;
      if (rangeOverlaps(start, end, occupiedRanges)) continue;
      const cleaned = cleanTicker(match[1]);
      if (isValidTicker(cleaned) && !STOP_WORDS.has(cleaned)) {
        candidates.push({ticker: cleaned, index: start});
      }
    }
  }

  return candidates.sort((a, b) => a.index - b.index).map(candidate => candidate.ticker);
}

function sanitizeTickerList(rawList) {
  const result = [];
  if (!Array.isArray(rawList)) return result;
  for (const item of rawList) {
    addTicker(result, item);
  }
  return result.slice(0, MAX_TICKERS);
}

function addTicker(list, rawTicker) {
  const ticker = cleanTicker(rawTicker);
  if (!isValidTicker(ticker) || STOP_WORDS.has(ticker) || list.includes(ticker)) {
    return;
  }
  list.push(ticker);
}

function cleanTicker(raw) {
  if (typeof raw !== 'string') return '';
  let ticker = raw.trim().toUpperCase();
  ticker = ticker.replace(/^[$"'([]+|[)"'\],.;:!?]+$/g, '');
  if (ticker.includes(':')) {
    ticker = ticker.split(':').at(-1);
  }
  return ticker.trim();
}

function isValidTicker(ticker) {
  if (!ticker || ticker.length > 16) return false;
  if (ticker.length < 2 && !ticker.startsWith('^')) return false;
  return /^[A-Z0-9.&^=-]+(?:-[A-Z0-9]+)?$/.test(ticker);
}

function normalizeConfidence(value) {
  return ['high', 'medium', 'low'].includes(value) ? value : 'low';
}

function normalizeSector(sector) {
  return (sector || '').trim().toLowerCase();
}

function slugifyTicker(ticker) {
  return (ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function rangeOverlaps(start, end, ranges) {
  return ranges.some(([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart);
}
