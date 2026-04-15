/// <reference types="vite/client" />
import '@kittl/ui-tokens/styles.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import { ToastProvider } from '@kittl/ui-react';

import { App } from './App';

const rootEl = document.getElementById('root');
if (!rootEl) {
  throw new Error('Missing #root element');
}

createRoot(rootEl).render(
  <StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </StrictMode>,
);
