export interface AppVariables {
  rawBody?: string;
  parsedBody?: Record<string, unknown>;
}

export interface AppEnv {
  Variables: AppVariables;
}
