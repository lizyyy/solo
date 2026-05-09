package errors

import (
	"fmt"
	"runtime"
)

type ErrorCode string

const (
	ErrCodeInvalidStatusTransition ErrorCode = "INVALID_STATUS_TRANSITION"
	ErrCodeMessageNotFound         ErrorCode = "MESSAGE_NOT_FOUND"
	ErrCodeTrackingIDDuplicate     ErrorCode = "TRACKING_ID_DUPLICATE"
	ErrCodeMessageIDDuplicate      ErrorCode = "MESSAGE_ID_DUPLICATE"
	ErrCodeCacheOperationFailed    ErrorCode = "CACHE_OPERATION_FAILED"
	ErrCodeDatabaseOperationFailed ErrorCode = "DATABASE_OPERATION_FAILED"
	ErrCodeMQOperationFailed       ErrorCode = "MQ_OPERATION_FAILED"
	ErrCodeReplayTimeout           ErrorCode = "REPLAY_TIMEOUT"
	ErrCodeReplayFailed            ErrorCode = "REPLAY_FAILED"
	ErrCodeInvalidParameter        ErrorCode = "INVALID_PARAMETER"
	ErrCodeConcurrentOperation     ErrorCode = "CONCURRENT_OPERATION"
	ErrCodeDeadLetterNotFound      ErrorCode = "DEAD_LETTER_NOT_FOUND"
)

type AppError struct {
	Code      ErrorCode `json:"code"`
	Message   string    `json:"message"`
	Stack     string    `json:"stack"`
	Reason    error     `json:"-"`
}

func New(code ErrorCode, message string) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Stack:   getStackTrace(),
	}
}

func NewWithReason(code ErrorCode, message string, reason error) *AppError {
	return &AppError{
		Code:    code,
		Message: message,
		Stack:   getStackTrace(),
		Reason:  reason,
	}
}

func (e *AppError) Error() string {
	if e.Reason != nil {
		return fmt.Sprintf("[%s] %s: %v", e.Code, e.Message, e.Reason)
	}
	return fmt.Sprintf("[%s] %s", e.Code, e.Message)
}

func getStackTrace() string {
	buf := make([]byte, 1024)
	n := runtime.Stack(buf, false)
	return string(buf[:n])
}

func ErrInvalidStatusTransition(from, to string) *AppError {
	return New(ErrCodeInvalidStatusTransition, fmt.Sprintf("无法从状态 %s 转换到 %s", from, to))
}

func ErrMessageNotFound(id string) *AppError {
	return New(ErrCodeMessageNotFound, fmt.Sprintf("消息不存在: %s", id))
}

func ErrDeadLetterNotFound(id string) *AppError {
	return New(ErrCodeDeadLetterNotFound, fmt.Sprintf("死信消息不存在: %s", id))
}

func ErrTrackingIDDuplicate(id string) *AppError {
	return New(ErrCodeTrackingIDDuplicate, fmt.Sprintf("追踪ID已存在: %s", id))
}

func ErrMessageIDDuplicate(id string) *AppError {
	return New(ErrCodeMessageIDDuplicate, fmt.Sprintf("消息ID已存在: %s", id))
}

func ErrCacheOperationFailed(op string, reason error) *AppError {
	return NewWithReason(ErrCodeCacheOperationFailed, fmt.Sprintf("缓存操作失败: %s", op), reason)
}

func ErrDatabaseOperationFailed(op string, reason error) *AppError {
	return NewWithReason(ErrCodeDatabaseOperationFailed, fmt.Sprintf("数据库操作失败: %s", op), reason)
}

func ErrMQOperationFailed(op string, reason error) *AppError {
	return NewWithReason(ErrCodeMQOperationFailed, fmt.Sprintf("MQ操作失败: %s", op), reason)
}

func ErrReplayTimeout(timeout int) *AppError {
	return New(ErrCodeReplayTimeout, fmt.Sprintf("回放超时，超时时间: %ds", timeout))
}

func ErrReplayFailed(reason error) *AppError {
	return NewWithReason(ErrCodeReplayFailed, "回放失败", reason)
}

func ErrInvalidParameter(param, reason string) *AppError {
	return New(ErrCodeInvalidParameter, fmt.Sprintf("参数 %s 无效: %s", param, reason))
}

func ErrConcurrentOperation(op string) *AppError {
	return New(ErrCodeConcurrentOperation, fmt.Sprintf("并发操作冲突: %s", op))
}
