/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import Firebird from 'node-firebird';
import config from '../config/config';
import logger from './logger';

const options: Firebird.Options = {
  host: config.HOST,
  port: config.PORT,
  database: config.DATABASE,
  user: config.USER,
  password: config.PASSWORD,
  lowercase_keys: config.LOWERCASE_KEYS,
  role: config.ROLE,
  pageSize: config.PAGESIZE,
};

async function Connect(): Promise<Firebird.Database> {
  return new Promise((resolve, reject) => {
    Firebird.attach(options, (err, db) => {
      if (err) {
        logger.error('[Database] - Error connecting to the database', err);
        reject(err);
      }

      resolve(db);
    });
  });
}
async function Disconnect(db: Firebird.Database): Promise<void> {
  return new Promise((_resolve, reject) => {
    db.detach(err => {
      if (err) {
        logger.error(
          '[Database] - Error when disconnecting from the database',
          err,
        );
        reject(err);
      }
    });
  });
}
// eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
async function Query(query: string, params: any[]): Promise<any[]> {
  return new Promise((resolve, reject) => {
    try {
      Firebird.attach(options, (err, db) => {
        db.query(query, params, (error, result) => {
          if (error) {
            logger.error(
              `[Database] - Error when executing query ${query} with ${params} parameters`,
              error,
            );
            reject(error);
          }
          db.detach();
          resolve(result);
        });
      });
    } catch (err) {
      logger.error('[Database] - Error when executing query', err);
    }
  });
}
async function QueryOne(query: string, params: any[]): Promise<any> {
  const results = await Query(query, params);
  return results[0];
}
async function Execute(query: string, params?: any[]): Promise<void> {
  await Query(query, params || []);
}
export default { Connect, Disconnect, Query, QueryOne, Execute };
