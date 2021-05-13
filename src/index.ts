import Firebird from 'node-firebird';
import axios from './services/axios';
import logger from './services/logger';
import { AuthenticationResponse } from './@types/authentication.type';
import Verifications from './utils/Verifications';
import FirebirdService from './services/firebird';
import Authentication from './utils/Authentication';
import initWebSocket from './services/websocket';

const timeout = 10 * 1000;
let auth: AuthenticationResponse[];
let ioArray = [];
process
  .on('unhandledRejection', (reason, p) => {
    logger.error('[Engine] - Unhandled Rejection at Promise', { reason, p });
  })
  .on('uncaughtException', err => {
    logger.error('[Engine] - Uncaught Exception thrown', err);
  });
async function run() {
  const promises: unknown[] = [];
  for (let i = 0; i < auth.length; i += 1) {
    if (auth[i].auth) {
      promises.push(
        FirebirdService.Query(
          `SELECT * FROM BI_REPLIC_CONFIG WHERE STATUS = 1 AND CNPJ = ?`,
          [auth[i].cnpj],
          // eslint-disable-next-line no-loop-func
        ).then(results => {
          results.forEach(async result => {
            const data = await FirebirdService.Query(result.QUERY, []);
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
  const verifications = new Verifications();
  await verifications.verifyDB();
  auth = await Authentication.Authenticate();
  await Verifications.verifyConfigurations(auth);
  ioArray = [];
  for (let i = 0; i < auth.length; i += 1) {
    const authWS = auth[i];
    ioArray.push(initWebSocket(authWS));
  }

  setInterval(async () => {
    await run();
  }, timeout);
})().catch(err => {
  logger.error('[Engine] - Error on main process', err);
});
