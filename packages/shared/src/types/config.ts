export interface ServerConfig {
  readonly port: number;
  readonly notionToken: string;
  readonly notionDatabaseId: string;
  readonly allowedExtensionOrigins: readonly string[];
}

export interface ExtensionConfig {
  readonly serverEndpoint: string;
  readonly whitelist: readonly string[];
}
