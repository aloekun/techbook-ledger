import { loadServerConfig } from "./config/env.js";
import { NotionBookClient } from "./services/notion-client.js";
import { createApp } from "./app.js";

const config = loadServerConfig();

const notionClient = new NotionBookClient({
  token: config.notionToken,
  databaseId: config.notionDatabaseId,
});

const app = createApp({
  bookService: notionClient,
  allowedOrigins: config.allowedExtensionOrigins,
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(
    `techbook-ledger server listening on http://127.0.0.1:${config.port}`,
  );
});

export { app };
