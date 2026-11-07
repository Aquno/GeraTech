import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client';
import { describeError } from './errors';

const NAMES = ['X-Burger', 'Suco'];

function apiError(status: number | null, details?: { field: string; message: string }[]) {
  return new ApiError(
    status,
    status === null ? null : { statusCode: status, error: 'x', message: 'x', ...(details ? { details } : {}) },
  );
}

describe('describeError', () => {
  it('422: nomeia o produto que saiu do cardápio pela posição do item', () => {
    const error = apiError(422, [{ field: 'items[1].productId', message: 'product "suco" does not exist' }]);

    expect(describeError(error, 'create-order', NAMES)).toEqual({
      title: 'Alguns itens não estão mais disponíveis.',
      details: ['Suco não está mais no cardápio.'],
    });
  });

  it('400: traduz nome, quantidade e item duplicado', () => {
    const error = apiError(400, [
      { field: 'customerName', message: 'must have between 1 and 100 characters' },
      { field: 'items[0].quantity', message: 'must be <= 20' },
      { field: 'items[1].productId', message: 'product "suco" is duplicated in the order' },
      { field: 'items[9].productId', message: 'algo' },
      { field: 'body', message: 'must be object' },
    ]);

    expect(describeError(error, 'create-order', NAMES)).toEqual({
      title: 'Confira os dados do pedido.',
      details: [
        'Informe seu nome (até 100 caracteres).',
        'X-Burger: a quantidade deve ser de 1 a 20.',
        'Suco aparece mais de uma vez no pedido.',
        'Há um dado inválido no pedido.',
        'Há um dado inválido no pedido.',
      ],
    });
  });

  it('409 ao cancelar: pedido já cancelado', () => {
    expect(describeError(apiError(409), 'cancel-order').title).toBe('Este pedido já estava cancelado.');
  });

  it('404 ao cancelar: pedido não encontrado', () => {
    expect(describeError(apiError(404), 'cancel-order').title).toBe('Não encontramos este pedido.');
  });

  it.each([null, 502, 503, 504])('servidor fora do ar (%s): pede para tentar de novo', (status) => {
    expect(describeError(apiError(status), 'load-menu')).toEqual({
      title: 'Não conseguimos falar com a lanchonete agora. Verifique sua conexão e tente novamente em instantes.',
      details: [],
    });
  });

  it('500: erro do servidor, sem detalhes técnicos', () => {
    expect(describeError(apiError(500), 'create-order')).toEqual({
      title: 'Algo deu errado do nosso lado. Tente novamente em instantes.',
      details: [],
    });
  });

  it('status inesperado mostra o código', () => {
    expect(describeError(apiError(418), 'create-order').title).toBe('Não foi possível concluir a operação (erro 418).');
  });

  it('erro que não veio da API vira mensagem genérica', () => {
    expect(describeError(new TypeError('boom'), 'create-order')).toEqual({
      title: 'Algo inesperado aconteceu. Tente novamente.',
      details: [],
    });
  });
});
