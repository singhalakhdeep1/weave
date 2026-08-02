// Cloudflare Worker for weave

export interface Env {
  KV: KVNamespace;
  D1: D1Database;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/api/health') {
      return new Response(JSON.stringify({ status: 'healthy' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (path === '/api/documents') {
      if (request.method === 'GET') {
        const documents = await env.D1.prepare('SELECT * FROM documents').all();
        return new Response(JSON.stringify(documents), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      if (request.method === 'POST') {
        const body = await request.json();
        await env.D1.prepare('INSERT INTO documents (title, content) VALUES (?, ?)')
          .bind(body.title, body.content)
          .run();
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (path === '/api/cache') {
      const cached = await env.KV.get('data');
      return new Response(JSON.stringify({ cached }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }
};
