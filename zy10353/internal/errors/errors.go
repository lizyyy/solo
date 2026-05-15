package errors

import "errors"

var (
	ErrTaskNotFound      = errors.New("task not found")
	ErrTaskAlreadyExists = errors.New("task already exists")
	ErrInvalidStatus     = errors.New("invalid task status")
	ErrInvalidArchive    = errors.New("invalid archive")
	ErrPathTraversal     = errors.New("path traversal detected")
	ErrFileTooLarge      = errors.New("file too large")
	ErrTotalSizeExceeded = errors.New("total size exceeded")
	ErrTooManyFiles      = errors.New("too many files")
	ErrBlockedExtension  = errors.New("blocked file extension")
	ErrBlockedPattern    = errors.New("blocked file pattern")
	ErrValidationFailed  = errors.New("validation failed")
	ErrProcessingFailed  = errors.New("processing failed")
	ErrDuplicateTask     = errors.New("duplicate task")
)

type AppError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
	Err     error  `json:"-"`
}

func (e *AppError) Error() string {
	if e.Detail != "" {
		return e.Message + ": " + e.Detail
	}
	return e.Message
}

func NewAppError(code, message string, err error) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}

func NewAppErrorWithDetail(code, message, detail string, err error) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Detail:  detail,
		Err:     err,
	}
}

func MapToErrorCode(err error) string {
	if appErr, ok := err.(*AppError); ok {
		return appErr.Code
	}
	switch {
	case errors.Is(err, ErrTaskNotFound):
		return "TASK_NOT_FOUND"
	case errors.Is(err, ErrTaskAlreadyExists):
		return "TASK_ALREADY_EXISTS"
	case errors.Is(err, ErrInvalidStatus):
		return "INVALID_STATUS"
	case errors.Is(err, ErrInvalidArchive):
		return "INVALID_ARCHIVE"
	case errors.Is(err, ErrPathTraversal):
		return "PATH_TRAVERSAL"
	case errors.Is(err, ErrFileTooLarge):
		return "FILE_TOO_LARGE"
	case errors.Is(err, ErrTotalSizeExceeded):
		return "TOTAL_SIZE_EXCEEDED"
	case errors.Is(err, ErrTooManyFiles):
		return "TOO_MANY_FILES"
	case errors.Is(err, ErrBlockedExtension):
		return "BLOCKED_EXTENSION"
	case errors.Is(err, ErrBlockedPattern):
		return "BLOCKED_PATTERN"
	case errors.Is(err, ErrValidationFailed):
		return "VALIDATION_FAILED"
	case errors.Is(err, ErrProcessingFailed):
		return "PROCESSING_FAILED"
	case errors.Is(err, ErrDuplicateTask):
		return "DUPLICATE_TASK"
	default:
		return "INTERNAL_ERROR"
	}
}
