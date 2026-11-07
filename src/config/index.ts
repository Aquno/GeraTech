const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'] as const;

export type LogLevel = (typeof LOG_LEVELS)[number];

export interface Config {
  readonly databaseUrl: string;
  readonly port: number;
  readonly logLevel: LogLevel;
}

export class ConfigError extends Error {
  constructor(readonly problems: readonly string[]) {
    super(
      [
        'Configuração inválida; a aplicação não vai iniciar:',
        ...problems.map((problem) => `  - ${problem}`),
        'Veja o .env.example para as variáveis esperadas.',
      ].join('\n'),
    );
    this.name = 'ConfigError';
  }
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const problems: string[] = [];
  const read = (name: string): string | undefined => {
    const value = env[name]?.trim();
    return value === '' ? undefined : value;
  };

  const databaseUrl = read('DATABASE_URL');
  if (databaseUrl === undefined) {
    problems.push('DATABASE_URL é obrigatória (ex.: postgresql://user:pass@localhost:5432/orders_dev)');
  } else if (!isPostgresUrl(databaseUrl)) {
    problems.push('DATABASE_URL deve ser uma URL postgres:// ou postgresql:// válida');
  }

  const rawPort = read('PORT') ?? '3000';
  const port = Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push(`PORT deve ser um inteiro entre 1 e 65535 (recebido: "${rawPort}")`);
  }

  const logLevel = read('LOG_LEVEL') ?? 'info';
  if (!isLogLevel(logLevel)) {
    problems.push(`LOG_LEVEL deve ser um de: ${LOG_LEVELS.join(', ')} (recebido: "${logLevel}")`);
  }

  if (problems.length > 0 || databaseUrl === undefined || !isLogLevel(logLevel)) {
    throw new ConfigError(problems);
  }
  return { databaseUrl, port, logLevel };
}

/** Para entrypoints: em caso de configuração inválida, mostra os problemas e encerra o processo. */
export function loadConfigOrExit(env: NodeJS.ProcessEnv = process.env): Config {
  try {
    return loadConfig(env);
  } catch (error) {
    if (error instanceof ConfigError) {
      console.error(error.message);
      process.exit(1);
    }
    throw error;
  }
}

function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

function isPostgresUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'postgres:' || protocol === 'postgresql:';
  } catch {
    return false;
  }
}
