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

export const DEFAULT_WHITELIST: readonly string[] = [
  "amazon.co.jp",
  "gihyo.jp",
  "*.amazon.co.jp",
];

export const DEFAULT_EXTENSION_CONFIG: ExtensionConfig = {
  serverEndpoint: "http://localhost:3000",
  whitelist: DEFAULT_WHITELIST,
};
