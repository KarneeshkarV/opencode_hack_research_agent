const BACKEND = 'https://opencode-hack-research-agent.onrender.com';

export async function onRequest({request, params}) {
  const path = Array.isArray(params.path) ? params.path.join('/') : (params.path ?? '');
  const incoming = new URL(request.url);
  const target = new URL(`/${path}${incoming.search}`, BACKEND);

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.set('accept', headers.get('accept') || 'text/event-stream');

  const init = {
    method: request.method,
    headers,
    redirect: 'manual',
  };
  if (!['GET', 'HEAD'].includes(request.method)) {
    init.body = request.body;
    init.duplex = 'half';
  }

  const upstream = await fetch(target.toString(), init);
  const respHeaders = new Headers(upstream.headers);
  respHeaders.delete('content-encoding');
  respHeaders.delete('content-length');
  respHeaders.delete('transfer-encoding');
  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: respHeaders,
  });
}
