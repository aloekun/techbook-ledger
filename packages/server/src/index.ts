import express, { type Express } from "express";
import cors from "cors";
import { loadServerConfig } from "./config/env.js";

const config = loadServerConfig();

const app: Express = express();

app.use(express.json());
app.use(
  cors({
    origin: (_origin, callback) => {
      callback(null, true);
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.listen(config.port, "127.0.0.1", () => {
  console.log(
    `techbook-ledger server listening on http://127.0.0.1:${config.port}`,
  );
});

export { app };
