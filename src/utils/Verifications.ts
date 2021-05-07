import Firebird from 'node-firebird';
import { SincConfigResponse } from '../@types/response.type';
import { AuthenticationResponse } from '../@types/authentication.type';
import FirebirdService from '../services/firebird';
import logger from '../services/logger';
import axios from '../services/axios';

const getSincConfigAPI = async (
  auth: AuthenticationResponse[],
): Promise<SincConfigResponse[]> => {
  const promises: unknown[] = [];
  const responses: SincConfigResponse[] = [];
  for (let i = 0; i < auth.length; i += 1) {
    if (auth[i].auth) {
      promises.push(
        axios
          .get('/sinc-config', {
            headers: {
              Authorization: `Bearer ${auth[0].auth?.accessToken}`,
            },
          })
          .then(result => {
            for (let x = 0; x < result.data.length; x += 1) {
              const response: SincConfigResponse = {
                ...result.data[x],
                auth: auth[i].auth,
              };
              responses.push(response);
            }
          }),
      );
    }
  }
  await Promise.all(promises);
  return responses;
};
const saveSincConfigDB = async (
  db: Firebird.Database,
  sincConfigs: SincConfigResponse[],
) => {
  for (let i = 0; i < sincConfigs.length; i += 1) {
    FirebirdService.Execute(
      db,
      `UPDATE OR INSERT INTO BI_CONFIG (KEY, DATA) VALUES ('VERSION', ?) MATCHING (KEY)`,
      [],
    );
  }
};
export default class Verifications {
  db: Firebird.Database;

  versionUpToDate = 2;

  constructor(db: Firebird.Database) {
    this.db = db;
  }

  async updateVersionOnDB(version: number): Promise<void> {
    await FirebirdService.Execute(
      this.db,
      `UPDATE OR INSERT INTO BI_CONFIG (KEY, DATA) VALUES ('VERSION', ?) MATCHING (KEY)`,
      [version],
    );
  }

  async verifyConfigurations(auth: AuthenticationResponse[]): Promise<void> {
    const sincConfigs = await getSincConfigAPI(auth);
    await saveSincConfigDB(this.db, sincConfigs);
  }

  async verifyDB(): Promise<void> {
    let version = 0;
    let results;
    try {
      results = await FirebirdService.QueryOne(
        this.db,
        `SELECT KEY, DATA
          FROM BI_CONFIG
          WHERE KEY = ?`,
        ['VERSION'],
      );
    } catch {
      version = 0;
    }
    if (results) {
      version = parseInt(results.DATA, 10);
    }
    if (version !== this.versionUpToDate) {
      logger.info(
        `Atualizando banco de dados\n Versão atual encontrada: ${version}\n Versão encontrada ${this.versionUpToDate}`,
      );
      await this.applyModifications(version);
    }
  }

  async applyModifications(version: number): Promise<void> {
    if (version < 1) {
      logger.info(`Aplicando atualizações para a versão 1`);
      await FirebirdService.Execute(
        this.db,
        `EXECUTE BLOCK AS BEGIN
          IF (NOT EXISTS(SELECT 1 FROM rdb$relations WHERE rdb$relation_name = 'BI_CONFIG')) THEN
            EXECUTE STATEMENT 'CREATE TABLE BI_CONFIG (KEY VARCHAR(100), DATA VARCHAR(2000))';
         END`,
        [],
      );

      await this.updateVersionOnDB(1);
    }
    if (version < 2) {
      logger.info(`Aplicando atualizações para a versão 2`);
      await FirebirdService.Execute(
        this.db,
        `EXECUTE BLOCK AS BEGIN
          IF (NOT EXISTS(SELECT 1 FROM rdb$relations WHERE rdb$relation_name = 'BI_REPLIC_CONFIG')) THEN
            EXECUTE STATEMENT 'CREATE TABLE BI_REPLIC_CONFIG (
                                UUID VARCHAR(32),
                                QUERY VARCHAR(2000),
                                DATE_SINCE_LAST_PULL TIMESTAMP,
                                STATUS INT,
                                TABLES VARCHAR(2000) )';
          END`,
        [],
      );

      await this.updateVersionOnDB(2);
    }
  }
}
