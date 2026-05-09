import { Request, Response, NextFunction } from 'express'
import { v4 as uuidv4 } from 'uuid'

export class AppError extends Error {
  code: string
  statusCode: number
  details?: Record<string, any>
  requestId: string

  constructor(
    message: string,
    options: {
      code?: string
      statusCode?: number
      details?: Record<string, any>
      requestId?: string
    } = {}
  ) {
    super(message)
    this.name = 'AppError'
    this.code = options.code || 'INTERNAL_ERROR'
    this.statusCode = options.statusCode || 500
    this.details = options.details
    this.requestId = options.requestId || uuidv4()
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, any>, requestId?: string) {
    super(message, {
      code: 'VALIDATION_ERROR',
      statusCode: 400,
      details,
      requestId
    })
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: Record<string, any>, requestId?: string) {
    super(message, {
      code: 'NOT_FOUND',
      statusCode: 404,
      details,
      requestId
    })
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, any>, requestId?: string) {
    super(message, {
      code: 'CONFLICT',
      statusCode: 409,
      details,
      requestId
    })
    this.name = 'ConflictError'
  }
}

export class OptimisticLockError extends AppError {
  constructor(message: string, details?: Record<string, any>, requestId?: string) {
    super(message, {
      code: 'OPTIMISTIC_LOCK_ERROR',
      statusCode: 409,
      details,
      requestId
    })
    this.name = 'OptimisticLockError'
  }
}

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const requestId = req.idempotency?.requestId || uuidv4()

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details
      },
      requestId: err.requestId || requestId,
      timestamp: new Date().toISOString()
    })
    return
  }

  console.error('Unhandled error:', err)

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    },
    requestId,
    timestamp: new Date().toISOString()
  })
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `路由 ${req.method} ${req.path} 不存在`
    },
    requestId: req.idempotency?.requestId || uuidv4(),
    timestamp: new Date().toISOString()
  })
}
