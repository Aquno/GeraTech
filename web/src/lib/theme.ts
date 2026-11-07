export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'mostarda-theme';

/** Tema escolhido pelo usuário; sem escolha salva, segue o sistema (prefers-color-scheme). */
export function initialTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {
    // Armazenamento bloqueado (ex.: modo privado): segue o sistema.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

/** Só a escolha explícita é salva; assim, quem nunca escolheu continua acompanhando o sistema. */
export function saveTheme(theme: Theme): void {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Sem persistência: o tema vale só para esta visita.
  }
}
