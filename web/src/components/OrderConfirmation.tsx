import { useEffect, useRef } from 'react';
import type { Order } from '../api/types';
import type { UserMessage } from '../lib/errors';
import { formatCents } from '../lib/money';
import { ErrorAlert } from './ErrorAlert';
import { ProductIllustration } from './ProductIllustration';

const STATUS_LABELS: Record<Order['status'], string> = {
  PENDING: 'Recebido',
  CANCELLED: 'Cancelado',
};

const dateTime = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

interface Props {
  order: Order;
  onCancel: () => void;
  cancelling: boolean;
  error: UserMessage | null;
  onNewOrder: () => void;
}

/** Mostra o pedido exatamente como a API devolveu: itens, total oficial (totalCents) e status. */
export function OrderConfirmation({ order, onCancel, cancelling, error, onNewOrder }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cancelled = order.status === 'CANCELLED';

  useEffect(() => {
    // Leva o foco para o resultado, para teclado e leitor de tela saberem que a tela mudou.
    headingRef.current?.focus();
  }, [order.status]);

  return (
    <section className="confirmation" aria-labelledby="confirmation-title">
      <div className="confirmation-card">
        <h2 id="confirmation-title" className="section-title" tabIndex={-1} ref={headingRef}>
          {cancelled ? 'Pedido cancelado' : `Pedido recebido, ${order.customerName}!`}
        </h2>
        <p className="confirmation-meta">
          <span className={`status status-${order.status.toLowerCase()}`}>
            {STATUS_LABELS[order.status]} <code>{order.status}</code>
          </span>
          <span>
            Pedido <code title={order.id}>#{order.id.slice(0, 8)}</code> · {dateTime.format(new Date(order.createdAt))}
          </span>
        </p>

        <table className="order-table">
          <caption className="visually-hidden">Itens do pedido</caption>
          <thead>
            <tr>
              <th scope="col">Item</th>
              <th scope="col">Qtd.</th>
              <th scope="col">Unitário</th>
              <th scope="col">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.productId}>
                <th scope="row">{item.name}</th>
                <td>{item.quantity}</td>
                <td>{formatCents(item.unitPriceCents)}</td>
                <td>{formatCents(item.subtotalCents)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th scope="row" colSpan={3}>
                Total
              </th>
              <td data-testid="order-total">{formatCents(order.totalCents)}</td>
            </tr>
          </tfoot>
        </table>
        <p className="cart-note">Total calculado pela lanchonete com os preços do cardápio.</p>

        {error && <ErrorAlert message={error} />}

        <div className="confirmation-actions">
          {!cancelled && (
            <button type="button" className="button button-secondary" onClick={onCancel} disabled={cancelling}>
              {cancelling ? 'Cancelando…' : 'Cancelar pedido'}
            </button>
          )}
          <button type="button" className="button button-primary" onClick={onNewOrder}>
            Fazer novo pedido
          </button>
        </div>
      </div>
      <ProductIllustration productId={order.items[0]?.productId ?? ''} category="lanches" className="confirmation-art" decorative />
    </section>
  );
}
