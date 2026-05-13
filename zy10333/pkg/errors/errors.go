package errors

import "fmt"

const (
	CodeSuccess         = 0
	CodeInvalidParams   = 400
	CodeUnauthorized    = 401
	CodeForbidden       = 403
	CodeNotFound        = 404
	CodeConflict        = 409
	CodeInternalError   = 500

	CodeInvalidEnvironment = 1001
	CodeRiskLevelBlocked   = 1002
	CodeApprovalRequired   = 1003
	CodeInvalidStatus      = 1004
	CodeIdempotentConflict = 1005
	CodeSwitchNotFound     = 1006
	CodeOperatorForbidden  = 1007
)

type ServiceError struct {
	Code    int
	Message string
	Details string
}

func (e *ServiceError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("%s: %s", e.Message, e.Details)
	}
	return e.Message
}

func New(code int, message string) *ServiceError {
	return &ServiceError{
		Code:    code,
		Message: message,
	}
}

func NewWithDetails(code int, message, details string) *ServiceError {
	return &ServiceError{
		Code:    code,
		Message: message,
		Details: details,
	}
}

func InvalidParams(message string) *ServiceError {
	return New(CodeInvalidParams, message)
}

func InvalidParamsWithDetails(message, details string) *ServiceError {
	return NewWithDetails(CodeInvalidParams, message, details)
}

func NotFound(message string) *ServiceError {
	return New(CodeNotFound, message)
}

func Conflict(message string) *ServiceError {
	return New(CodeConflict, message)
}

func InternalError(message string) *ServiceError {
	return New(CodeInternalError, message)
}

func InvalidEnvironment(env string) *ServiceError {
	return NewWithDetails(CodeInvalidEnvironment, "无效的环境", env)
}

func RiskLevelBlocked(risk string) *ServiceError {
	return NewWithDetails(CodeRiskLevelBlocked, "风险等级过高，需要审批", risk)
}

func ApprovalRequired() *ServiceError {
	return New(CodeApprovalRequired, "需要审批才能执行")
}

func InvalidStatus(status string) *ServiceError {
	return NewWithDetails(CodeInvalidStatus, "当前状态不允许此操作", status)
}

func IdempotentConflict() *ServiceError {
	return New(CodeIdempotentConflict, "幂等键冲突")
}

func SwitchNotFound(id string) *ServiceError {
	return NewWithDetails(CodeSwitchNotFound, "开关项不存在", id)
}

func OperatorForbidden() *ServiceError {
	return New(CodeOperatorForbidden, "操作者无权限")
}
