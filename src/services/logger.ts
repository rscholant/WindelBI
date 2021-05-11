/* eslint-disable @typescript-eslint/no-explicit-any */
import winston from 'winston';
import config from '../config/config';

const LEVEL = Symbol.for('level');
function filterOnly(level: any) {
  return winston.format((info: any) => {
    if (info[LEVEL] === level) {
      return info;
    }
    return false;
  })();
}
const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.File({
      filename: 'error.log',
      level: 'error',
      format: filterOnly('error'),
      maxsize: 20 * 1000000,
    }),
    new winston.transports.File({
      filename: 'info.log',
      level: 'info',
      format: filterOnly('info'),
      maxsize: 20 * 1000000,
    }),
  ],
});

if (config.NODE_ENV !== 'production') {
  logger.add(
    new winston.transports.Console({ format: winston.format.simple() }),
  );
}

export default logger;
