import type { NextFunction, Request, Response } from "express";
import { ZodError, type ZodType } from "zod";

export class HttpError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function parse<T>(schema: ZodType<T>, value: unknown): T {
  return schema.parse(value);
}

export function errorHandler(error: unknown, _request: Request, response: Response, _next: NextFunction): void {
  if (error instanceof ZodError) {
    response
      .status(422)
      .json({ detail: error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ") });
    return;
  }
  if (error instanceof HttpError) {
    response.status(error.statusCode).json({ detail: error.message });
    return;
  }
  response.status(500).json({ detail: "Internal server error" });
}
