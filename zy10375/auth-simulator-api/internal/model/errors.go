package model

const (
	ErrCodeInvalidRequest     = "INVALID_REQUEST"
	ErrCodeIdempotencyConflict = "IDEMPOTENCY_CONFLICT"
	ErrCodePartnerNotFound    = "PARTNER_NOT_FOUND"
	ErrCodeScopeNotFound      = "SCOPE_NOT_FOUND"
	ErrCodeSimulationNotFound = "SIMULATION_NOT_FOUND"
	ErrCodeInvalidStatus      = "INVALID_STATUS"
	ErrCodeValidationFailed   = "VALIDATION_FAILED"
	ErrCodeRiskBlocked        = "RISK_BLOCKED"
	ErrCodeCredentialExpired  = "CREDENTIAL_EXPIRED"
	ErrCodeInternalError      = "INTERNAL_ERROR"
)

var errorMessages = map[string]string{
	ErrCodeInvalidRequest:     "请求参数无效",
	ErrCodeIdempotencyConflict: "幂等性冲突，请求已存在",
	ErrCodePartnerNotFound:    "合作方不存在",
	ErrCodeScopeNotFound:      "权限范围不存在",
	ErrCodeSimulationNotFound: "模拟记录不存在",
	ErrCodeInvalidStatus:      "状态不合法",
	ErrCodeValidationFailed:   "校验失败",
	ErrCodeRiskBlocked:        "风险拦截",
	ErrCodeCredentialExpired:  "凭证已过期",
	ErrCodeInternalError:      "系统内部错误",
}

func GetErrorMessage(code string) string {
	if msg, ok := errorMessages[code]; ok {
		return msg
	}
	return "未知错误"
}
