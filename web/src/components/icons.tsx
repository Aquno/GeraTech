// Ícones simples em SVG inline (traço de 2px, cantos arredondados), decorativos: o texto do botão
// ou o aria-label já diz o que a ação faz.

const base = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2.25,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
  focusable: false,
} as const;

export function PlusIcon() {
  return (
    <svg {...base}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function MinusIcon() {
  return (
    <svg {...base}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function BagIcon() {
  return (
    <svg {...base}>
      <path d="M6 8h12l-1 12H7z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function CheckIcon() {
  return (
    <svg {...base} width={28} height={28}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg {...base} width={16} height={16}>
      <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}
