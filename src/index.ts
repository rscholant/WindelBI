import Firebird from 'node-firebird';
import axios from './services/axios';
import logger from './services/logger';
import { AuthenticationResponse } from './@types/authentication.type';
import CheckFirebirdVersion from './utils/CheckFirebirdVersion';
import FirebirdService from './services/firebird';
import Authentication from './utils/Authentication';

const timeout = 60000;
let auth: AuthenticationResponse[] | null;

async function run() {
  logger.info('inicio de ciclo');
}

async function jobLoop() {
  const db: Firebird.Database = await FirebirdService.Connect();
  const checkVersion = new CheckFirebirdVersion(db);
  await checkVersion.validate();
  auth = await Authentication.Authenticate();

  for (;;) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await new Promise(resolve => {
        setTimeout(async () => {
          resolve(await run());
        }, timeout);
      });
    } catch (e) {
      logger.error(e);
    }
  }
}
jobLoop().catch(logger.error);
