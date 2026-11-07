import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/nunito';
import './styles/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { applyTheme, initialTheme } from './lib/theme';

// Aplica o tema antes do primeiro render, para não piscar no tema errado.
applyTheme(initialTheme());

const root = document.getElementById('root');
if (!root) {
  throw new Error('Elemento #root não encontrado');
}
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
