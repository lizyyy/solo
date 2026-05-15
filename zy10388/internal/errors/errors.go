package errors

import (
	"errors"
	"fmt"
)

var (
	ErrSessionNotFound     = NewError("SESSION_NOT_FOUND", "session not found", 404)
	ErrSessionNotActive    = NewError("SESSION_NOT_ACTIVE", "session is not active", 400)
	ErrClientMismatch      = NewError("CLIENT_MISMATCH", "client ID does not match", 400)
	ErrMaxReconnectExceeded = NewError("MAX_RECONNECT_EXCEEDED", "maximum reconnect count exceeded", 400)
	ErrValidationFailed    = NewError("VALIDATION_FAILED", "validation failed", 400)
	ErrInvalidRequest      = NewError("INVALID_REQUEST", "invalid request", 400)
)

type Error struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Status  int    `json:"status"`
	Cause   error  `json:"-"`
}

func (e *Error) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Cause)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func NewError(code, message string, status int) *Error {
	return &Error{
		Code:    code,
		Message: message,
		Status:  status,
	}
}

func New(message string) error {
	return errors.New(message)
}

func Wrap(err error, message string) error {
	if err == nil {
		return nil
	}
	var e *Error
	if errors.As(err, &e) {
		return &Error{
			Code:    e.Code,
			Message: e.Message,
			Status:  e.Status,
			Cause:   errors.New(message + ": " + e.Cause.Error()),
		}
	}
	return &Error{
		Code:    "INTERNAL_ERROR",
		Message: message,
		Status:  500,
		Cause:   err,
	}
}

func Is(err, target error) bool {
	return errors.Is(err, target)
}

func As(err error, target interface{}) bool {
	return errors.As(err, target)
}
