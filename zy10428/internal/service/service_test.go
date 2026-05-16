package service

import (
	"encoding/json"
	"os"
	"path/filepath"
	"shadow-test-api/internal/model"
	"shadow-test-api/internal/storage"
	"testing"

	"github.com/google/uuid"
)

func setupTestService(t *testing.T) *ShadowTestService {
	dbPath := "test_" + uuid.NewString() + ".db"
	store, err := storage.NewStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	return NewShadowTestService(store)
}

func cleanupTestService(t *testing.T) {
	files, _ := filepath.Glob("test_*.db")
	for _, f := range files {
		os.Remove(f)
	}
}

func TestCreateRule(t *testing.T) {
	defer cleanupTestService(t)
	svc := setupTestService(t)

	req := &model.CreateRuleRequest{
		Name:        "Test Rule",
		Description: "Test Description",
		PathPattern: "/api/*",
		Method:      "GET",
		RewriteTo:   "/service/$1",
	}

	rule, err := svc.CreateRule(req)
	if err != nil {
		t.Fatalf("CreateRule failed: %v", err)
	}

	if rule.ID == "" {
		t.Error("Expected rule ID to be set")
	}
	if rule.Name != req.Name {
		t.Errorf("Expected name %s, got %s", req.Name, rule.Name)
	}
}

func TestCreateSampleRequest(t *testing.T) {
	defer cleanupTestService(t)
	svc := setupTestService(t)

	req := &model.CreateSampleRequest{
		Path:         "/api/users",
		Method:       "GET",
		ExpectedPath: "/service/users",
		ExpectedCode: 200,
		Source:       "test",
	}

	sample, err := svc.CreateSampleRequest(req)
	if err != nil {
		t.Fatalf("CreateSampleRequest failed: %v", err)
	}

	if sample.ID == "" {
		t.Error("Expected sample ID to be set")
	}
	if sample.Path != req.Path {
		t.Errorf("Expected path %s, got %s", req.Path, sample.Path)
	}
}

func TestBatchLifecycle(t *testing.T) {
	defer cleanupTestService(t)
	svc := setupTestService(t)

	ruleReq := &model.CreateRuleRequest{
		Name:        "Test Rule",
		PathPattern: "/api/*",
		Method:      "GET",
		RewriteTo:   "/service/$1",
	}
	rule, _ := svc.CreateRule(ruleReq)

	sampleReq := &model.CreateSampleRequest{
		Path:         "/api/users",
		Method:       "GET",
		ExpectedPath: "/service/users",
		ExpectedCode: 200,
	}
	_, _ = svc.CreateSampleRequest(sampleReq)

	batchReq := &model.CreateBatchRequest{
		Name:    "Test Batch",
		RuleIDs: []string{rule.ID},
	}
	batch, err := svc.CreateBatch(batchReq)
	if err != nil {
		t.Fatalf("CreateBatch failed: %v", err)
	}

	if batch.Status != "pending" {
		t.Errorf("Expected status pending, got %s", batch.Status)
	}

	err = svc.ExecuteBatch(batch.ID)
	if err != nil {
		t.Fatalf("ExecuteBatch failed: %v", err)
	}

	updatedBatch, _ := svc.GetBatch(batch.ID)
	if updatedBatch.Status != "completed" {
		t.Errorf("Expected status completed, got %s", updatedBatch.Status)
	}

	if updatedBatch.TotalCount != 1 {
		t.Errorf("Expected total count 1, got %d", updatedBatch.TotalCount)
	}
}

func TestRuleMatching(t *testing.T) {
	defer cleanupTestService(t)
	svc := setupTestService(t)

	testCases := []struct {
		name     string
		pattern  string
		method   string
		path     string
		reqMethod string
		expected bool
	}{
		{
			name:     "wildcard match",
			pattern:  "/api/*",
			method:   "GET",
			path:     "/api/users",
			reqMethod: "GET",
			expected: true,
		},
		{
			name:     "method mismatch",
			pattern:  "/api/*",
			method:   "POST",
			path:     "/api/users",
			reqMethod: "GET",
			expected: false,
		},
		{
			name:     "path mismatch",
			pattern:  "/api/*",
			method:   "GET",
			path:     "/other/users",
			reqMethod: "GET",
			expected: false,
		},
		{
			name:     "any method match",
			pattern:  "/api/*",
			method:   "*",
			path:     "/api/users",
			reqMethod: "POST",
			expected: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			rule := &model.ProxyRule{
				PathPattern: tc.pattern,
				Method:      tc.method,
			}
			sample := &model.SampleRequest{
				Path:   tc.path,
				Method: tc.reqMethod,
			}

			result := svc.matchRule(sample, rule)
			if result != tc.expected {
				t.Errorf("Expected %v, got %v", tc.expected, result)
			}
		})
	}
}

func TestApplyRewrite(t *testing.T) {
	defer cleanupTestService(t)
	svc := setupTestService(t)

	testCases := []struct {
		name     string
		path     string
		pattern  string
		rewrite  string
		expected string
	}{
		{
			name:     "simple wildcard rewrite",
			path:     "/api/users",
			pattern:  "/api/*",
			rewrite:  "/service/$1",
			expected: "/service/users",
		},
		{
			name:     "no match returns original",
			path:     "/other/users",
			pattern:  "/api/*",
			rewrite:  "/service/$1",
			expected: "/other/users",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := svc.applyRewrite(tc.path, tc.pattern, tc.rewrite)
			if result != tc.expected {
				t.Errorf("Expected %s, got %s", tc.expected, result)
			}
		})
	}
}

func TestDirtyDataHandling(t *testing.T) {
	defer cleanupTestService(t)
	svc := setupTestService(t)

	_, err := svc.GetRule("non-existent-id")
	if err == nil {
		t.Error("Expected error for non-existent rule, got nil")
	}

	_, err = svc.GetSampleRequest("non-existent-id")
	if err == nil {
		t.Error("Expected error for non-existent sample, got nil")
	}

	_, err = svc.GetBatch("non-existent-id")
	if err == nil {
		t.Error("Expected error for non-existent batch, got nil")
	}
}

func TestCorrectResult(t *testing.T) {
	defer cleanupTestService(t)
	svc := setupTestService(t)

	result := &model.HitResult{
		IsPass:  false,
		HasDiff: true,
		DiffReason: "test diff",
	}
	svc.store.CreateHitResult(result)

	correctReq := &model.CorrectResultRequest{
		ResultID:   result.ID,
		IsCorrected: true,
		Remark:     "人工修正",
	}

	updated, err := svc.CorrectResult(correctReq)
	if err != nil {
		t.Fatalf("CorrectResult failed: %v", err)
	}

	if !updated.IsCorrected {
		t.Error("Expected IsCorrected to be true")
	}
	if !updated.IsPass {
		t.Error("Expected IsPass to be true after correction")
	}
	if updated.Remark != "人工修正" {
		t.Errorf("Expected remark 人工修正, got %s", updated.Remark)
	}
}

func TestExportReport(t *testing.T) {
	defer cleanupTestService(t)
	svc := setupTestService(t)

	ruleReq := &model.CreateRuleRequest{
		Name:        "Test Rule",
		PathPattern: "/api/*",
		Method:      "GET",
		RewriteTo:   "/service/$1",
	}
	rule, _ := svc.CreateRule(ruleReq)

	sampleReq := &model.CreateSampleRequest{
		Path:         "/api/users",
		Method:       "GET",
		ExpectedPath: "/service/users",
		ExpectedCode: 200,
	}
	_, _ = svc.CreateSampleRequest(sampleReq)

	batchReq := &model.CreateBatchRequest{
		Name:    "Test Batch",
		RuleIDs: []string{rule.ID},
	}
	batch, _ := svc.CreateBatch(batchReq)
	svc.ExecuteBatch(batch.ID)

	report, err := svc.ExportReport(batch.ID, "json")
	if err != nil {
		t.Fatalf("ExportReport failed: %v", err)
	}

	if report.ID == "" {
		t.Error("Expected report ID to be set")
	}

	var reportData map[string]interface{}
	err = json.Unmarshal([]byte(report.Content), &reportData)
	if err != nil {
		t.Errorf("Failed to parse report content: %v", err)
	}
}

func TestReCalculateBatch(t *testing.T) {
	defer cleanupTestService(t)
	svc := setupTestService(t)

	ruleReq := &model.CreateRuleRequest{
		Name:        "Test Rule",
		PathPattern: "/api/*",
		Method:      "GET",
		RewriteTo:   "/service/$1",
	}
	rule, _ := svc.CreateRule(ruleReq)

	sampleReq := &model.CreateSampleRequest{
		Path:         "/api/users",
		Method:       "GET",
		ExpectedPath: "/service/users",
		ExpectedCode: 200,
	}
	_, _ = svc.CreateSampleRequest(sampleReq)

	batchReq := &model.CreateBatchRequest{
		Name:    "Test Batch",
		RuleIDs: []string{rule.ID},
	}
	batch, _ := svc.CreateBatch(batchReq)

	err := svc.ReCalculateBatch(batch.ID)
	if err != nil {
		t.Fatalf("ReCalculateBatch failed: %v", err)
	}

	updatedBatch, _ := svc.GetBatch(batch.ID)
	if updatedBatch.Status != "completed" {
		t.Errorf("Expected status completed, got %s", updatedBatch.Status)
	}
}
