import md5 from 'md5';
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
        FirebirdService.QueryOne(
          `SELECT MAX(ID) AS ID FROM BI_REPLIC_CONFIG WHERE CNPJ = ?`,
          [auth[i].cnpj],
        ).then(async resultQuery => {
          const url =
            resultQuery && resultQuery.ID
              ? `/sinc-config/is-newer/${resultQuery.ID}`
              : '/sinc-config';
          const result = await axios.get(url, {
            headers: {
              Authorization: `Bearer ${auth[0].auth?.accessToken}`,
            },
          });
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
const saveSincConfigDB = async (sincConfigs: SincConfigResponse[]) => {
  for (let i = 0; i < sincConfigs.length; i += 1) {
    FirebirdService.Execute(
      `UPDATE OR INSERT INTO BI_REPLIC_CONFIG 
          (ID, CNPJ, QUERY, DATE_SINCE_LAST_PULL, TABLES) 
        VALUES 
          (?, ?, ?, ?, ?) MATCHING (ID, CNPJ)`,
      [
        sincConfigs[i].id,
        sincConfigs[i].auth.cnpj,
        sincConfigs[i].sql,
        new Date(),
        JSON.stringify(sincConfigs[i].tables),
      ],
    );
  }
};

const installSincOnTable = async (table: string) => {
  logger.info(`[Engine] - initializing table ${table}`);
  await FirebirdService.Execute(
    `EXECUTE block as
      BEGIN
        if (not exists(select 1 
                from RDB$RELATION_FIELDS rf 
                where UPPER(rf.RDB$RELATION_NAME) = UPPER('${table}') 
                  and UPPER(rf.RDB$FIELD_NAME) = 'SINC_UUID')) then
          execute statement 'ALTER TABLE ${table} ADD SINC_UUID VARCHAR(36)';
      END`,
    [],
  );

  let pkSincIdName = `IDX_SINCUUID_${table}`;

  if (pkSincIdName.length >= 31) {
    pkSincIdName = `${pkSincIdName.substr(0, 27)}_${md5(table).substr(0, 3)}`;
  }

  await FirebirdService.Execute(
    `EXECUTE block as 
      BEGIN 
        if (not exists(select 1 
            from rdb$indices 
            where UPPER(rdb$index_name) = UPPER('${pkSincIdName}'))) then 
          execute statement 'CREATE INDEX ${pkSincIdName} ON ${table} (SINC_UUID)'; 
      END `,
    [],
  );
  await FirebirdService.Execute(
    `UPDATE ${table} SET SINC_UUID = UUID_TO_CHAR(GEN_UUID())`,
    [],
  );
  let triggerNomeUUID = `uuid_${table}`;
  let triggerNomeReplic = `BI_${table}`;
  if (triggerNomeUUID.length >= 31) {
    const hash = md5(table);
    triggerNomeUUID = `${triggerNomeUUID.substr(0, 27)}_${hash.substr(0, 3)}`;
    triggerNomeReplic = `${triggerNomeReplic.substr(0, 27)}_${hash.substr(
      0,
      3,
    )}`;
  }
  await FirebirdService.Execute(
    `
    CREATE OR ALTER TRIGGER ${triggerNomeUUID} FOR ${table}
        ACTIVE BEFORE INSERT POSITION 0
    AS 
    BEGIN
      IF(new.SINC_UUID is null) THEN
      BEGIN
          new.SINC_UUID = UUID_TO_CHAR(GEN_UUID());
      END
    END`,
    [],
  );
  await FirebirdService.Execute(
    `GRANT UPDATE, REFERENCES ON ${table} TO TRIGGER ${triggerNomeUUID}`,
    [],
  );
  await FirebirdService.Execute(
    `
    CREATE OR ALTER TRIGGER ${triggerNomeReplic} FOR ${table}
    ACTIVE AFTER INSERT OR UPDATE OR DELETE POSITION 0
    AS 
    BEGIN 
      UPDATE BI_REPLIC_CONFIG 
      SET STATUS = 1
      WHERE TABLES LIKE '%${table}%';
    END`,
    [],
  );
  await FirebirdService.Execute(
    `GRANT INSERT ON REPLIC_DATA_STATUS TO TRIGGER ${triggerNomeReplic}`,
    [],
  );
  await FirebirdService.Execute(
    `GRANT UPDATE, REFERENCES ON ${table} TO TRIGGER ${triggerNomeReplic}`,
    [],
  );
};
export default class Verifications {
  versionUpToDate = 2;

  static async updateVersionOnDB(version: number): Promise<void> {
    await FirebirdService.Execute(
      `UPDATE OR INSERT INTO BI_CONFIG (KEY, DATA) VALUES ('VERSION', ?) MATCHING (KEY)`,
      [version],
    );
  }

  static async verifyTable(table: string): Promise<boolean> {
    const result = await FirebirdService.QueryOne(
      `SELECT * FROM rdb$triggers 
        WHERE RDB$RELATION_NAME = ?
        AND "RDB$TRIGGER_NAME"  LIKE 'BI_%'`,
      [table],
    );
    return !result;
  }

  static async verifyConfiguration(
    sincConfig: SincConfigResponse,
  ): Promise<void> {
    logger.info(
      `[WebSocket] - Starting to install a new configuration ${sincConfig.id}`,
    );
    const promises: unknown[] = [];
    sincConfig.tables.forEach(async table => {
      logger.info(`[WebSocket] - Installing in table: ${table}`);
      const installInTable = await Verifications.verifyTable(table);
      if (installInTable) {
        await installSincOnTable(table);
      }
    });
    await Promise.all(promises);
    await saveSincConfigDB([sincConfig]);
  }

  static async verifyConfigurations(
    auth: AuthenticationResponse[],
  ): Promise<void> {
    logger.info('[Engine] - Starting to check for new configurations');
    const sincConfigs = await getSincConfigAPI(auth);
    const promises: unknown[] = [];
    for (let i = 0; i < sincConfigs.length; i += 1) {
      sincConfigs[i].tables.forEach(async table => {
        if (await Verifications.verifyTable(table))
          promises.push(async () => {
            await installSincOnTable(table);
          });
      });
    }
    await saveSincConfigDB(sincConfigs);
    await Promise.all(promises);
  }

  async verifyDB(): Promise<void> {
    let version = 0;
    let results;
    try {
      results = await FirebirdService.QueryOne(
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
        `[Engine] - Atualizando banco de dados\n Versão atual encontrada: ${version}\n Versão encontrada ${this.versionUpToDate}`,
      );
      await Verifications.applyModifications(version);
    }
  }

  static async applyModifications(version: number): Promise<void> {
    if (version < 1) {
      logger.info(`[Engine] - Applying updates for version 1`);
      await FirebirdService.Execute(
        `EXECUTE BLOCK AS BEGIN
          IF (NOT EXISTS(SELECT 1 FROM rdb$relations WHERE rdb$relation_name = 'BI_CONFIG')) THEN
            EXECUTE STATEMENT 'CREATE TABLE BI_CONFIG (KEY VARCHAR(100), DATA VARCHAR(2000))';
         END`,
        [],
      );

      await Verifications.updateVersionOnDB(1);
    }
    if (version < 2) {
      logger.info(`[Engine] - Applying updates for version 2`);
      await FirebirdService.Execute(
        `EXECUTE BLOCK AS BEGIN
          IF (NOT EXISTS(SELECT 1 FROM rdb$relations WHERE rdb$relation_name = 'BI_REPLIC_CONFIG')) THEN
            EXECUTE STATEMENT 'CREATE TABLE BI_REPLIC_CONFIG (
                                ID INTEGER,
                                CNPJ VARCHAR(20),
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
