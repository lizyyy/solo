package models

type IssueType string

const (
	IssueBreakingChange    IssueType = "breaking_change"
	IssueUndeclaredCall    IssueType = "undeclared_call"
	IssueOrphanEndpoint    IssueType = "orphan_endpoint"
	IssueDependencyCycle   IssueType = "dependency_cycle"
	IssueMissingOwner      IssueType = "missing_owner"
	IssuePolicyMismatch    IssueType = "policy_mismatch"
	IssueInvalidSchema     IssueType = "invalid_schema"
	IssueMissingDependency IssueType = "missing_dependency"
	IssueDuplicateService  IssueType = "duplicate_service"
	IssueInvalidEndpoint   IssueType = "invalid_endpoint"
	IssueMissingField      IssueType = "missing_field"
	IssueInvalidValue      IssueType = "invalid_value"
)

type Severity string

const (
	SeverityCritical Severity = "CRITICAL"
	SeverityHigh     Severity = "HIGH"
	SeverityMedium   Severity = "MEDIUM"
	SeverityLow      Severity = "LOW"
)

type Issue struct {
	ID             string    `json:"id"`
	Type           IssueType `json:"type"`
	Severity       Severity  `json:"severity"`
	ServiceName    string    `json:"service_name,omitempty"`
	Endpoint       string    `json:"endpoint,omitempty"`
	FieldPath      string    `json:"field_path,omitempty"`
	Message        string    `json:"message"`
	Evidence       string    `json:"evidence"`
	Recommendation string    `json:"recommendation"`
	RelatedIssues  []string  `json:"related_issues,omitempty"`
}

type AnalysisResult struct {
	Summary       AnalysisSummary  `json:"summary"`
	Issues        []Issue          `json:"issues"`
	ServiceGraph  ServiceGraph     `json:"service_graph"`
	ContractDiffs []ContractDiff   `json:"contract_diffs,omitempty"`
	OwnershipMap  map[string]Owner `json:"ownership_map"`
	PolicySummary PolicySummary    `json:"policy_summary"`
}

type AnalysisSummary struct {
	TotalServices    int              `json:"total_services"`
	TotalEndpoints   int              `json:"total_endpoints"`
	TotalCallEdges   int              `json:"total_call_edges"`
	IssuesBySeverity map[Severity]int `json:"issues_by_severity"`
	CriticalCount    int              `json:"critical_count"`
	HighCount        int              `json:"high_count"`
	MediumCount      int              `json:"medium_count"`
	LowCount         int              `json:"low_count"`
	Passed           bool             `json:"passed"`
}

type ServiceGraph struct {
	Nodes  []ServiceNode `json:"nodes"`
	Edges  []GraphEdge   `json:"edges"`
	Cycles [][]string    `json:"cycles,omitempty"`
}

type ServiceNode struct {
	Name          string   `json:"name"`
	Version       string   `json:"version"`
	Tags          []string `json:"tags"`
	EndpointCount int      `json:"endpoint_count"`
}

type GraphEdge struct {
	Source    string `json:"source"`
	Target    string `json:"target"`
	Endpoint  string `json:"endpoint"`
	Method    string `json:"method"`
	CallCount int    `json:"call_count"`
}

type ContractDiff struct {
	ServiceName string       `json:"service_name"`
	OldVersion  string       `json:"old_version"`
	NewVersion  string       `json:"new_version"`
	Changes     []ChangeItem `json:"changes"`
	Breaking    bool         `json:"breaking"`
}

type ChangeItem struct {
	Type        string `json:"type"`
	Path        string `json:"path"`
	Field       string `json:"field"`
	OldValue    string `json:"old_value"`
	NewValue    string `json:"new_value"`
	Breaking    bool   `json:"breaking"`
	Description string `json:"description"`
}

type PolicySummary struct {
	PoliciesWithSLO       int `json:"policies_with_slo"`
	PoliciesWithRateLimit int `json:"policies_with_rate_limit"`
	MatchingPolicies      int `json:"matching_policies"`
	MismatchingPolicies   int `json:"mismatching_policies"`
}
