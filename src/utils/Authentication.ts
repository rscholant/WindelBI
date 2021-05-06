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
): Promise<AuthenticationResponse[]> {
  const promisesFB: unknown[] = [];
  const authData: AuthenticationResponse[] = [];
  for (let i = 0; i < config.COMPANIES.length; i += 1) {
    promisesFB.push(
      FirebirdService.QueryOne(db, `SELECT DATA FROM BI_CONFIG WHERE KEY = ?`, [
        `AUTH_${config.COMPANIES[i]}`,
      ])
        .then(result => {
          if (result) {
            const auth: AuthenticationType = JSON.parse(result.DATA);
            const authResponse: AuthenticationResponse = {
              cnpj: config.COMPANIES[i],
            };
            if (!(auth.expiresAt < new Date().getTime()))
              authData.push({
                auth,
                ...authResponse,
              });
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
  await Promise.all(promisesFB);
  return authData;
}
async function Authenticate(): Promise<AuthenticationResponse[] | null> {
  const db = await FirebirdService.Connect();
  if (!db) {
    logger.error('Não foi possível conectar ao banco de dados!');
    return null;
  }
  const authData = await findAuthenticationDB(db);
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
