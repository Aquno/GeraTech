import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PHOTO_HEIGHT, PHOTO_WIDTH, ProductPhoto, hasPhoto } from './ProductPhoto';

describe('ProductPhoto', () => {
  it('renderiza a foto com texto alternativo, srcset 480w/800w, dimensões e carregamento preguiçoso', () => {
    render(<ProductPhoto productId="x-burger" category="lanches" className="foto" sizes="50vw" />);

    const img = screen.getByRole('img', { name: 'Foto de cheeseburgers com queijo derretido no pão brioche' });
    expect(img.tagName).toBe('IMG');
    expect(img).toHaveAttribute('srcset', expect.stringMatching(/x-burger-480[^ ]*\.webp 480w, .*x-burger-800[^ ]*\.webp 800w$/));
    expect(img).toHaveAttribute('src', expect.stringMatching(/x-burger-800[^ ]*\.webp$/));
    expect(img).toHaveAttribute('sizes', '50vw');
    expect(img).toHaveAttribute('width', String(PHOTO_WIDTH));
    expect(img).toHaveAttribute('height', String(PHOTO_HEIGHT));
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(img).toHaveAttribute('decoding', 'async');
    expect(img).toHaveClass('foto');
  });

  it('carrega na hora quando eager', () => {
    render(<ProductPhoto productId="suco" category="bebidas" eager />);

    expect(screen.getByRole('img', { name: 'Foto de copo de suco natural com laranjas cortadas' })).toHaveAttribute('loading', 'eager');
  });

  it('decorativa: alt vazio, fora da árvore de acessibilidade', () => {
    const { container } = render(<ProductPhoto productId="refrigerante" category="bebidas" decorative />);

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it.each([
    ['lanches', 'Ilustração de um lanche'],
    ['acompanhamentos', 'Ilustração de um acompanhamento'],
    ['bebidas', 'Ilustração de uma bebida'],
  ] as const)('produto sem foto (%s) cai na ilustração da categoria', (category, label) => {
    const { container } = render(<ProductPhoto productId="produto-novo" category={category} />);

    expect(screen.getByRole('img', { name: label })).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('hasPhoto só reconhece os produtos com foto', () => {
    expect(['x-burger', 'x-salada', 'batata-frita', 'refrigerante', 'suco'].every(hasPhoto)).toBe(true);
    expect(hasPhoto('produto-novo')).toBe(false);
  });
});
