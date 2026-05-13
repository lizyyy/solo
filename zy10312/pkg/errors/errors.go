package errors

import (
	"encoding/json"
	"net/http"
)

type ErrorCode string

const (
	ErrCodeInvalidRequest     ErrorCode = "INVALID_REQUEST"
	ErrCodeNotFound           ErrorCode = "NOT_FOUND"
	ErrCodeConflict           ErrorCode = "CONFLICT"
	ErrCodeIdempotencyConflict ErrorCode = "IDEMPOTENCY_CONFLICT"
	ErrCodeStrategyNotFound   ErrorCode = "STRATEGY_NOT_FOUND"
	ErrCodeBucketNotFound     ErrorCode = "BUCKET_NOT_FOUND"
	ErrCodeNoAvailableBucket  ErrorCode = "NO_AVAILABLE_BUCKET"
	ErrCodeChecksumMismatch   ErrorCode = "CHECKSUM_MISMATCH"
	ErrCodeUploadFailed       ErrorCode = "UPLOAD_FAILED"
	ErrCodeInternal           ErrorCode = "INTERNAL_ERROR"
)

type AppError struct {
	Code    ErrorCode `json:"code"`
	Message string    `json:"message"`
	Details string    `json:"details,omitempty"`
}

func (e *AppError) Error() string {
	return e.Message
}

func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
	}
}

func NewWithDetails(code ErrorCode, message, details string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Details: details,
	}
}

func (e *AppError) StatusCode() int {
	switch e.Code {
	case ErrCodeInvalidRequest:
		return http.StatusBadRequest
	case ErrCodeNotFound, ErrCodeStrategyNotFound, ErrCodeBucketNotFound:
		return http.StatusNotFound
	case ErrCodeConflict, ErrCodeIdempotencyConflict:
		return http.StatusConflict
	case ErrCodeNoAvailableBucket, ErrCodeChecksumMismatch, ErrCodeUploadFailed:
		return http.StatusFailedDependency
	default:
		return http.StatusInternalServerError
	}
}

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   *AppError   `json:"error,omitempty"`
}

func NewSuccessResponse(data interface{}) APIResponse {
	return APIResponse{
		Success: true,
		Data:    data,
	}
}

func NewErrorResponse(err *AppError) APIResponse {
	return APIResponse{
		Success: false,
		Error:   err,
	}
}

func (r APIResponse) WriteJSON(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "application/json")
	if !r.Success && r.Error != nil {
		w.WriteHeader(r.Error.StatusCode())
	}
	json.NewEncoder(w).Encode(r)
}
