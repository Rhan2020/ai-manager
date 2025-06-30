declare module 'react-dom/client' {
  import * as React from 'react';
  import { ReactDOM } from 'react-dom';
  export function createRoot(container: Element | DocumentFragment, options?: { hydrate?: boolean }): ReactDOM.Root;
}