package models

type ErrorCode string

const (
	ErrInvalidRequest     ErrorCode = "INVALID_REQUEST"
	ErrTaskNotFound       ErrorCode = "TASK_NOT_FOUND"
	ErrTenantNotFound     ErrorCode = "TENANT_NOT_FOUND"
	ErrClusterNotFound    ErrorCode = "CLUSTER_NOT_FOUND"
	ErrInvalidStatus      ErrorCode = "INVALID_STATUS"
	ErrStatusTransition   ErrorCode = "STATUS_TRANSITION_ERROR"
	ErrValidationFailed   ErrorCode = "VALIDATION_FAILED"
	ErrDualWriteFailed    ErrorCode = "DUAL_WRITE_FAILED"
	ErrRollbackFailed     ErrorCode = "ROLLBACK_FAILED"
	ErrDuplicateTask      ErrorCode = "DUPLICATE_TASK"
	ErrTaskInProgress     ErrorCode = "TASK_IN_PROGRESS"
	ErrCheckItemFailed    ErrorCode = "CHECK_ITEM_FAILED"
	ErrInternalError      ErrorCode = "INTERNAL_ERROR"
	ErrPowerOffNotAllowed ErrorCode = "POWER_OFF_NOT_ALLOWED"
)

func (e ErrorCode) String() string {
	return string(e)
}

type BusinessError struct {
	Code    ErrorCode
	Message string
	Err     error
}

func (e *BusinessError) Error() string {
	if e.Err != nil {
		return e.Message + ": " + e.Err.Error()
	}
	return e.Message
}

func NewBusinessError(code ErrorCode, message string) *BusinessError {
	return &BusinessError{
		Code:    code,
		Message: message,
	}
}

func NewBusinessErrorWithCause(code ErrorCode, message string, err error) *BusinessError {
	return &BusinessError{
		Code:    code,
		Message: message,
		Err:     err,
	}
}
