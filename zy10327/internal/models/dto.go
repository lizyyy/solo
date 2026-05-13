package models

type CreateMigrationRequest struct {
	TenantID       string `json:"tenant_id" binding:"required"`
	SourceClusterID string `json:"source_cluster_id" binding:"required"`
	TargetClusterID string `json:"target_cluster_id" binding:"required"`
	Operator       string `json:"operator"`
}

type CreateMigrationResponse struct {
	TaskID        string          `json:"task_id"`
	Status        MigrationStatus `json:"status"`
	CurrentPhase  string          `json:"current_phase"`
}

type ValidateMigrationRequest struct {
	TaskID   string `json:"task_id" binding:"required"`
	Operator string `json:"operator"`
}

type ValidateMigrationResponse struct {
	TaskID        string      `json:"task_id"`
	Status        CheckStatus `json:"status"`
	TotalChecks   int         `json:"total_checks"`
	PassedChecks  int         `json:"passed_checks"`
	FailedChecks  int         `json:"failed_checks"`
	CheckItems    []CheckItem `json:"check_items"`
}

type AdvanceStatusRequest struct {
	TaskID     string `json:"task_id" binding:"required"`
	TargetPhase string `json:"target_phase" binding:"required"`
	Operator    string `json:"operator"`
	Remark      string `json:"remark"`
}

type AdvanceStatusResponse struct {
	TaskID      string          `json:"task_id"`
	PrevStatus  MigrationStatus `json:"prev_status"`
	CurrStatus  MigrationStatus `json:"curr_status"`
	CurrentPhase string          `json:"current_phase"`
}

type RollbackRequest struct {
	TaskID          string `json:"task_id" binding:"required"`
	RollbackPointID string `json:"rollback_point_id"`
	Operator        string `json:"operator"`
	Reason          string `json:"reason"`
}

type RollbackResponse struct {
	TaskID         string          `json:"task_id"`
	Status         MigrationStatus `json:"status"`
	RollbackPointID string          `json:"rollback_point_id"`
}

type GetMigrationTaskResponse struct {
	MigrationTask
	CheckItems     []CheckItem      `json:"check_items"`
	RollbackPoints []RollbackPoint `json:"rollback_points"`
	Histories      []MigrationHistory `json:"histories"`
}

type ListMigrationTasksRequest struct {
	TenantID string `json:"tenant_id"`
	Status   string `json:"status"`
	Page     int    `json:"page"`
	PageSize int    `json:"page_size"`
}

type ListMigrationTasksResponse struct {
	Total  int             `json:"total"`
	Page   int             `json:"page"`
	Size   int             `json:"size"`
	Tasks  []MigrationTask `json:"tasks"`
}

type GetHistoryResponse struct {
	TaskID    string             `json:"task_id"`
	Histories []MigrationHistory `json:"histories"`
}

type GetValidationReportResponse struct {
	TaskID      string           `json:"task_id"`
	ReportType  string           `json:"report_type"`
	Report      ValidationReport `json:"report"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}
