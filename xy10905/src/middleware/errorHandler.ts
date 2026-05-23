import { Request, Response, NextFunction } from "express";
import { ExceptionLogService } from "../services/ExceptionLogService";

const exceptionLogService = new ExceptionLogService();

export const errorHandler = async (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  console.error("Error:", err);

  try {
    await exceptionLogService.logException(
      req.path,
      req.method,
      JSON.stringify(req.body),
      err
    );
  } catch (logError) {
    console.error("Failed to log exception:", logError);
  }

  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message,
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack,
  });
};

export const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
