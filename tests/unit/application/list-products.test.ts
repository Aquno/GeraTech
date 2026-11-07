import { describe, expect, it } from 'vitest';
import { ListProducts } from '../../../src/application/list-products';
import { compareMenuItems, type MenuItem } from '../../../src/domain/product';
import {
  InMemoryMenuRepository,
  MENU_BATATA,
  MENU_REFRIGERANTE,
  MENU_SUCO,
  MENU_X_BURGER,
  MENU_X_SALADA,
} from '../support/menu';

describe('ListProducts', () => {
  it('ordena por categoria (lanches, acompanhamentos, bebidas) e depois por nome', async () => {
    const repository = new InMemoryMenuRepository([MENU_SUCO, MENU_X_SALADA, MENU_BATATA, MENU_REFRIGERANTE, MENU_X_BURGER]);

    const menu = await new ListProducts(repository).execute();

    expect(menu.map((item) => [item.category, item.name])).toEqual([
      ['lanches', 'X-Burger'],
      ['lanches', 'X-Salada'],
      ['acompanhamentos', 'Batata Frita'],
      ['bebidas', 'Refrigerante'],
      ['bebidas', 'Suco'],
    ]);
    expect(repository.listMenuCalls).toBe(1);
  });

  it('devolve os campos do cardápio sem alterá-los', async () => {
    const menu = await new ListProducts(new InMemoryMenuRepository([MENU_BATATA])).execute();

    expect(menu).toEqual([
      { id: 'batata-frita', name: 'Batata Frita', priceCents: 1000, category: 'acompanhamentos', description: 'Crocante.' },
    ]);
  });

  it('não reordena a lista do repositório no lugar (devolve uma cópia ordenada)', async () => {
    const source = [MENU_SUCO, MENU_X_BURGER];
    const repository = new InMemoryMenuRepository(source);

    const menu = await new ListProducts(repository).execute();

    expect(menu.map((item) => item.id)).toEqual(['x-burger', 'suco']);
    expect(source.map((item) => item.id)).toEqual(['suco', 'x-burger']);
  });

  it('retorna lista vazia quando o cardápio está vazio', async () => {
    expect(await new ListProducts(new InMemoryMenuRepository([])).execute()).toEqual([]);
  });
});

describe('compareMenuItems', () => {
  const item = (name: string, category: MenuItem['category']): MenuItem => ({
    id: name.toLowerCase(),
    name,
    category,
    priceCents: 100,
    description: '',
  });

  it('considera acentos na ordem alfabética do português', () => {
    const names = [item('Água', 'bebidas'), item('Suco', 'bebidas'), item('Açaí', 'bebidas')]
      .sort(compareMenuItems)
      .map((i) => i.name);

    expect(names).toEqual(['Açaí', 'Água', 'Suco']);
  });

  it('categoria vem antes do nome', () => {
    expect(compareMenuItems(item('Zebra', 'lanches'), item('Abacate', 'bebidas'))).toBeLessThan(0);
    expect(compareMenuItems(item('Abacate', 'bebidas'), item('Zebra', 'lanches'))).toBeGreaterThan(0);
    expect(compareMenuItems(item('Mesmo', 'bebidas'), item('Mesmo', 'bebidas'))).toBe(0);
  });
});
