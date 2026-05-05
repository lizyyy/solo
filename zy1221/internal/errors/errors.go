package errors

import (
	"fmt"
)

type ErrorType string

const (
	ErrTypeConfig     ErrorType = "CONFIG_ERROR"
	ErrTypeParse      ErrorType = "PARSE_ERROR"
	ErrTypeValidation ErrorType = "VALIDATION_ERROR"
	ErrTypeRuntime    ErrorType = "RUNTIME_ERROR"
	ErrTypeIO         ErrorType = "IO_ERROR"
)

type SliceTeacherError struct {
	Type       ErrorType
	Message    string
	LineNumber int
	Filename   string
	Suggestion string
	Cause      error
}

func (e *SliceTeacherError) Error() string {
	if e.Cause != nil {
		return fmt.Sprintf("[%s] %s (文件: %s, 行: %d)\n  原因: %v\n  建议: %s",
			e.Type, e.Message, e.Filename, e.LineNumber, e.Cause, e.Suggestion)
	}
	return fmt.Sprintf("[%s] %s (文件: %s, 行: %d)\n  建议: %s",
		e.Type, e.Message, e.Filename, e.LineNumber, e.Suggestion)
}

func NewConfigError(message string, filename string, suggestion string) *SliceTeacherError {
	return &SliceTeacherError{
		Type:       ErrTypeConfig,
		Message:    message,
		Filename:   filename,
		Suggestion: suggestion,
		LineNumber: 0,
	}
}

func NewParseError(message string, filename string, lineNumber int, suggestion string, cause error) *SliceTeacherError {
	return &SliceTeacherError{
		Type:       ErrTypeParse,
		Message:    message,
		Filename:   filename,
		LineNumber: lineNumber,
		Suggestion: suggestion,
		Cause:      cause,
	}
}

func NewValidationError(message string, filename string, suggestion string) *SliceTeacherError {
	return &SliceTeacherError{
		Type:       ErrTypeValidation,
		Message:    message,
		Filename:   filename,
		Suggestion: suggestion,
		LineNumber: 0,
	}
}

func NewIOError(message string, filename string, cause error) *SliceTeacherError {
	return &SliceTeacherError{
		Type:       ErrTypeIO,
		Message:    message,
		Filename:   filename,
		Cause:      cause,
		Suggestion: "请检查文件路径是否正确，文件是否存在",
		LineNumber: 0,
	}
}

func NewRuntimeError(message string, suggestion string) *SliceTeacherError {
	return &SliceTeacherError{
		Type:       ErrTypeRuntime,
		Message:    message,
		Suggestion: suggestion,
		LineNumber: 0,
	}
}

func WrapError(err error, context string) *SliceTeacherError {
	if stErr, ok := err.(*SliceTeacherError); ok {
		return stErr
	}
	return &SliceTeacherError{
		Type:       ErrTypeRuntime,
		Message:    fmt.Sprintf("%s: %v", context, err),
		Cause:      err,
		Suggestion: "请检查日志获取详细信息",
		LineNumber: 0,
	}
}
