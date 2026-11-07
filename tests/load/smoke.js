// Smoke test de carga da Orders API (k6). Plano e resultados em docs/desempenho.md.
// Rodar: docker compose --profile load run --rm k6
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const RESULTS_DIR = __ENV.RESULTS_DIR || 'results';

// Mesmo cardápio do seed (src/infra/db/menu-seed.ts), em centavos.
const MENU = {
  'x-burger': 1800,
  'x-salada': 2000,
  'batata-frita': 1000,
  refrigerante: 600,
  suco: 800,
};
const PRODUCT_IDS = Object.keys(MENU);

export const options = {
  scenarios: {
    smoke: {
      executor: 'constant-vus',
      vus: 5,
      duration: '1m',
    },
  },
  thresholds: {
    // SLO de POST /orders: p95 < 300 ms.
    'http_req_duration{endpoint:create_order}': ['p(95)<300'],
    'http_req_failed': ['rate<0.01'],
    'checks': ['rate>0.99'],
    // Sem critério de aprovação: só fazem o resumo trazer os números separados por endpoint.
    'http_req_duration{endpoint:get_order}': ['max>=0'],
    'http_reqs{endpoint:create_order}': ['count>=0'],
    'http_reqs{endpoint:get_order}': ['count>=0'],
  },
  summaryTrendStats: ['avg', 'min', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
};

/** 1 a 3 produtos distintos do cardápio, com quantidade de 1 a 5 cada. */
function randomItems() {
  const shuffled = PRODUCT_IDS.slice().sort(() => Math.random() - 0.5);
  const count = 1 + Math.floor(Math.random() * 3);
  return shuffled.slice(0, count).map((productId) => ({ productId, quantity: 1 + Math.floor(Math.random() * 5) }));
}

function parseJson(response) {
  try {
    return response.json();
  } catch {
    return null;
  }
}

export default function () {
  const items = randomItems();
  const expectedTotal = items.reduce((total, item) => total + MENU[item.productId] * item.quantity, 0);

  const created = http.post(`${BASE_URL}/orders`, JSON.stringify({ customerName: 'k6 smoke', items }), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'create_order', name: 'POST /orders' },
  });
  const order = parseJson(created);
  check(created, {
    'POST /orders: status 201': (r) => r.status === 201,
    'POST /orders: totalCents correto': () => order !== null && order.totalCents === expectedTotal,
  });

  if (order && order.id) {
    // name fixo agrupa as URLs com ids diferentes numa única série nas métricas do k6.
    const fetched = http.get(`${BASE_URL}/orders/${order.id}`, {
      tags: { endpoint: 'get_order', name: 'GET /orders/:id' },
    });
    const body = parseJson(fetched);
    check(fetched, {
      'GET /orders/:id: status 200': (r) => r.status === 200,
      'GET /orders/:id: mesmo id': () => body !== null && body.id === order.id,
    });
  }

  sleep(1);
}

function metricLine(data, key, label) {
  const metric = data.metrics[key];
  if (!metric) return `  ${label}: (sem dados)`;
  const v = metric.values;
  const fmt = (n) => (n === undefined ? '-' : n.toFixed(2));
  if (metric.type === 'trend') {
    return `  ${label}: avg=${fmt(v.avg)}ms med=${fmt(v.med)}ms p90=${fmt(v['p(90)'])}ms p95=${fmt(v['p(95)'])}ms p99=${fmt(v['p(99)'])}ms max=${fmt(v.max)}ms`;
  }
  if (metric.type === 'counter') return `  ${label}: ${v.count} (${fmt(v.rate)}/s)`;
  // Rate: "passes" conta os valores verdadeiros (em http_req_failed, as requisições que falharam).
  const total = (v.passes ?? 0) + (v.fails ?? 0);
  return `  ${label}: ${(v.rate * 100).toFixed(2)}% (${v.passes ?? 0} de ${total})`;
}

export function handleSummary(data) {
  const thresholds = Object.entries(data.metrics)
    .filter(([, metric]) => metric.thresholds)
    .flatMap(([name, metric]) =>
      Object.entries(metric.thresholds).map(([expr, result]) => `  ${result.ok ? 'OK   ' : 'FALHA'} ${name}: ${expr}`),
    );

  // Um arquivo por execução (nunca sobrescreve): preserva o histórico e evita gravar por cima de um
  // arquivo criado por outro usuário. Se a gravação falhar, o k6 só registra um erro e não muda o
  // código de saída, então confira se o arquivo indicado abaixo existe.
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const summaryFile = `${RESULTS_DIR}/smoke-summary-${stamp}.json`;

  const text = [
    '',
    '=== Resumo do smoke test ===',
    `  resumo JSON: ${summaryFile}`,
    metricLine(data, 'http_reqs', 'requisições'),
    metricLine(data, 'http_reqs{endpoint:create_order}', 'POST /orders'),
    metricLine(data, 'http_reqs{endpoint:get_order}', 'GET /orders/:id'),
    metricLine(data, 'http_req_duration{endpoint:create_order}', 'latência POST /orders'),
    metricLine(data, 'http_req_duration{endpoint:get_order}', 'latência GET /orders/:id'),
    metricLine(data, 'http_req_failed', 'requisições com falha'),
    metricLine(data, 'checks', 'checks'),
    'Thresholds:',
    ...thresholds,
    '',
  ].join('\n');

  return {
    stdout: text,
    [summaryFile]: JSON.stringify(data, null, 2),
  };
}
