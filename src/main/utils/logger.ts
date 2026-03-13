import log from 'electron-log';
import path from 'path';
import { app } from 'electron';

export function initLogger(): void {
  log.transports.file.resolvePathFn = () =>
    path.join(app.getPath('userData'), 'logs', 'main.log');
  log.transports.file.level = 'info';
  log.transports.console.level = 'debug';
}

export function getLogDir(): string {
  return path.join(app.getPath('userData'), 'logs');
}

export default log;
