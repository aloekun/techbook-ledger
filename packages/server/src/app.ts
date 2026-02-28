import express, { type Express } from "express";
import cors from "cors";
import { createBooksRouter, type BookService } from "./routes/books.js";

export interface AppOptions {
  readonly bookService: BookService;
  readonly allowedOrigins: readonly string[];
}

export function createApp(options: AppOptions): Express {
  const { bookService, allowedOrigins } = options;
  const allowedSet = new Set(allowedOrigins);
  const app: Express = express();

  app.use(express.json());
  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin || allowedSet.has(origin)) {
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

  app.use("/api/books", createBooksRouter(bookService));

  return app;
}
