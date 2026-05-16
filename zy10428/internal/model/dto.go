package model

type CreateRuleRequest struct {
	Name        string                 `json:"name" binding:"required"`
	Description string                 `json:"description"`
	PathPattern string                 `json:"path_pattern" binding:"required"`
	Method      string                 `json:"method"`
	RewriteTo   string                 `json:"rewrite_to"`
	Headers     map[string]interface{} `json:"headers"`
}

type CreateSampleRequest struct {
	Path         string                 `json:"path" binding:"required"`
	Method       string                 `json:"method" binding:"required"`
	Headers      map[string]interface{} `json:"headers"`
	Body         string                 `json:"body"`
	ExpectedPath string                 `json:"expected_path"`
	ExpectedCode int                    `json:"expected_code"`
	Source       string                 `json:"source"`
}

type CreateBatchRequest struct {
	Name    string   `json:"name" binding:"required"`
	RuleIDs []string `json:"rule_ids" binding:"required"`
}

type ExecuteBatchRequest struct {
	BatchID string `json:"batch_id" binding:"required"`
}

type CorrectResultRequest struct {
	ResultID   string `json:"result_id" binding:"required"`
	IsCorrected bool  `json:"is_corrected"`
	Remark     string `json:"remark"`
}

type ExportReportRequest struct {
	BatchID string `json:"batch_id" binding:"required"`
	Format  string `json:"format"`
}

type BatchStatusUpdateRequest struct {
	BatchID string `json:"batch_id" binding:"required"`
	Status  string `json:"status" binding:"required"`
}

type APIResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type PaginationRequest struct {
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

type PaginationResponse struct {
	Total    int         `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
	Items    interface{} `json:"items"`
}
