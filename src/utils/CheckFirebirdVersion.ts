import Firebird from 'node-firebird';
import FirebirdService from '../services/firebird';
import logger from '../services/logger';

export default class CheckFirebirdVersion {
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

  async validate(): Promise<void> {
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
