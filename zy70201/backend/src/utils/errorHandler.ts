export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const handleError = (res: any, error: unknown) => {
  console.error('Error:', error);
  
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      success: false,
      message: error.message
    });
  }
  
  return res.status(500).json({
    success: false,
    message: '服务器内部错误'
  });
};
