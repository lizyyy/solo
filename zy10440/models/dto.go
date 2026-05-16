package models

type CreateJobRequest struct {
	Name        string `json:"name" binding:"required"`
	GPUModel    string `json:"gpu_model" binding:"required"`
	GPUCount    int    `json:"gpu_count" binding:"required,min=1"`
	UserID      string `json:"user_id" binding:"required"`
	Priority    int    `json:"priority" binding:"min=0,max=10"`
	DurationMin int    `json:"duration_min" binding:"required,min=1"`
	RequestID   string `json:"request_id" binding:"required"`
}

type UpdateJobStatusRequest struct {
	Status  JobStatus `json:"status" binding:"required"`
	Remark  string    `json:"remark"`
	Operator string   `json:"operator"`
}

type ManualCorrectionRequest struct {
	GPUModel   string `json:"gpu_model"`
	UsedCount  *int   `json:"used_count,omitempty"`
	TotalCount *int   `json:"total_count,omitempty"`
	Operator   string `json:"operator" binding:"required"`
	Reason     string `json:"reason" binding:"required"`
}

type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type JobListResponse struct {
	Total int64 `json:"total"`
	Jobs  []Job `json:"jobs"`
}

type ExceptionLogListResponse struct {
	Total   int            `json:"total"`
	Records []ExceptionLog `json:"records"`
}
