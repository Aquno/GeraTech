import { useEffect, useReducer, useState } from 'react';
import { cancelOrder, createOrder, fetchProducts } from './api/client';
import type { Order, Product } from './api/types';
import { cartReducer, quantityOf } from './cart/cart';
import { CartPanel } from './components/CartPanel';
import { ErrorAlert } from './components/ErrorAlert';
import { Logo } from './components/Logo';
import { Menu } from './components/Menu';
import { OrderConfirmation } from './components/OrderConfirmation';
import { ProductPhoto } from './components/ProductPhoto';
import { describeError, type UserMessage } from './lib/errors';
import { applyTheme, initialTheme, saveTheme, type Theme } from './lib/theme';

type MenuState = { status: 'loading' } | { status: 'error'; message: UserMessage } | { status: 'ready'; products: Product[] };

export function App() {
  const [menu, setMenu] = useState<MenuState>({ status: 'loading' });
  const [cart, dispatch] = useReducer(cartReducer, []);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState<UserMessage | null>(null);
  const [order, setOrder] = useState<Order | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<UserMessage | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [theme, setTheme] = useState<Theme>(initialTheme);

  useEffect(() => applyTheme(theme), [theme]);

  // Trocar a chave dispara uma nova busca do cardápio ("Tentar de novo").
  const [menuRequest, setMenuRequest] = useState(0);

  useEffect(() => {
    let current = true;
    fetchProducts().then(
      (products) => {
        if (current) setMenu({ status: 'ready', products });
      },
      (error: unknown) => {
        if (current) setMenu({ status: 'error', message: describeError(error, 'load-menu') });
      },
    );
    // Descarta respostas de uma busca antiga (desmontagem ou nova tentativa).
    return () => {
      current = false;
    };
  }, [menuRequest]);

  function retryMenu() {
    setMenu({ status: 'loading' });
    setMenuRequest((n) => n + 1);
  }

  function handleAdd(product: Product) {
    dispatch({ type: 'add', product });
    setCheckoutError(null);
    setAnnouncement(`${product.name} adicionado ao carrinho.`);
  }

  async function handleCheckout(customerName: string) {
    const items = cart.map((line) => ({ productId: line.productId, quantity: line.quantity }));
    setSubmitting(true);
    setCheckoutError(null);
    try {
      const created = await createOrder({ customerName, items });
      setOrder(created);
      setCancelError(null);
      dispatch({ type: 'clear' });
    } catch (error) {
      setCheckoutError(
        describeError(
          error,
          'create-order',
          cart.map((line) => line.name),
        ),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCancel() {
    if (!order) return;
    setCancelling(true);
    setCancelError(null);
    try {
      setOrder(await cancelOrder(order.id));
    } catch (error) {
      setCancelError(describeError(error, 'cancel-order'));
    } finally {
      setCancelling(false);
    }
  }

  function handleNewOrder() {
    setOrder(null);
    setCancelError(null);
  }

  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <div className="site-header-inner">
          <div className="brand">
            <Logo />
            <h1 className="brand-name">Mostarda Lanches</h1>
          </div>
          <button
            type="button"
            className="theme-toggle"
            onClick={() => {
              const next = theme === 'dark' ? 'light' : 'dark';
              setTheme(next);
              saveTheme(next);
            }}
            aria-label={theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'}
          >
            <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
          </button>
        </div>
      </header>

      <p className="visually-hidden" aria-live="polite">
        {announcement}
      </p>

      <main id="conteudo" className={order ? 'page page-confirmation' : 'page'}>
        {order ? (
          <OrderConfirmation
            order={order}
            onCancel={() => void handleCancel()}
            cancelling={cancelling}
            error={cancelError}
            onNewOrder={handleNewOrder}
          />
        ) : (
          <>
            <div className="menu-column">
              <section className="hero" aria-labelledby="hero-title">
                <div className="hero-text">
                  <p className="hero-eyebrow">Lanchonete de bairro, feita na hora</p>
                  <h2 id="hero-title" className="hero-title">
                    Seu lanche do jeito que você gosta
                  </h2>
                  <p className="hero-lead">
                    Escolha no cardápio, ajuste as quantidades e confirme. O valor final é calculado pela lanchonete na hora do
                    pedido.
                  </p>
                  <a href="#menu-title" className="button button-primary hero-cta">
                    Ver cardápio
                  </a>
                </div>
                {/* Composição decorativa (lanche, batata e suco): só aparece a partir de 560px. */}
                <div className="hero-media">
                  <ProductPhoto
                    productId="x-salada"
                    category="lanches"
                    className="hero-photo hero-photo-main"
                    sizes="(min-width: 960px) 340px, 60vw"
                    decorative
                    eager
                  />
                  <ProductPhoto
                    productId="batata-frita"
                    category="acompanhamentos"
                    className="hero-photo hero-photo-side"
                    sizes="180px"
                    decorative
                    eager
                  />
                  <ProductPhoto
                    productId="suco"
                    category="bebidas"
                    className="hero-photo hero-photo-corner"
                    sizes="160px"
                    decorative
                    eager
                  />
                </div>
              </section>
              {menu.status === 'loading' && (
                <p className="loading" role="status">
                  Carregando o cardápio…
                </p>
              )}
              {menu.status === 'error' && (
                <ErrorAlert message={menu.message} action={{ label: 'Tentar de novo', onClick: retryMenu }} />
              )}
              {menu.status === 'ready' && (
                <Menu products={menu.products} quantityOf={(id) => quantityOf(cart, id)} onAdd={handleAdd} />
              )}
            </div>
            <CartPanel
              cart={cart}
              dispatch={dispatch}
              onCheckout={(name) => void handleCheckout(name)}
              submitting={submitting}
              error={checkoutError}
            />
          </>
        )}
      </main>
      <footer className="site-footer">
        <p>Mostarda Lanches é uma lanchonete fictícia de demonstração.</p>
        <p>Fotos de bancos de imagens com licença CC0 (créditos em web/src/assets/products/CREDITS.md).</p>
      </footer>
    </>
  );
}
