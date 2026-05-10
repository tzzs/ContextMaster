const isDebug = import.meta.env.DEV || import.meta.env.VITE_DEBUG === 'true';

export const debug = {
  log: (...args: unknown[]): void => {
    if (isDebug) console.log(...args);
    void window.api.logToFile('info', args.map((a) => String(a)).join(' '));
  },
  warn: (...args: unknown[]): void => {
    if (isDebug) console.warn(...args);
    void window.api.logToFile('warn', args.map((a) => String(a)).join(' '));
  },
  error: (...args: unknown[]): void => {
    if (isDebug) console.error(...args);
    void window.api.logToFile('error', args.map((a) => String(a)).join(' '));
  },
  info: (...args: unknown[]): void => {
    if (isDebug) console.info(...args);
    void window.api.logToFile('info', args.map((a) => String(a)).join(' '));
  },
};
