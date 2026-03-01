import express, { type Express, type Request, type Response, type NextFunction } from "express";
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

  // Global error handler: CORS rejection -> 403, others -> preserve upstream status or 500
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error & { status?: number; statusCode?: number }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.message.includes("is not allowed by CORS")) {
      res.status(403).json({
        success: false,
        message: "許可されていないオリジンからのリクエストです",
      });
      return;
    }
    const status = err.status ?? err.statusCode ?? 500;
    const safeStatus = status >= 400 && status < 600 ? status : 500;
    res.status(safeStatus).json({
      success: false,
      message: "予期しないエラーが発生しました",
    });
  });

  return app;
}
