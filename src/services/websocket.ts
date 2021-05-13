import socketClient, { Socket } from 'socket.io-client';
import Firebird from 'node-firebird';
import { AuthenticationResponse } from '../@types/authentication.type';
import { SincConfigResponse } from '../@types/response.type';
import config from '../config/config';
import Verifications from '../utils/Verifications';
import FirebirdService from './firebird';
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
    logger.error('Error creating websocket', error);
  });
  io.on('connect_error', (error: string) => {
    logger.error('Error connecting to websocket', error);
  });
  io.on('connect', async () => {
    logger.info('Connected to websocket server');
    io.on('sinc-config', async (message: SincConfigResponse) => {
      try {
        console.log('vai criar a conexão com o banco');
        const db: Firebird.Database = await FirebirdService.Connect();
        console.log('Vai iniciar a classe verifications');
        const verifications = new Verifications(db);
        console.log('vai instalar a configuração');
        await verifications.verifyConfiguration({
          ...message,
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
          auth: auth.auth!,
        });
        await FirebirdService.Disconnect(db);
      } catch (err) {
        logger.error('Error when installing new configuration', err);
      }
    });
  });
  return io;
}
export default initWebSocket;
