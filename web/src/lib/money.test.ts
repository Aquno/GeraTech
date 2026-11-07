import { describe, expect, it } from 'vitest';
import { formatCents } from './money';

// Intl usa espaço não separável (U+00A0) entre "R$" e o valor.
const NBSP = ' ';

describe('formatCents', () => {
  it.each([
    [1800, `R$${NBSP}18,00`],
    [600, `R$${NBSP}6,00`],
    [5, `R$${NBSP}0,05`],
    [0, `R$${NBSP}0,00`],
    [123456, `R$${NBSP}1.234,56`],
    [11800, `R$${NBSP}118,00`],
  ])('%i centavos → %s', (cents, expected) => {
    expect(formatCents(cents)).toBe(expected);
  });
});
