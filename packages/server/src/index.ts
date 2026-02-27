import express, { type Express } from "express";
import cors from "cors";
import { loadServerConfig } from "./config/env.js";

const ALLOWED_ORIGIN_PREFIXES = ["chrome-extension://"];

const config = loadServerConfig();

const app: Express = express();

app.use(express.json());
app.use(
  cors({
    origin: (origin, callback) => {
      if (
        !origin ||
        ALLOWED_ORIGIN_PREFIXES.some((prefix) => origin.startsWith(prefix))
      ) {
        callback(null, true);
      } else {
        callback(new Error(`Origin ${origin} is not allowed by CORS`));
      }
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
