import { useId, useState, type FormEvent } from 'react';
import { MAX_QUANTITY, MIN_QUANTITY, itemCount, previewTotalCents, type CartAction, type CartState } from '../cart/cart';
import type { UserMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import { ErrorAlert } from './ErrorAlert';

const MAX_NAME_LENGTH = 100;

interface Props {
  cart: CartState;
  dispatch: (action: CartAction) => void;
  onCheckout: (customerName: string) => void;
  submitting: boolean;
  error: UserMessage | null;
}

export function CartPanel({ cart, dispatch, onCheckout, submitting, error }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const bodyId = useId();
  const nameId = useId();
  const nameErrorId = useId();

  const count = itemCount(cart);
  const total = previewTotalCents(cart);
  const empty = cart.length === 0;

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > MAX_NAME_LENGTH) {
      setNameError(`Informe seu nome (até ${MAX_NAME_LENGTH} caracteres).`);
      return;
    }
    setNameError(null);
    onCheckout(trimmed);
  }

  return (
    <aside
      className="cart"
      data-open={open}
      aria-labelledby="cart-title"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      {/* No celular o carrinho é uma barra inferior que expande; no desktop fica sempre aberto ao lado. */}
      <button
        type="button"
        className="cart-toggle"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={() => setOpen((value) => !value)}
        aria-label={`${open ? 'Fechar carrinho' : 'Ver carrinho'}: ${count} ${count === 1 ? 'item' : 'itens'}, total estimado ${formatCents(total)}`}
      >
        <span className="cart-toggle-label">{open ? 'Fechar carrinho' : 'Ver carrinho'}</span>
        <span className="cart-count" key={count}>
          {count}
        </span>
        <span className="cart-toggle-total">{formatCents(total)}</span>
      </button>

      <div id={bodyId} className="cart-body">
        <h2 id="cart-title" className="section-title cart-title">
          Seu pedido
          <span className="cart-count" key={count} aria-hidden="true">
            {count}
          </span>
        </h2>

        {empty ? (
          <p className="cart-empty">Seu carrinho está vazio. Que tal começar por um X-Burger?</p>
        ) : (
          <ul className="cart-lines" aria-label="Itens no carrinho">
            {cart.map((line) => (
              <li key={line.productId} className="cart-line">
                <div className="cart-line-info">
                  <span className="cart-line-name">{line.name}</span>
                  <span className="cart-line-price">{formatCents(line.priceCents * line.quantity)}</span>
                </div>
                <div className="cart-line-actions">
                  <div className="stepper" role="group" aria-label={`Quantidade de ${line.name}`}>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'decrement', productId: line.productId })}
                      disabled={line.quantity <= MIN_QUANTITY}
                      aria-label={`Diminuir quantidade de ${line.name}`}
                    >
                      −
                    </button>
                    <output aria-label={`${line.name}: ${line.quantity}`}>{line.quantity}</output>
                    <button
                      type="button"
                      onClick={() => dispatch({ type: 'increment', productId: line.productId })}
                      disabled={line.quantity >= MAX_QUANTITY}
                      aria-label={`Aumentar quantidade de ${line.name}`}
                    >
                      +
                    </button>
                  </div>
                  <button
                    type="button"
                    className="link-button"
                    onClick={() => dispatch({ type: 'remove', productId: line.productId })}
                    aria-label={`Remover ${line.name} do carrinho`}
                  >
                    Remover
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="cart-total">
          <span>Total estimado</span>
          <strong data-testid="cart-preview-total">{formatCents(total)}</strong>
        </div>
        <p className="cart-note">Prévia com os preços do cardápio. O valor final é calculado pela lanchonete ao confirmar.</p>

        <form className="checkout" onSubmit={handleSubmit} noValidate>
          <label htmlFor={nameId} className="field-label">
            Seu nome
          </label>
          <input
            id={nameId}
            className="field-input"
            name="customerName"
            autoComplete="name"
            maxLength={MAX_NAME_LENGTH}
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={nameError !== null}
            aria-describedby={nameError ? nameErrorId : undefined}
          />
          {nameError && (
            <p id={nameErrorId} className="field-error">
              {nameError}
            </p>
          )}
          {error && <ErrorAlert message={error} />}
          <button type="submit" className="button button-primary button-block" disabled={empty || submitting}>
            {submitting ? 'Enviando pedido…' : 'Confirmar pedido'}
          </button>
        </form>
      </div>
    </aside>
  );
}
