package analyzer_test

import (
	"testing"

	"msctl/internal/analyzer"
	"msctl/internal/models"
)

func TestAnalyzer_Analyze(t *testing.T) {
	a := analyzer.NewAnalyzer()

	t.Run("basic analysis", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"user-service": {
					Name:    "user-service",
					Version: "1.0.0",
					Endpoints: []models.Endpoint{
						{
							Method: "GET",
							Path:   "/api/v1/users",
							Parameters: []models.Parameter{
								{
									Name:     "id",
									In:       "query",
									Required: true,
									Schema: models.Schema{
										Type: "string",
									},
								},
							},
						},
					},
				},
				"order-service": {
					Name:    "order-service",
					Version: "1.0.0",
					Endpoints: []models.Endpoint{
						{
							Method: "GET",
							Path:   "/api/v1/orders",
						},
					},
				},
			},
			CallEdges: []models.CallEdge{
				{
					SourceService: "order-service",
					TargetService: "user-service",
					Method:        "GET",
					Path:          "/api/v1/users",
				},
			},
			Owners: map[string]models.Owner{
				"user-service": {
					ServiceName: "user-service",
					Primary:     "owner1",
				},
				"order-service": {
					ServiceName: "order-service",
					Primary:     "owner2",
				},
			},
			Policies: []models.Policy{
				{
					ServiceName: "user-service",
					SLO: models.SLOConfig{
						Availability: 0.999,
					},
					RateLimit: models.RateLimitConfig{
						MaxRequests:   10000,
						WindowSeconds: 60,
					},
				},
			},
		}

		result, err := a.Analyze(ws)
		if err != nil {
			t.Errorf("Analyze failed: %v", err)
		}

		if result.Summary.TotalServices != 2 {
			t.Errorf("Expected 2 services, got %d", result.Summary.TotalServices)
		}

		if len(result.ServiceGraph.Nodes) != 2 {
			t.Errorf("Expected 2 nodes, got %d", len(result.ServiceGraph.Nodes))
		}

		if len(result.ServiceGraph.Edges) != 1 {
			t.Errorf("Expected 1 edge, got %d", len(result.ServiceGraph.Edges))
		}
	})

	t.Run("detect orphan endpoints", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"user-service": {
					Name:    "user-service",
					Version: "1.0.0",
					Endpoints: []models.Endpoint{
						{
							Method: "GET",
							Path:   "/api/v1/users",
						},
						{
							Method:     "GET",
							Path:       "/api/v1/users/legacy",
							Deprecated: false,
						},
					},
				},
			},
			CallEdges: []models.CallEdge{
				{
					SourceService: "external",
					TargetService: "user-service",
					Method:        "GET",
					Path:          "/api/v1/users",
				},
			},
			Owners:   map[string]models.Owner{},
			Policies: []models.Policy{},
		}

		result, err := a.Analyze(ws)
		if err != nil {
			t.Errorf("Analyze failed: %v", err)
		}

		hasOrphanIssue := false
		for _, issue := range result.Issues {
			if issue.Type == models.IssueOrphanEndpoint {
				hasOrphanIssue = true
				break
			}
		}
		if !hasOrphanIssue {
			t.Error("Should have detected orphan endpoint")
		}
	})

	t.Run("detect missing owners", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"user-service": {
					Name:    "user-service",
					Version: "1.0.0",
				},
				"order-service": {
					Name:    "order-service",
					Version: "1.0.0",
				},
			},
			CallEdges: []models.CallEdge{},
			Owners: map[string]models.Owner{
				"user-service": {
					ServiceName: "user-service",
					Primary:     "owner1",
				},
			},
			Policies: []models.Policy{},
		}

		result, err := a.Analyze(ws)
		if err != nil {
			t.Errorf("Analyze failed: %v", err)
		}

		hasMissingOwner := false
		for _, issue := range result.Issues {
			if issue.Type == models.IssueMissingOwner {
				hasMissingOwner = true
				break
			}
		}
		if !hasMissingOwner {
			t.Error("Should have detected missing owner")
		}
	})

	t.Run("detect dependency cycle", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"service-a": {
					Name:    "service-a",
					Version: "1.0.0",
				},
				"service-b": {
					Name:    "service-b",
					Version: "1.0.0",
				},
				"service-c": {
					Name:    "service-c",
					Version: "1.0.0",
				},
			},
			CallEdges: []models.CallEdge{
				{
					SourceService: "service-a",
					TargetService: "service-b",
					Method:        "GET",
					Path:          "/api/b",
				},
				{
					SourceService: "service-b",
					TargetService: "service-c",
					Method:        "GET",
					Path:          "/api/c",
				},
				{
					SourceService: "service-c",
					TargetService: "service-a",
					Method:        "GET",
					Path:          "/api/a",
				},
			},
			Owners:   map[string]models.Owner{},
			Policies: []models.Policy{},
		}

		result, err := a.Analyze(ws)
		if err != nil {
			t.Errorf("Analyze failed: %v", err)
		}

		if len(result.ServiceGraph.Cycles) == 0 {
			t.Error("Should have detected dependency cycle")
		}

		hasCycleIssue := false
		for _, issue := range result.Issues {
			if issue.Type == models.IssueDependencyCycle {
				hasCycleIssue = true
				break
			}
		}
		if !hasCycleIssue {
			t.Error("Should have cycle issue in Issues")
		}
	})

	t.Run("detect undeclared calls", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"service-a": {
					Name:    "service-a",
					Version: "1.0.0",
				},
				"service-b": {
					Name:    "service-b",
					Version: "1.0.0",
					Endpoints: []models.Endpoint{
						{
							Method: "GET",
							Path:   "/api/declared",
						},
					},
				},
			},
			CallEdges: []models.CallEdge{
				{
					SourceService: "service-a",
					TargetService: "service-b",
					Method:        "GET",
					Path:          "/api/undeclared",
				},
			},
			Owners:   map[string]models.Owner{},
			Policies: []models.Policy{},
		}

		result, err := a.Analyze(ws)
		if err != nil {
			t.Errorf("Analyze failed: %v", err)
		}

		hasUndeclaredCall := false
		for _, issue := range result.Issues {
			if issue.Type == models.IssueUndeclaredCall {
				hasUndeclaredCall = true
				break
			}
		}
		if !hasUndeclaredCall {
			t.Error("Should have detected undeclared call")
		}
	})
}

func TestSortIssuesBySeverity(t *testing.T) {
	issues := []models.Issue{
		{Severity: models.SeverityLow},
		{Severity: models.SeverityCritical},
		{Severity: models.SeverityMedium},
		{Severity: models.SeverityHigh},
	}

	sorted := analyzer.SortIssuesBySeverity(issues)

	if sorted[0].Severity != models.SeverityCritical {
		t.Error("First issue should be CRITICAL")
	}
	if sorted[1].Severity != models.SeverityHigh {
		t.Error("Second issue should be HIGH")
	}
	if sorted[2].Severity != models.SeverityMedium {
		t.Error("Third issue should be MEDIUM")
	}
	if sorted[3].Severity != models.SeverityLow {
		t.Error("Fourth issue should be LOW")
	}
}

func TestGetIssueTypeLabel(t *testing.T) {
	tests := []struct {
		issueType models.IssueType
		expected  string
	}{
		{models.IssueBreakingChange, "破坏性契约变更"},
		{models.IssueUndeclaredCall, "未声明调用"},
		{models.IssueOrphanEndpoint, "孤儿接口"},
		{models.IssueDependencyCycle, "依赖环"},
		{models.IssueMissingOwner, "Owner 缺失"},
		{models.IssuePolicyMismatch, "策略不匹配"},
	}

	for _, test := range tests {
		actual := analyzer.GetIssueTypeLabel(test.issueType)
		if actual != test.expected {
			t.Errorf("GetIssueTypeLabel(%v) = %q, expected %q", test.issueType, actual, test.expected)
		}
	}
}

func TestGetSeverityColor(t *testing.T) {
	tests := []struct {
		severity models.Severity
		expected string
	}{
		{models.SeverityCritical, "🔴"},
		{models.SeverityHigh, "🟠"},
		{models.SeverityMedium, "🟡"},
		{models.SeverityLow, "🟢"},
	}

	for _, test := range tests {
		actual := analyzer.GetSeverityColor(test.severity)
		if actual != test.expected {
			t.Errorf("GetSeverityColor(%v) = %q, expected %q", test.severity, actual, test.expected)
		}
	}
}
