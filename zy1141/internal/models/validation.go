package models

type ValidationError struct {
	File         string `json:"file"`
	Line         int    `json:"line,omitempty"`
	FieldPath    string `json:"field_path"`
	ErrorMessage string `json:"error_message"`
	Suggestion   string `json:"suggestion,omitempty"`
}

type ValidationResult struct {
	Valid      bool              `json:"valid"`
	ErrorCount int               `json:"error_count"`
	Errors     []ValidationError `json:"errors,omitempty"`
	Warnings   []ValidationError `json:"warnings,omitempty"`
}

type ExportReport struct {
	ReportType     string          `json:"report_type"`
	GeneratedAt    string          `json:"generated_at"`
	WorkspaceName  string          `json:"workspace_name"`
	AnalysisResult *AnalysisResult `json:"analysis_result,omitempty"`
	PlanResult     *PlanResult     `json:"plan_result,omitempty"`
	Summary        ReportSummary   `json:"summary"`
}

type ReportSummary struct {
	TotalServices      int      `json:"total_services"`
	TotalEndpoints     int      `json:"total_endpoints"`
	TotalIssues        int      `json:"total_issues"`
	CriticalIssues     int      `json:"critical_issues"`
	HighIssues         int      `json:"high_issues"`
	RecommendedActions []string `json:"recommended_actions"`
}
