import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';

// Proxy the Agno/FastAPI backend through Vite so the browser never
// hits a different origin (avoids CORS entirely) and SSE streams end-to-end.
export default defineConfig(({mode}) => {
  const apiTarget =
    process.env.RESEARCH_AGENT_API_URL ??
    `http://${process.env.AGENT_OS_HOST ?? 'localhost'}:${process.env.AGENT_OS_PORT ?? 7777}`;

  return {
    plugins: [react()],
    server: {
      host: 'localhost',
      port: Number(process.env.WEB_PORT ?? 5173),
      proxy: {
        '/api': {
          target: apiTarget,
          changeOrigin: true,
          rewrite: path => path.replace(/^\/api/, ''),
          // SSE-friendly: don't buffer
          ws: false,
          configure: proxy => {
            proxy.on('proxyReq', proxyReq => {
              proxyReq.setHeader('Accept', 'text/event-stream');
            });
          }
        }
      }
    },
    define: {
      __API_BASE__: JSON.stringify('/api')
    }
  };
});
