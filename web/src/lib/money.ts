const brl = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

/** 1800 → "R$ 18,00". Os valores trafegam sempre em centavos inteiros; só a exibição vira reais. */
export function formatCents(cents: number): string {
  return brl.format(cents / 100);
}
