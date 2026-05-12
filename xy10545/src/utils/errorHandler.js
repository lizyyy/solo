class ApiError extends Error {
  constructor(message, code = 'INTERNAL_ERROR', statusCode = 500) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

const handleError = (err, req, res, next) => {
  console.error('Error:', err);
  
  const response = {
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      timestamp: new Date().toISOString()
    }
  };
  
  if (err.details) {
    response.error.details = err.details;
  }
  
  res.status(err.statusCode || 500).json(response);
};

module.exports = { ApiError, handleError };
