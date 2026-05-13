package model

type CreatePackageRequest struct {
	Name        string `json:"name" binding:"required"`
	Description string `json:"description"`
	CreatedBy   string `json:"created_by" binding:"required"`
}

type CreateRuleVersionRequest struct {
	PackageID   string                 `json:"package_id" binding:"required"`
	Version     string                 `json:"version" binding:"required"`
	RuleContent map[string]interface{} `json:"rule_content" binding:"required"`
	CreatedBy   string                 `json:"created_by" binding:"required"`
	Remark      string                 `json:"remark"`
}

type UpdateStatusRequest struct {
	TargetStatus Status     `json:"target_status" binding:"required"`
	GrayRange    *GrayRange `json:"gray_range,omitempty"`
	Operator     string     `json:"operator" binding:"required"`
	Remark       string     `json:"remark"`
}

type HitCheckRequest struct {
	PackageID string                 `json:"package_id" binding:"required"`
	Input     map[string]interface{} `json:"input" binding:"required"`
	RequestID string                 `json:"request_id"`
	UserID    string                 `json:"user_id"`
}

type HitCheckResponse struct {
	HitResult   bool               `json:"hit_result"`
	VersionID   string             `json:"version_id"`
	HitRules    []string           `json:"hit_rules,omitempty"`
	Explanation *ExplanationResult `json:"explanation,omitempty"`
}

type AuditQueryRequest struct {
	EntityType string `json:"entity_type"`
	EntityID   string `json:"entity_id"`
	Action     string `json:"action"`
	Page       int    `json:"page"`
	PageSize   int    `json:"page_size"`
}

type ExportRequest struct {
	PackageID  string `json:"package_id" binding:"required"`
	StartTime  string `json:"start_time"`
	EndTime    string `json:"end_time"`
	ExportType string `json:"export_type"`
}

type ExportResult struct {
	Package      *StrategyPackage   `json:"package"`
	Versions     []*RuleVersion      `json:"versions"`
	HitRequests  []*HitRequest      `json:"hit_requests"`
	AuditLogs    []*AuditLog        `json:"audit_logs"`
	ExportedAt   string             `json:"exported_at"`
	Summary      map[string]int     `json:"summary"`
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func NewSuccessResponse(data interface{}) *Response {
	return &Response{
		Code:    0,
		Message: "success",
		Data:    data,
	}
}

func NewErrorResponse(code int, message string) *Response {
	return &Response{
		Code:    code,
		Message: message,
	}
}
