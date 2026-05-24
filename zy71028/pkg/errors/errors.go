package errors

import (
	"encoding/json"
	"net/http"
)

type ErrorCode string

const (
	ErrMissingField     ErrorCode = "MISSING_FIELD"
	ErrInvalidState     ErrorCode = "INVALID_STATE"
	ErrDuplicateRequest ErrorCode = "DUPLICATE_REQUEST"
	ErrNeedReview       ErrorCode = "NEED_REVIEW"
	ErrNotFound         ErrorCode = "NOT_FOUND"
	ErrSuspended        ErrorCode = "MEAL_SUSPENDED"
	ErrValidation       ErrorCode = "VALIDATION_ERROR"
)

type AppError struct {
	Code    ErrorCode   `json:"code"`
	Message string      `json:"message"`
	Details interface{} `json:"details,omitempty"`
}

func (e *AppError) Error() string {
	bytes, _ := json.Marshal(e)
	return string(bytes)
}

func NewMissingField(field string) *AppError {
	return &AppError{
		Code:    ErrMissingField,
		Message: "缺少必要字段",
		Details: map[string]string{"field": field},
	}
}

func NewInvalidState(current, expected string) *AppError {
	return &AppError{
		Code:    ErrInvalidState,
		Message: "当前状态不允许此操作",
		Details: map[string]string{"current": current, "expected": expected},
	}
}

func NewDuplicateRequest(id string) *AppError {
	return &AppError{
		Code:    ErrDuplicateRequest,
		Message: "重复请求，操作已完成",
		Details: map[string]string{"request_id": id},
	}
}

func NewNeedReview(reason string) *AppError {
	return &AppError{
		Code:    ErrNeedReview,
		Message: "需要人工复核",
		Details: map[string]string{"reason": reason},
	}
}

func NewNotFound(resource string) *AppError {
	return &AppError{
		Code:    ErrNotFound,
		Message: "资源不存在",
		Details: map[string]string{"resource": resource},
	}
}

func NewMealSuspended(elderlyID string, reason string) *AppError {
	return &AppError{
		Code:    ErrSuspended,
		Message: "该老人已申请停餐",
		Details: map[string]string{"elderly_id": elderlyID, "reason": reason},
	}
}

func NewValidationError(msg string) *AppError {
	return &AppError{
		Code:    ErrValidation,
		Message: msg,
	}
}

func HTTPStatus(err error) int {
	if appErr, ok := err.(*AppError); ok {
		switch appErr.Code {
		case ErrMissingField, ErrValidation:
			return http.StatusBadRequest
		case ErrInvalidState, ErrSuspended:
			return http.StatusConflict
		case ErrDuplicateRequest:
			return http.StatusOK
		case ErrNeedReview:
			return http.StatusUnprocessableEntity
		case ErrNotFound:
			return http.StatusNotFound
		default:
			return http.StatusInternalServerError
		}
	}
	return http.StatusInternalServerError
}
