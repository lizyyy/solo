package handlers

type CreateExternalAPIRequest struct {
	Name        string `json:"name" binding:"required"`
	Endpoint    string `json:"endpoint" binding:"required"`
	Method      string `json:"method" binding:"required"`
	Description string `json:"description"`
}

type CreateBusinessCallerRequest struct {
	Name        string `json:"name" binding:"required"`
	SystemCode  string `json:"system_code" binding:"required"`
	Description string `json:"description"`
}

type CheckCircuitRequest struct {
	RequestID        string `json:"request_id" binding:"required"`
	ExternalAPIID    string `json:"external_api_id" binding:"required"`
	BusinessCallerID string `json:"business_caller_id" binding:"required"`
}

type RecordCallRequest struct {
	RequestID        string `json:"request_id" binding:"required"`
	CircuitBreakerID string `json:"circuit_breaker_id" binding:"required"`
	Result           string `json:"result" binding:"required"`
	DurationMs       int64  `json:"duration_ms"`
	ErrorMessage     string `json:"error_message"`
	ResponseCode     int    `json:"response_code"`
}

type ManualResetRequest struct {
	CircuitBreakerID string `json:"circuit_breaker_id" binding:"required"`
	Operator         string `json:"operator" binding:"required"`
}

type ForceOpenRequest struct {
	CircuitBreakerID string `json:"circuit_breaker_id" binding:"required"`
	Operator         string `json:"operator" binding:"required"`
	Reason           string `json:"reason" binding:"required"`
}

type ErrorResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type SuccessResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type CircuitCheckResponse struct {
	Allowed          bool   `json:"allowed"`
	Reason           string `json:"reason"`
	CircuitBreakerID string `json:"circuit_breaker_id"`
	State            string `json:"state"`
	IsDuplicate      bool   `json:"is_duplicate"`
}
