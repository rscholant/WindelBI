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
    Firebird.attachOrCreate(options, (err, db) => {
      if (err) {
        logger.error('Erro ao se conectar ao banco de dados', err);
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
        logger.error('Erro ao se desconectar do banco de dados', err);
        reject(err);
      }
    });
  });
}
async function Query(
  db: Firebird.Database,
  query: string,
  params: any[],
): Promise<any[]> {
  return new Promise((resolve, reject) => {
    db.query(query, params, (err, result) => {
      if (err) {
        logger.error(
          `Erro ao executar query ${query} com os parâmetros ${params}`,
          err,
        );
        reject(err);
      }
      resolve(result);
    });
  });
}
async function QueryOne(
  db: Firebird.Database,
  query: string,
  params: any[],
): Promise<any> {
  const results = await Query(db, query, params);
  return results[0];
}
async function Execute(
  db: Firebird.Database,
  query: string,
  params: any[],
): Promise<void> {
  await Query(db, query, params);
}
export default { Connect, Disconnect, Query, QueryOne, Execute };
