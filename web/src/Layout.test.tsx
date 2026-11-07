import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { mockApi } from './test/fake-api';

async function renderApp() {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Lanches' });
  return user;
}

describe('Layout redesenhado', () => {
  it('tem um destaque com título e atalho para o cardápio', async () => {
    mockApi({});
    await renderApp();

    const hero = screen.getByRole('region', { name: 'Seu lanche do jeito que você gosta' });
    expect(within(hero).getByRole('link', { name: 'Ver cardápio' })).toHaveAttribute('href', '#menu-title');
    // A foto do destaque é decorativa (o texto já diz o que importa).
    expect(within(hero).queryByRole('img')).not.toBeInTheDocument();
    expect(hero.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('mostra quantas opções há em cada categoria, sem mudar o nome da seção', async () => {
    mockApi({});
    await renderApp();

    const lanches = screen.getByRole('region', { name: 'Lanches' });
    expect(within(lanches).getByText('2 opções')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Acompanhamentos' })).getByText('1 opção')).toBeInTheDocument();
  });

  it('as fotos da primeira categoria carregam na hora e as demais sob demanda', async () => {
    mockApi({});
    await renderApp();

    expect(screen.getByRole('img', { name: /^Foto de cheeseburgers/ })).toHaveAttribute('loading', 'eager');
    expect(screen.getByRole('img', { name: /^Foto de latas de refrigerante/ })).toHaveAttribute('loading', 'lazy');
  });

  it('o carrinho mostra a miniatura decorativa do item, sem duplicar o nome para leitores de tela', async () => {
    mockApi({});
    const user = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Adicionar Suco ao carrinho' }));

    const line = within(screen.getByRole('list', { name: 'Itens no carrinho' })).getByRole('listitem');
    expect(within(line).queryByRole('img')).not.toBeInTheDocument();
    expect(line.querySelector('img.cart-line-photo')).toHaveAttribute('alt', '');
    expect(line).toHaveTextContent('Suco');
  });

  it('o rodapé informa a origem das fotos', async () => {
    mockApi({});
    await renderApp();

    expect(screen.getByText(/Fotos de bancos de imagens com licença CC0/)).toBeInTheDocument();
  });
});
