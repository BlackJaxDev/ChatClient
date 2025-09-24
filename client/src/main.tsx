import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/global.css';
import { AuthProvider } from './context/AuthContext';

const container = document.getElementById('root') as HTMLElement | null;

function showFatal(message: string, detail?: unknown) {
  const el = container || document.body;
  const safe = document.createElement('div');
  safe.style.padding = '16px';
  safe.style.fontFamily = "system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
  safe.style.color = 'var(--text-primary)';
  safe.style.background = 'var(--bg)';
  safe.innerHTML = `<div style="max-width:820px;margin:24px auto;line-height:1.45">
    <h2 style="margin:0 0 8px">ChatClient failed to start</h2>
    <div style="opacity:.8;margin-bottom:12px">${message}</div>
    <pre style="white-space:pre-wrap;background:rgba(148,163,184,.12);padding:12px;border-radius:8px;overflow:auto">${
      detail instanceof Error ? (detail.stack || detail.message) : typeof detail === 'string' ? detail : ''
    }</pre>
    <div style="opacity:.7;fontSize:.9rem">Check the browser console for details.</div>
  </div>`;
  el.innerHTML = '';
  el.appendChild(safe);
}

// Surface unhandled errors during early boot
window.addEventListener('error', (e) => {
  showFatal(e.message, e.error);
});
window.addEventListener('unhandledrejection', (e) => {
  const reason: any = (e as any).reason;
  showFatal(reason?.message || 'Unhandled promise rejection', reason);
});

try {
  if (!container) {
    throw new Error('Root element #root not found');
  }
  console.log('[ChatClient] Mounting…');
  // Clear any static placeholder content to avoid overlaying the app
  container.innerHTML = '';
  ReactDOM.createRoot(container).render(
    <React.StrictMode>
      <AuthProvider>
        <App />
      </AuthProvider>
    </React.StrictMode>
  );
  queueMicrotask(() => console.log('[ChatClient] Mounted'));
} catch (err) {
  console.error('[ChatClient] Failed to mount', err);
  showFatal('A runtime error prevented the app from mounting.', err);
}
