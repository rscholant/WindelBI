import socketClient, { Socket } from 'socket.io-client';
import { AuthenticationResponse } from '../@types/authentication.type';
import { SincConfigResponse } from '../@types/response.type';
import config from '../config/config';
import Verifications from '../utils/Verifications';
import logger from './logger';
import FirebirdService from './firebird';

async function initWebSocket(
  auth: AuthenticationResponse,
): Promise<typeof Socket | null> {
  const io = socketClient(config.API_SERVER, {
    transports: ['websocket'],
    upgrade: false,
    query: {
      auth: auth.cnpj,
    },
  });
  io.on('error', (error: string) => {
    logger.error('[WebSocket] - Error creating websocket', error);
  });
  io.on('connect_error', (error: string) => {
    logger.error('[WebSocket] - Error connecting to websocket', error);
  });
  io.on('connect', async () => {
    logger.info('[WebSocket] - Connected to websocket server');
    if (io.hasListeners('sinc-config')) {
      io.removeListener('sinc-config');
      io.removeListener('req-all-sinc-config');
      io.removeListener('req-sinc-config');
    }
    io.on('sinc-config', async (message: SincConfigResponse) => {
      try {
        await Verifications.verifyConfiguration({
          ...message,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          auth: auth.auth!,
        });
      } catch (err) {
        logger.error(
          '[WebSocket] - Error when installing new configuration',
          err,
        );
      }
    });
    io.on('req-all-sinc-config', async () => {
      try {
        logger.info('[WebSocket] - requesting all synchronization configs');
        await FirebirdService.Execute('UPDATE BI_REPLIC_CONFIG SET STATUS = 1');
      } catch (err) {
        logger.error('[WebSocket] - Error when request all sinc config', err);
      }
    });
    io.on('req-sinc-config', async (idSincConfig: number) => {
      try {
        logger.info(
          `[WebSocket] - requesting synchronization config number: ${idSincConfig}`,
        );
        await FirebirdService.Execute(
          'UPDATE BI_REPLIC_CONFIG SET STATUS = 1 WHERE ID = ?',
          [idSincConfig],
        );
      } catch (err) {
        logger.error('[WebSocket] - Error when request all sinc config', err);
      }
    });
  });
  return io;
}
export default initWebSocket;
