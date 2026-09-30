import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

if (new URLSearchParams(window.location.search).get('app') === 'android') {
  document.documentElement.classList.add('csrs-android');
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);