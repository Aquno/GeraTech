export interface FieldError {
  readonly field: string;
  readonly message: string;
}

export abstract class DomainError extends Error {
  constructor(
    message: string,
    readonly details?: readonly FieldError[],
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** Pedido viola uma regra de formação (itens, quantidade, nome, duplicidade). */
export class InvalidOrderError extends DomainError {
  constructor(details: readonly FieldError[]) {
    super('Invalid order', details);
  }
}

export class OrderNotFoundError extends DomainError {
  constructor(readonly orderId: string) {
    super('Order not found');
  }
}

export class OrderAlreadyCancelledError extends DomainError {
  constructor(readonly orderId: string) {
    super('Order is already cancelled');
  }
}

/** Um ou mais productId não existem no cardápio. */
export class UnknownProductError extends DomainError {
  constructor(details: readonly FieldError[]) {
    super('Unknown product in menu', details);
  }
}
