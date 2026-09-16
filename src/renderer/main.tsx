import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';
import './index.css';
import { setupMobileBridge } from '../mobile/bridge';

// Initialize mobile/web bridge if electronAPI is not present
if (!window.electronAPI) {
  setupMobileBridge();
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
