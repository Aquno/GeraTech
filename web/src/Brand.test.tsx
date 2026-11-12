import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { BRAND_NAME } from './lib/brand';
import { mockApi } from './test/fake-api';

async function renderApp() {
  render(<App />);
  await screen.findByRole('heading', { name: 'Lanches' });
}

describe('Marca Chodó Burger', () => {
  it('o nome da marca é Chodó Burger', () => {
    expect(BRAND_NAME).toBe('Chodó Burger');
  });

  it('o cabeçalho mostra o nome em texto e a logo como imagem decorativa', async () => {
    mockApi({});
    await renderApp();

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('heading', { level: 1, name: 'Chodó Burger' })).toBeInTheDocument();
    // A logo não repete o nome para leitores de tela: alt vazio e fora da árvore de acessibilidade.
    expect(within(header).queryByRole('img')).not.toBeInTheDocument();
    const logo = header.querySelector('img.logo-mark');
    expect(logo).toHaveAttribute('alt', '');
    expect(logo).toHaveAttribute('src', expect.stringMatching(/chodo-icone-96[^/]*\.webp$/));
  });

  it('o rodapé assina com a logo completa nas versões para tema claro e escuro', async () => {
    mockApi({});
    await renderApp();

    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByText('Chodó Burger · projeto de demonstração.')).toBeInTheDocument();
    expect(footer.querySelector('img.logo-full-light')).toHaveAttribute('src', expect.stringMatching(/chodo-logo-nome[^/]*\.webp$/));
    expect(footer.querySelector('img.logo-full-dark')).toHaveAttribute('src', expect.stringMatching(/chodo-logo-nome-fundo[^/]*\.webp$/));
    expect(within(footer).queryByRole('img')).not.toBeInTheDocument();
  });

  it('não sobra nenhuma menção à marca anterior na página', async () => {
    mockApi({});
    await renderApp();

    expect(document.body.textContent).not.toMatch(/mostarda lanches/i);
  });
});
