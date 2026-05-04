package service

import (
	"encoding/json"
	"os"
	"testing"

	"config-manager/internal/model"
	"config-manager/internal/store"
)

func setupTestDB(t *testing.T) (*store.Store, func()) {
	dbPath := "test_config.db"
	st, err := store.NewStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}

	cleanup := func() {
		st.Close()
		os.Remove(dbPath)
		os.Remove(dbPath + "-shm")
		os.Remove(dbPath + "-wal")
	}

	return st, cleanup
}

func TestValidateConfigValue(t *testing.T) {
	st, cleanup := setupTestDB(t)
	defer cleanup()

	cs := NewConfigService(st)

	schema := json.RawMessage(`{
		"type": "object",
		"properties": {
			"max_qps": {"type": "integer"},
			"window_sec": {"type": "integer"}
		},
		"required": ["max_qps", "window_sec"]
	}`)

	t.Run("valid config", func(t *testing.T) {
		value := json.RawMessage(`{"max_qps": 100, "window_sec": 60}`)
		result, err := cs.ValidateConfigValue(schema, value)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if !result.Valid {
			t.Error("Expected valid, got invalid")
		}
	})

	t.Run("missing required field", func(t *testing.T) {
		value := json.RawMessage(`{"max_qps": 100}`)
		result, err := cs.ValidateConfigValue(schema, value)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if result.Valid {
			t.Error("Expected invalid, got valid")
		}
		if len(result.Errors) == 0 {
			t.Error("Expected validation errors")
		}
	})

	t.Run("wrong type", func(t *testing.T) {
		value := json.RawMessage(`{"max_qps": "invalid", "window_sec": 60}`)
		result, err := cs.ValidateConfigValue(schema, value)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if result.Valid {
			t.Error("Expected invalid, got valid")
		}
	})
}

func TestGrayRuleValidation(t *testing.T) {
	t.Run("valid percentage", func(t *testing.T) {
		rule := &model.GrayRule{Percentage: 50}
		if err := rule.Validate(); err != nil {
			t.Errorf("Expected no error for 50%%, got %v", err)
		}
	})

	t.Run("zero percentage", func(t *testing.T) {
		rule := &model.GrayRule{Percentage: 0}
		if err := rule.Validate(); err != nil {
			t.Errorf("Expected no error for 0%%, got %v", err)
		}
	})

	t.Run("100 percentage", func(t *testing.T) {
		rule := &model.GrayRule{Percentage: 100}
		if err := rule.Validate(); err != nil {
			t.Errorf("Expected no error for 100%%, got %v", err)
		}
	})

	t.Run("negative percentage", func(t *testing.T) {
		rule := &model.GrayRule{Percentage: -1}
		if err := rule.Validate(); err == nil {
			t.Error("Expected error for negative percentage")
		}
	})

	t.Run("percentage over 100", func(t *testing.T) {
		rule := &model.GrayRule{Percentage: 150}
		if err := rule.Validate(); err == nil {
			t.Error("Expected error for percentage over 100")
		}
	})
}

func TestMatchesGrayRule(t *testing.T) {
	st, cleanup := setupTestDB(t)
	defer cleanup()

	cs := NewConfigService(st)

	client := &model.Client{
		TenantID: "t_001",
		Region:   "zh_CN",
		ClientID: "client_123",
	}

	t.Run("nil rule - always match", func(t *testing.T) {
		if !cs.MatchesGrayRule(client, nil) {
			t.Error("Expected match with nil rule")
		}
	})

	t.Run("tenant filter - match", func(t *testing.T) {
		rule := &model.GrayRule{
			TenantIDs: []string{"t_001", "t_002"},
			Percentage: 100,
		}
		if !cs.MatchesGrayRule(client, rule) {
			t.Error("Expected match for t_001 tenant")
		}
	})

	t.Run("tenant filter - no match", func(t *testing.T) {
		rule := &model.GrayRule{
			TenantIDs: []string{"t_003"},
			Percentage: 100,
		}
		if cs.MatchesGrayRule(client, rule) {
			t.Error("Expected no match for t_003 tenant filter")
		}
	})

	t.Run("region filter - match", func(t *testing.T) {
		rule := &model.GrayRule{
			Regions:    []string{"zh_CN", "en_US"},
			Percentage: 100,
		}
		if !cs.MatchesGrayRule(client, rule) {
			t.Error("Expected match for zh_CN region")
		}
	})

	t.Run("region filter - no match", func(t *testing.T) {
		rule := &model.GrayRule{
			Regions:    []string{"jp_JP"},
			Percentage: 100,
		}
		if cs.MatchesGrayRule(client, rule) {
			t.Error("Expected no match for jp_JP region filter")
		}
	})
}

func TestCreateVersion(t *testing.T) {
	st, cleanup := setupTestDB(t)
	defer cleanup()

	cs := NewConfigService(st)

	tenant := &model.Tenant{ID: "t_test", Name: "Test Tenant"}
	st.CreateTenant(tenant)

	service := &model.Service{ID: "s_test", TenantID: "t_test", Name: "Test Service"}
	st.CreateService(service)

	schema := json.RawMessage(`{"type":"object","properties":{"enabled":{"type":"boolean"}},"required":["enabled"]}`)
	config := &model.ConfigItem{
		ID:          "c_test",
		TenantID:    "t_test",
		ServiceID:   "s_test",
		Key:         "test_feature",
		Description: "Test feature",
		Schema:      schema,
	}
	st.CreateConfigItem(config)

	t.Run("create valid version", func(t *testing.T) {
		value := json.RawMessage(`{"enabled": true}`)
		version, err := cs.CreateVersion("c_test", value, "test_user")
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if version.Version != 1 {
			t.Errorf("Expected version 1, got %d", version.Version)
		}
		if version.Status != "draft" {
			t.Errorf("Expected status draft, got %s", version.Status)
		}
	})

	t.Run("create invalid version", func(t *testing.T) {
		value := json.RawMessage(`{"enabled": "not_boolean"}`)
		_, err := cs.CreateVersion("c_test", value, "test_user")
		if err == nil {
			t.Error("Expected validation error")
		}
	})

	t.Run("create second version", func(t *testing.T) {
		value := json.RawMessage(`{"enabled": false}`)
		version, err := cs.CreateVersion("c_test", value, "test_user")
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if version.Version != 2 {
			t.Errorf("Expected version 2, got %d", version.Version)
		}
	})
}

func TestReportExport(t *testing.T) {
	st, cleanup := setupTestDB(t)
	defer cleanup()

	cs := NewConfigService(st)

	report := &model.ReleaseReport{
		ReleaseID:   "r_test",
		ReleaseName: "Test Release",
		TenantID:    "t_001",
		ServiceID:   "s_001",
		Status:      string(model.ReleaseStatusCompleted),
		GrayRule: &model.GrayRule{
			Percentage: 100,
		},
		ChangeSummary: []model.ReportItem{
			{
				ConfigKey:    "rate_limit",
				Status:       "published",
				OldVersion:   1,
				NewVersion:   2,
				HitClients:   5,
				TotalClients: 10,
				HitPercentage: 50.0,
			},
		},
		CreatedBy: "test_user",
	}

	t.Run("export JSON", func(t *testing.T) {
		jsonStr, err := cs.ExportReportJSON(report)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if jsonStr == "" {
			t.Error("Expected non-empty JSON")
		}

		var parsed model.ReleaseReport
		if err := json.Unmarshal([]byte(jsonStr), &parsed); err != nil {
			t.Errorf("Failed to parse JSON: %v", err)
		}
		if parsed.ReleaseID != "r_test" {
			t.Errorf("Expected release_id r_test, got %s", parsed.ReleaseID)
		}
	})

	t.Run("export Markdown", func(t *testing.T) {
		md, err := cs.ExportReportMarkdown(report)
		if err != nil {
			t.Fatalf("Expected no error, got %v", err)
		}
		if md == "" {
			t.Error("Expected non-empty Markdown")
		}
		if !contains(md, "Test Release") {
			t.Error("Expected release name in Markdown")
		}
		if !contains(md, "rate_limit") {
			t.Error("Expected config key in Markdown")
		}
	})
}

func contains(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
