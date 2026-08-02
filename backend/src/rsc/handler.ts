// React Server Components handler for weave

import { renderToPipeableStream } from 'react-dom/server';

export async function renderRSC(component: any, props: any) {
  return new Promise((resolve, reject) => {
    let html = '';
    const stream = renderToPipeableStream(component(props), {
      onShellReady() {
        stream.pipe(process.stdout);
      },
      onAllReady() {
        resolve(html);
      },
      onError(error) {
        reject(error);
      }
    });
  });
}

export async function renderRSCToString(component: any, props: any) {
  const { renderToString } = await import('react-dom/server');
  return renderToString(component(props));
}

export function createRSCComponent(name: string, component: any) {
  return {
    name,
    component,
    async render(props: any) {
      return await renderRSCToString(component, props);
    }
  };
}
