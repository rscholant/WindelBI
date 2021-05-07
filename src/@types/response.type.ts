import { AuthenticationType } from './authentication.type';

export type SincConfigResponse = {
  id: number;
  sql: string;
  tables: Array<string>;
  createdAt: Date;
  updatedAt: Date;
  auth: AuthenticationType;
};
