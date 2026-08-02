// Vercel Edge handler for weave

export const config = {
  runtime: 'edge'
};

export default async function handler(request: Request) {
  const url = new URL(request.url);
  const path = url.pathname;

  if (path === '/api/health') {
    return new Response(JSON.stringify({ status: 'healthy' }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (path === '/api/documents') {
    if (request.method === 'GET') {
      return new Response(JSON.stringify({ documents: [] }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (request.method === 'POST') {
      const body = await request.json();
      return new Response(JSON.stringify({ id: '123', ...body }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  return new Response('Not Found', { status: 404 });
}
