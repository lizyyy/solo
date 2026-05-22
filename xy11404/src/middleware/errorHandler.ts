import { Request, Response, NextFunction } from 'express'
import { StateMachineError } from '../services/stateMachine'
import { LedgerNotFoundError, ValidationError } from '../services/ledgerService'

export class AppError extends Error {
  statusCode: number
  constructor(message: string, statusCode: number) {
    super(message)
    this.statusCode = statusCode
    this.name = 'AppError'
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) {
  console.error('Error:', err)

  if (err instanceof LedgerNotFoundError) {
    return res.status(404).json({
      error: 'NotFound',
      message: err.message,
    })
  }

  if (err instanceof ValidationError || err instanceof StateMachineError) {
    return res.status(400).json({
      error: 'ValidationError',
      message: err.message,
    })
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: err.name,
      message: err.message,
    })
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: 'ValidationError',
      message: '请求参数验证失败',
      details: (err as any).errors,
    })
  }

  res.status(500).json({
    error: 'InternalServerError',
    message: '服务器内部错误',
  })
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}
