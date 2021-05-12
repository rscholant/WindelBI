import Firebird from 'node-firebird';
import axios from './services/axios';
import logger from './services/logger';
import { AuthenticationResponse } from './@types/authentication.type';
import Verifications from './utils/Verifications';
import FirebirdService from './services/firebird';
import Authentication from './utils/Authentication';
import initWebSocket from './services/websocket';

const timeout = 60 * 1000;
let auth: AuthenticationResponse[];

async function run(db: Firebird.Database) {
  const promises: unknown[] = [];
  for (let i = 0; i < auth.length; i += 1) {
    if (auth[i].auth) {
      promises.push(
        FirebirdService.Query(
          db,
          `SELECT * FROM BI_REPLIC_CONFIG WHERE STATUS = 1 AND CNPJ = ?`,
          [auth[i].cnpj],
          // eslint-disable-next-line no-loop-func
        ).then(results => {
          results.forEach(async result => {
            const data = await FirebirdService.Query(db, result.QUERY, []);
            const response = await axios.post(
              'sinc-data',
              {
                sincConfig: { id: result.ID },
                dateSinc: new Date().getTime(),
                data,
              },
              {
                headers: {
                  Authorization: `Bearer ${auth[i].auth?.accessToken}`,
                },
              },
            );
            if (response.status === 201) {
              await FirebirdService.Execute(
                db,
                `UPDATE BI_REPLIC_CONFIG SET STATUS = 0 WHERE ID = ?`,
                [result.ID],
              );
            }
          });
        }),
      );
    }
  }
  await Promise.all(promises);

  /* At the end of each run, it will verify the authentication  */
  let needAuthentication = false;
  for (let i = 0; i < auth.length; i += 1) {
    if (
      !needAuthentication &&
      auth &&
      (auth[i].auth?.expiresAt || 0) < new Date().getTime()
    ) {
      needAuthentication = true;
    }
  }
  if (needAuthentication) auth = await Authentication.Authenticate(auth);
}

(async () => {
  const db: Firebird.Database = await FirebirdService.Connect();
  const verifications = new Verifications(db);
  await verifications.verifyDB();
  auth = await Authentication.Authenticate();
  await verifications.verifyConfigurations(auth);
  let ioArray = [];
  ioArray = [];
  for (let i = 0; i < auth.length; i += 1) {
    const authWS = auth[i];
    ioArray.push(initWebSocket(authWS, verifications));
  }
  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => {
        setTimeout(async () => {
          resolve(await run(db));
        }, timeout);
      });
    } catch (e) {
      logger.error(e);
    }
  }
})();
