package models

type PlanResult struct {
	Title            string               `json:"title"`
	Date             string               `json:"date"`
	Admission        AdmissionStatus      `json:"admission"`
	AdmissionReason  string               `json:"admission_reason"`
	BlockingIssues   []BlockingIssue      `json:"blocking_issues"`
	Warnings         []WarningIssue       `json:"warnings"`
	RecommendedOrder []OrderedBatch       `json:"recommended_order"`
	AffectedServices []AffectedService    `json:"affected_services"`
	RollbackImpact   RollbackImpactReport `json:"rollback_impact"`
}

type AdmissionStatus string

const (
	AdmissionApproved AdmissionStatus = "APPROVED"
	AdmissionRejected AdmissionStatus = "REJECTED"
	AdmissionWarning  AdmissionStatus = "WARNING"
)

type BlockingIssue struct {
	ID          string   `json:"id"`
	IssueType   string   `json:"issue_type"`
	Severity    Severity `json:"severity"`
	Services    []string `json:"services"`
	Description string   `json:"description"`
	Evidence    string   `json:"evidence"`
	Resolution  string   `json:"resolution"`
}

type WarningIssue struct {
	ID             string   `json:"id"`
	IssueType      string   `json:"issue_type"`
	Severity       Severity `json:"severity"`
	Services       []string `json:"services"`
	Description    string   `json:"description"`
	Evidence       string   `json:"evidence"`
	Recommendation string   `json:"recommendation"`
}

type OrderedBatch struct {
	OriginalName  string   `json:"original_name"`
	OriginalOrder int      `json:"original_order"`
	NewOrder      int      `json:"new_order"`
	Services      []string `json:"services"`
	Reason        string   `json:"reason"`
}

type AffectedService struct {
	Name              string   `json:"name"`
	DeployBatch       string   `json:"deploy_batch"`
	DirectCallers     []string `json:"direct_callers"`
	DirectCallees     []string `json:"direct_callees"`
	TransitiveCallers []string `json:"transitive_callers"`
	TransitiveCallees []string `json:"transitive_callees"`
	RiskLevel         string   `json:"risk_level"`
}

type RollbackImpactReport struct {
	TotalAffectedServices int                      `json:"total_affected_services"`
	RollbackOrder         []string                 `json:"rollback_order"`
	ServiceImpacts        map[string]ServiceImpact `json:"service_impacts"`
	EstimatedDowntime     string                   `json:"estimated_downtime"`
}

type ServiceImpact struct {
	ServiceName        string   `json:"service_name"`
	ImpactLevel        string   `json:"impact_level"`
	DirectDependencies []string `json:"direct_dependencies"`
	FailedEndpoints    []string `json:"failed_endpoints"`
}
