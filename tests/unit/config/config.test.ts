import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigError, loadConfig, loadConfigOrExit } from '../../../src/config';
import { captureError } from '../support/fakes';

const VALID_URL = 'postgresql://user:pass@localhost:5432/orders_dev';

describe('loadConfig', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('aplica PORT=3000 e LOG_LEVEL=info como padrão', () => {
    expect(loadConfig({ DATABASE_URL: VALID_URL })).toEqual({ databaseUrl: VALID_URL, port: 3000, logLevel: 'info' });
  });

  it('lê os valores informados', () => {
    expect(loadConfig({ DATABASE_URL: 'postgres://u:p@db/x', PORT: '8080', LOG_LEVEL: 'debug' })).toEqual({
      databaseUrl: 'postgres://u:p@db/x',
      port: 8080,
      logLevel: 'debug',
    });
  });

  it('trata variável vazia como ausente', async () => {
    const error = await captureError(() => loadConfig({ DATABASE_URL: '   ' }));

    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).problems).toEqual([
      'DATABASE_URL é obrigatória (ex.: postgresql://user:pass@localhost:5432/orders_dev)',
    ]);
  });

  it('lista todos os problemas de uma vez', async () => {
    const error = await captureError(() => loadConfig({ DATABASE_URL: 'mysql://x', PORT: '70000', LOG_LEVEL: 'verbose' }));

    expect(error).toBeInstanceOf(ConfigError);
    expect((error as ConfigError).problems).toEqual([
      'DATABASE_URL deve ser uma URL postgres:// ou postgresql:// válida',
      'PORT deve ser um inteiro entre 1 e 65535 (recebido: "70000")',
      'LOG_LEVEL deve ser um de: fatal, error, warn, info, debug, trace, silent (recebido: "verbose")',
    ]);
    expect((error as ConfigError).message).toContain('a aplicação não vai iniciar');
  });

  it.each(['abc', '0', '3000.5'])('rejeita PORT=%s', async (port) => {
    const error = await captureError(() => loadConfig({ DATABASE_URL: VALID_URL, PORT: port }));

    expect((error as ConfigError).problems).toEqual([`PORT deve ser um inteiro entre 1 e 65535 (recebido: "${port}")`]);
  });

  it('rejeita DATABASE_URL que não é URL', async () => {
    const error = await captureError(() => loadConfig({ DATABASE_URL: 'não é url' }));

    expect((error as ConfigError).problems).toEqual(['DATABASE_URL deve ser uma URL postgres:// ou postgresql:// válida']);
  });

  it('loadConfigOrExit mostra a mensagem e encerra com código 1', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const exit = vi.spyOn(process, 'exit').mockImplementation((code) => {
      throw new Error(`process.exit(${String(code)})`);
    });

    const error = await captureError(() => loadConfigOrExit({}));

    expect(error).toEqual(new Error('process.exit(1)'));
    expect(exit).toHaveBeenCalledWith(1);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL é obrigatória'));
  });

  it('loadConfigOrExit devolve a configuração quando é válida', () => {
    expect(loadConfigOrExit({ DATABASE_URL: VALID_URL }).databaseUrl).toBe(VALID_URL);
  });
});
