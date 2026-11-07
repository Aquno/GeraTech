import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { json, mockApi, order, sentBody } from './test/fake-api';

async function renderApp() {
  const user = userEvent.setup();
  render(<App />);
  await screen.findByRole('heading', { name: 'Lanches' });
  return user;
}

const cartList = () => screen.getByRole('list', { name: 'Itens no carrinho' });

describe('Cardápio', () => {
  it('agrupa os produtos por categoria, com descrição, preço em reais e foto', async () => {
    mockApi({});
    await renderApp();

    const categories = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent);
    expect(categories).toEqual(['Lanches', 'Acompanhamentos', 'Bebidas']);

    const lanches = screen.getByRole('region', { name: 'Lanches' });
    expect(within(lanches).getAllByRole('heading', { level: 4 }).map((h) => h.textContent)).toEqual(['X-Burger', 'X-Salada']);
    expect(within(lanches).getByText('Hambúrguer com queijo.')).toBeInTheDocument();
    expect(within(lanches).getByText('R$ 18,00')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Foto de batatas fritas douradas com sal grosso' })).toBeInTheDocument();
    // Uma foto com texto alternativo por produto (a foto do destaque é decorativa e não conta).
    expect(screen.getAllByRole('img', { name: /^Foto de/ })).toHaveLength(5);
  });

  it('mostra erro claro com o servidor fora do ar e se recupera ao tentar de novo', async () => {
    let calls = 0;
    mockApi({
      'GET /api/products': () => {
        calls += 1;
        if (calls === 1) throw new TypeError('Failed to fetch');
        return json(200, [{ id: 'suco', name: 'Suco', description: 'Natural.', category: 'bebidas', priceCents: 800 }]);
      },
    });
    const user = userEvent.setup();
    render(<App />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Não conseguimos falar com a lanchonete agora.');

    await user.click(within(alert).getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByRole('heading', { name: 'Bebidas' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(calls).toBe(2);
  });
});

describe('Fluxo do pedido', () => {
  it('monta o carrinho, confirma, mostra o pedido da API (total oficial) e cancela', async () => {
    // O servidor devolve um total diferente da prévia: a tela deve mostrar o valor do servidor.
    const fetchMock = mockApi({ 'POST /api/orders': () => json(201, order({ totalCents: 4500 })) });
    const user = await renderApp();

    await user.click(screen.getByRole('button', { name: 'Adicionar X-Burger ao carrinho' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar X-Burger ao carrinho' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar Suco ao carrinho' }));

    expect(within(cartList()).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByTestId('cart-preview-total')).toHaveTextContent('R$ 44,00');
    expect(screen.getByText('2 no carrinho')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Seu nome'), '  Maria ');
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    const heading = await screen.findByRole('heading', { name: 'Pedido recebido, Maria!' });
    expect(heading).toHaveFocus();
    expect(sentBody(fetchMock, 'POST', '/api/orders')).toEqual({
      customerName: 'Maria',
      items: [
        { productId: 'x-burger', quantity: 2 },
        { productId: 'suco', quantity: 1 },
      ],
    });
    expect(screen.getByTestId('order-total')).toHaveTextContent('R$ 45,00');
    expect(screen.getByText('PENDING')).toBeInTheDocument();
    const rows = within(screen.getByRole('table')).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('X-Burger2R$ 18,00R$ 36,00');

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    expect(await screen.findByRole('heading', { name: 'Pedido cancelado' })).toHaveFocus();
    expect(screen.getByText('CANCELLED')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Fazer novo pedido' }));
    expect(await screen.findByText('Seu carrinho está vazio. Que tal começar por um X-Burger?')).toBeInTheDocument();
  });

  it('422: explica qual item saiu do cardápio e mantém o carrinho', async () => {
    mockApi({
      'POST /api/orders': () =>
        json(422, {
          statusCode: 422,
          error: 'Unprocessable Entity',
          message: 'Unknown product in menu',
          details: [{ field: 'items[1].productId', message: 'product "suco" does not exist' }],
        }),
    });
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Adicionar X-Burger ao carrinho' }));
    await user.click(screen.getByRole('button', { name: 'Adicionar Suco ao carrinho' }));
    await user.type(screen.getByLabelText('Seu nome'), 'Ana');

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Alguns itens não estão mais disponíveis.');
    expect(within(alert).getByRole('listitem')).toHaveTextContent('Suco não está mais no cardápio.');
    expect(screen.queryByRole('heading', { name: /Pedido recebido/ })).not.toBeInTheDocument();
    expect(within(cartList()).getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeEnabled();
  });

  it('servidor fora do ar ao confirmar (502 do nginx) mostra mensagem, sem quebrar a tela', async () => {
    mockApi({ 'POST /api/orders': () => new Response('<html>502 Bad Gateway</html>', { status: 502 }) });
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Adicionar Suco ao carrinho' }));
    await user.type(screen.getByLabelText('Seu nome'), 'Ana');

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não conseguimos falar com a lanchonete agora.');
    expect(screen.getByRole('heading', { name: 'Cardápio' })).toBeInTheDocument();
  });

  it('400 da API: traduz o detalhe do campo', async () => {
    mockApi({
      'POST /api/orders': () =>
        json(400, {
          statusCode: 400,
          error: 'Bad Request',
          message: 'Invalid order',
          details: [{ field: 'items[0].productId', message: 'product "suco" is duplicated in the order' }],
        }),
    });
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Adicionar Suco ao carrinho' }));
    await user.type(screen.getByLabelText('Seu nome'), 'Ana');

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Confira os dados do pedido.');
    expect(alert).toHaveTextContent('Suco aparece mais de uma vez no pedido.');
  });

  it('409 ao cancelar: avisa que o pedido já estava cancelado', async () => {
    mockApi({
      'POST /api/orders/:id/cancel': () =>
        json(409, { statusCode: 409, error: 'Conflict', message: 'Order is already cancelled' }),
    });
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Adicionar Suco ao carrinho' }));
    await user.type(screen.getByLabelText('Seu nome'), 'Maria');
    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));
    await screen.findByRole('heading', { name: 'Pedido recebido, Maria!' });

    await user.click(screen.getByRole('button', { name: 'Cancelar pedido' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Este pedido já estava cancelado.');
  });

  it('não envia o pedido sem nome e aponta o campo', async () => {
    const fetchMock = mockApi({});
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Adicionar Suco ao carrinho' }));
    await user.type(screen.getByLabelText('Seu nome'), '   ');

    await user.click(screen.getByRole('button', { name: 'Confirmar pedido' }));

    const input = screen.getByLabelText('Seu nome');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Informe seu nome (até 100 caracteres).');
    expect(sentBody(fetchMock, 'POST', '/api/orders')).toBeUndefined();
  });

  it('não permite confirmar com o carrinho vazio', async () => {
    mockApi({});
    await renderApp();

    expect(screen.getByRole('button', { name: 'Confirmar pedido' })).toBeDisabled();
  });
});

describe('Carrinho na tela', () => {
  it('respeita o limite de 1 a 20 e permite remover', async () => {
    mockApi({});
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Adicionar X-Burger ao carrinho' }));

    const minus = screen.getByRole('button', { name: 'Diminuir quantidade de X-Burger' });
    const plus = screen.getByRole('button', { name: 'Aumentar quantidade de X-Burger' });
    expect(minus).toBeDisabled();

    for (let i = 0; i < 19; i += 1) await user.click(plus);

    expect(screen.getByLabelText('X-Burger: 20')).toHaveTextContent('20');
    expect(plus).toBeDisabled();
    expect(minus).toBeEnabled();
    expect(screen.getByRole('button', { name: 'X-Burger: limite de 20 unidades' })).toBeDisabled();
    expect(screen.getByTestId('cart-preview-total')).toHaveTextContent('R$ 360,00');

    await user.click(minus);
    expect(screen.getByLabelText('X-Burger: 19')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Remover X-Burger do carrinho' }));
    expect(screen.getByText('Seu carrinho está vazio. Que tal começar por um X-Burger?')).toBeInTheDocument();
    expect(screen.getByTestId('cart-preview-total')).toHaveTextContent('R$ 0,00');
  });

  it('funciona pelo teclado e anuncia o item adicionado', async () => {
    mockApi({});
    const user = await renderApp();

    await user.tab();
    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveFocus();

    screen.getByRole('button', { name: 'Adicionar Batata Frita ao carrinho' }).focus();
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(screen.getByLabelText('Batata Frita: 2')).toBeInTheDocument();
    expect(screen.getByText('Batata Frita adicionado ao carrinho.')).toBeInTheDocument();
  });

  it('no celular, o botão do carrinho expande e fecha (inclusive com Esc)', async () => {
    mockApi({});
    const user = await renderApp();
    await user.click(screen.getByRole('button', { name: 'Adicionar Suco ao carrinho' }));

    const toggle = screen.getByRole('button', { name: /Ver carrinho/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName(/^Ver carrinho: 1 item, total estimado R\$\s8,00$/);

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveTextContent('Fechar carrinho');

    await user.keyboard('{Escape}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });
});

describe('Tema', () => {
  it('segue o sistema sem salvar e salva só a escolha explícita', async () => {
    mockApi({});
    const user = await renderApp();
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(localStorage.getItem('mostarda-theme')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Usar tema escuro' }));

    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('mostarda-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument();
  });

  it('usa o tema salvo anteriormente', async () => {
    localStorage.setItem('mostarda-theme', 'dark');
    mockApi({});
    await renderApp();

    expect(document.documentElement.dataset.theme).toBe('dark');
  });
});
