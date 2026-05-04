package validator_test

import (
	"os"
	"path/filepath"
	"testing"

	"msctl/internal/models"
	"msctl/internal/validator"
)

func TestValidator_ValidateWorkspace(t *testing.T) {
	v := validator.NewValidator()

	t.Run("valid workspace", func(t *testing.T) {
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
					},
				},
			},
			CallEdges: []models.CallEdge{},
			Owners: map[string]models.Owner{
				"user-service": {
					ServiceName: "user-service",
					Primary:     "owner1",
					Team:        "team1",
				},
			},
			Policies: []models.Policy{
				{
					ServiceName: "user-service",
					SLO: models.SLOConfig{
						Availability: 0.999,
						LatencyP99:   200,
						LatencyP95:   100,
					},
					RateLimit: models.RateLimitConfig{
						MaxRequests:   10000,
						WindowSeconds: 60,
					},
				},
			},
		}

		result, err := v.ValidateWorkspace(ws)
		if err != nil {
			t.Errorf("ValidateWorkspace failed: %v", err)
		}
		if !result.Valid {
			t.Error("Valid workspace should be valid")
		}
	})

	t.Run("invalid service name", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"invalid@service": {
					Name:    "invalid@service",
					Version: "1.0.0",
				},
			},
			CallEdges: []models.CallEdge{},
			Owners:    map[string]models.Owner{},
			Policies:  []models.Policy{},
		}

		result, err := v.ValidateWorkspace(ws)
		if err != nil {
			t.Errorf("ValidateWorkspace failed: %v", err)
		}
		if result.Valid {
			t.Error("Workspace with invalid service name should not be valid")
		}
		if result.ErrorCount == 0 {
			t.Error("Should have at least one error")
		}
	})

	t.Run("missing required field in endpoint", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"test-service": {
					Name:    "test-service",
					Version: "1.0.0",
					Endpoints: []models.Endpoint{
						{
							Method: "",
							Path:   "/api/test",
						},
					},
				},
			},
			CallEdges: []models.CallEdge{},
			Owners:    map[string]models.Owner{},
			Policies:  []models.Policy{},
		}

		result, err := v.ValidateWorkspace(ws)
		if err != nil {
			t.Errorf("ValidateWorkspace failed: %v", err)
		}
		if result.Valid {
			t.Error("Workspace with missing method should not be valid")
		}
	})

	t.Run("invalid HTTP method", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"test-service": {
					Name:    "test-service",
					Version: "1.0.0",
					Endpoints: []models.Endpoint{
						{
							Method: "INVALID",
							Path:   "/api/test",
						},
					},
				},
			},
			CallEdges: []models.CallEdge{},
			Owners:    map[string]models.Owner{},
			Policies:  []models.Policy{},
		}

		result, err := v.ValidateWorkspace(ws)
		if err != nil {
			t.Errorf("ValidateWorkspace failed: %v", err)
		}
		if result.Valid {
			t.Error("Workspace with invalid HTTP method should not be valid")
		}
	})

	t.Run("invalid path format", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"test-service": {
					Name:    "test-service",
					Version: "1.0.0",
					Endpoints: []models.Endpoint{
						{
							Method: "GET",
							Path:   "api/test",
						},
					},
				},
			},
			CallEdges: []models.CallEdge{},
			Owners:    map[string]models.Owner{},
			Policies:  []models.Policy{},
		}

		result, err := v.ValidateWorkspace(ws)
		if err != nil {
			t.Errorf("ValidateWorkspace failed: %v", err)
		}
		if result.Valid {
			t.Error("Workspace with invalid path should not be valid")
		}
	})
}

func TestValidator_ValidateFile(t *testing.T) {
	v := validator.NewValidator()

	t.Run("valid YAML file", func(t *testing.T) {
		tmpDir := t.TempDir()
		testFile := filepath.Join(tmpDir, "test.yaml")

		content := `
name: test
value: 42
`
		os.WriteFile(testFile, []byte(content), 0644)

		result, err := v.ValidateFile(testFile)
		if err != nil {
			t.Errorf("ValidateFile failed: %v", err)
		}
		if !result.Valid {
			t.Error("Valid YAML file should be valid")
		}
	})

	t.Run("invalid YAML file", func(t *testing.T) {
		tmpDir := t.TempDir()
		testFile := filepath.Join(tmpDir, "invalid.yaml")

		content := `
name: test
  value: 42
`
		os.WriteFile(testFile, []byte(content), 0644)

		result, err := v.ValidateFile(testFile)
		if err != nil {
			t.Errorf("ValidateFile failed: %v", err)
		}
		if result.Valid {
			t.Error("Invalid YAML file should not be valid")
		}
	})

	t.Run("valid CSV file", func(t *testing.T) {
		tmpDir := t.TempDir()
		testFile := filepath.Join(tmpDir, "test.csv")

		content := `name,value
test,100
`
		os.WriteFile(testFile, []byte(content), 0644)

		result, err := v.ValidateFile(testFile)
		if err != nil {
			t.Errorf("ValidateFile failed: %v", err)
		}
		if !result.Valid {
			t.Error("Valid CSV file should be valid")
		}
	})
}

func TestValidator_ValidatePolicies(t *testing.T) {
	v := validator.NewValidator()

	t.Run("invalid SLO availability", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"test-service": {
					Name:    "test-service",
					Version: "1.0.0",
				},
			},
			CallEdges: []models.CallEdge{},
			Owners:    map[string]models.Owner{},
			Policies: []models.Policy{
				{
					ServiceName: "test-service",
					SLO: models.SLOConfig{
						Availability: 1.5,
					},
					RateLimit: models.RateLimitConfig{
						MaxRequests:   1000,
						WindowSeconds: 60,
					},
				},
			},
		}

		result, err := v.ValidateWorkspace(ws)
		if err != nil {
			t.Errorf("ValidateWorkspace failed: %v", err)
		}
		if result.Valid {
			t.Error("Workspace with invalid SLO availability should not be valid")
		}
	})

	t.Run("negative rate limit", func(t *testing.T) {
		ws := &models.Workspace{
			Services: map[string]models.Service{
				"test-service": {
					Name:    "test-service",
					Version: "1.0.0",
				},
			},
			CallEdges: []models.CallEdge{},
			Owners:    map[string]models.Owner{},
			Policies: []models.Policy{
				{
					ServiceName: "test-service",
					SLO: models.SLOConfig{
						Availability: 0.999,
					},
					RateLimit: models.RateLimitConfig{
						MaxRequests:   -1000,
						WindowSeconds: 60,
					},
				},
			},
		}

		result, err := v.ValidateWorkspace(ws)
		if err != nil {
			t.Errorf("ValidateWorkspace failed: %v", err)
		}
		if result.Valid {
			t.Error("Workspace with negative rate limit should not be valid")
		}
	})
}
