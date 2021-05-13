import socketClient, { Socket } from 'socket.io-client';
import { AuthenticationResponse } from '../@types/authentication.type';
import { SincConfigResponse } from '../@types/response.type';
import config from '../config/config';
import Verifications from '../utils/Verifications';
import logger from './logger';

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
  });
  return io;
}
export default initWebSocket;
