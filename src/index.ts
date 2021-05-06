import Firebird from 'node-firebird';
import axios from './services/axios';
import logger from './services/logger';
import { AuthenticationResponse } from './@types/authentication.type';
import CheckFirebirdVersion from './utils/CheckFirebirdVersion';
import FirebirdService from './services/firebird';
import Authentication from './utils/Authentication';

const timeout = 60000;
let auth: AuthenticationResponse[];

async function run() {
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

async function jobLoop() {
  const db: Firebird.Database = await FirebirdService.Connect();
  const checkVersion = new CheckFirebirdVersion(db);
  await checkVersion.validate();
  auth = await Authentication.Authenticate(auth);

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
