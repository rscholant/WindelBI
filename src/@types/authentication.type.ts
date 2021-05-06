export type AuthenticationType = {
  cnpj: string;
  expiresIn: string;
  expiresAt: number;
  accessToken: string;
};
export type AuthenticationResponse = {
  cnpj: string;
  auth?: AuthenticationType;
};
