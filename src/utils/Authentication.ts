import Firebird from 'node-firebird';
import {
  AuthenticationType,
  AuthenticationResponse,
} from '../@types/authentication.type';
import FirebirdService from '../services/firebird';
import axios from '../services/axios';
import logger from '../services/logger';
import config from '../config/config';

async function findAuthenticationDB(
  db: Firebird.Database,
  auth?: AuthenticationResponse[],
): Promise<AuthenticationResponse[]> {
  const promisesFB: unknown[] = [];
  const authData: AuthenticationResponse[] = [];
  if (!auth || auth.length === 0) {
    for (let i = 0; i < config.COMPANIES.length; i += 1) {
      promisesFB.push(
        FirebirdService.QueryOne(
          db,
          `SELECT DATA FROM BI_CONFIG WHERE KEY = ?`,
          [`AUTH_${config.COMPANIES[i]}`],
        )
          .then(result => {
            if (result) {
              const authDB: AuthenticationType = JSON.parse(result.DATA);
              const authResponse: AuthenticationResponse = {
                cnpj: config.COMPANIES[i],
              };
              if (!(authDB.expiresAt < new Date().getTime())) {
                authData.push({
                  auth: authDB,
                  ...authResponse,
                });
              } else {
                authData.push({
                  ...authResponse,
                });
              }
            } else {
              authData.push({
                cnpj: config.COMPANIES[i],
              });
            }
          })
          .catch(err => {
            logger.error(err);
          }),
      );
    }
  } else {
    for (let i = 0; i < auth.length; i += 1) {
      const authResponse: AuthenticationResponse = {
        cnpj: auth[i].cnpj,
      };
      if (!((auth[i].auth?.expiresAt || 0) < new Date().getTime()))
        authData.push({
          auth: auth[i].auth,
          ...authResponse,
        });
    }
  }
  if (promisesFB && promisesFB.length > 0) await Promise.all(promisesFB);
  return authData;
}
async function Authenticate(
  auth?: AuthenticationResponse[],
): Promise<AuthenticationResponse[]> {
  const db = await FirebirdService.Connect();
  if (!db) {
    logger.error('Não foi possível conectar ao banco de dados!');
    throw new Error('Não foi possível conectar ao banco de dados!');
  }
  const authData = await findAuthenticationDB(db, auth);
  const promisesAxios: unknown[] = [];
  for (let i = 0; i < authData.length; i += 1) {
    if (!authData[i].auth) {
      promisesAxios.push(
        axios
          .post('/auth/login', { cnpj: authData[i].cnpj })
          .then(async result => {
            await FirebirdService.Execute(
              db,
              'UPDATE OR INSERT INTO BI_CONFIG (KEY, DATA) VALUES (?, ?) MATCHING (KEY)',
              [`AUTH_${authData[i].cnpj}`, JSON.stringify(result.data)],
            ).catch(err => {
              logger.error(err);
            });
            authData[i].auth = result.data;
          })
          .catch(err => {
            logger.error('Não foi possível autenticar o usuário', err);
          }),
      );
    }
  }
  await Promise.all(promisesAxios);
  return authData;
}

export default { Authenticate };
