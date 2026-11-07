// Espelho do contrato em docs/openapi.yaml (só o que a interface usa).

export type ProductCategory = 'lanches' | 'acompanhamentos' | 'bebidas';

export interface Product {
  id: string;
  name: string;
  description: string;
  category: ProductCategory;
  priceCents: number;
}

export type OrderStatus = 'PENDING' | 'CANCELLED';

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  subtotalCents: number;
}

export interface Order {
  id: string;
  customerName: string;
  items: OrderItem[];
  totalCents: number;
  status: OrderStatus;
  createdAt: string;
}

export interface CreateOrderInput {
  customerName: string;
  items: { productId: string; quantity: number }[];
}

export interface FieldError {
  field: string;
  message: string;
}

export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  details?: FieldError[];
}
