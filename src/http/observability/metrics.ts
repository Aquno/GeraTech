import { Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Buckets em segundos, densos até o SLO de 300 ms (docs/desempenho.md). O limite 0.3 precisa
 * existir exatamente para que "% de requisições abaixo de 300 ms" seja lido direto do histograma.
 */
export const HTTP_DURATION_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.3, 0.5, 1, 2.5, 5];

/** Label usado quando nenhuma rota casou (404): evita colocar URLs arbitrárias como label. */
export const UNMATCHED_ROUTE = 'unmatched';

export type HttpDurationLabels = 'method' | 'route' | 'status_code';

export interface HttpMetrics {
  readonly registry: Registry;
  readonly httpRequestDuration: Histogram<HttpDurationLabels>;
}

export interface HttpMetricsOptions {
  /** Inclui as métricas padrão do processo Node (CPU, memória, event loop, GC). */
  collectDefault?: boolean;
}

/** Cada chamada cria um registry próprio, para que várias instâncias (ex.: testes) não colidam. */
export function createHttpMetrics({ collectDefault = true }: HttpMetricsOptions = {}): HttpMetrics {
  const registry = new Registry();
  if (collectDefault) {
    collectDefaultMetrics({ register: registry });
  }

  const httpRequestDuration = new Histogram<HttpDurationLabels>({
    name: 'http_request_duration_seconds',
    help: 'Duração das requisições HTTP em segundos, por método, template de rota e status.',
    labelNames: ['method', 'route', 'status_code'],
    buckets: HTTP_DURATION_BUCKETS,
    registers: [registry],
  });

  return { registry, httpRequestDuration };
}
