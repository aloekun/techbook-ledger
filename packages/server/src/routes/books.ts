import { Router, type Request, type Response } from "express";
import type {
  BookData,
  RegisterResult,
  RegistrationResponse,
} from "@techbook-ledger/shared";
import {
  NotionAuthError,
  NotionRateLimitError,
  NotionConnectionError,
} from "../services/notion-client.js";
import { validateBookRecord } from "../middleware/validator.js";

export interface BookService {
  registerIfAbsent(bookData: BookData): Promise<RegisterResult>;
}

export function createBooksRouter(bookService: BookService): Router {
  const router = Router();

  router.post("/", async (req: Request, res: Response) => {
    const validation = validateBookRecord(req.body);
    if (!validation.valid) {
      const response: RegistrationResponse = {
        success: false,
        message: `必須フィールドが欠けています: ${validation.missingFields.join(", ")}`,
      };
      res.status(400).json(response);
      return;
    }

    const bookData: BookData = req.body;

    try {
      const result = await bookService.registerIfAbsent(bookData);

      if (result.created) {
        const response: RegistrationResponse = {
          success: true,
          message: "書籍を登録しました",
          notionUrl: result.notionUrl,
        };
        res.status(201).json(response);
      } else {
        const response: RegistrationResponse = {
          success: false,
          message: "この書籍は既に登録されています",
          notionUrl: result.notionUrl,
          isDuplicate: true,
        };
        res.status(200).json(response);
      }
    } catch (error: unknown) {
      const errorName =
        error instanceof Error ? error.constructor.name : "UnknownError";
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("POST /api/books error:", {
        errorName,
        message: errorMessage,
      });

      if (error instanceof NotionAuthError) {
        res.status(500).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error instanceof NotionRateLimitError) {
        res.status(429).json({
          success: false,
          message: error.message,
        });
        return;
      }

      if (error instanceof NotionConnectionError) {
        res.status(503).json({
          success: false,
          message: error.message,
        });
        return;
      }

      res.status(500).json({
        success: false,
        message: "予期しないエラーが発生しました",
      });
    }
  });

  return router;
}
