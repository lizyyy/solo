package service

import (
	"testing"
	"time"

	"github.com/google/uuid"

	"api-admission-check/internal/model"
	"api-admission-check/internal/store"
)

func setupTestService() *AdmissionService {
	s := store.NewMemoryStore()
	return NewAdmissionService(s)
}

func TestCreateApplication(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
		Description:  "test description",
	}

	app, err := svc.CreateApplication(req)
	if err != nil {
		t.Fatalf("CreateApplication failed: %v", err)
	}

	if app.ServiceName != "test-service" {
		t.Errorf("Expected ServiceName 'test-service', got '%s'", app.ServiceName)
	}
	if app.Status != model.StatusDraft {
		t.Errorf("Expected Status 'DRAFT', got '%s'", app.Status)
	}
}

func TestCreateApplication_InvalidData(t *testing.T) {
	svc := setupTestService()

	testCases := []struct {
		name string
		req  *model.CreateApplicationRequest
	}{
		{
			name: "empty ServiceName",
			req: &model.CreateApplicationRequest{
				ServiceName:  "",
				ServiceOwner: "test-owner",
			},
		},
		{
			name: "empty ServiceOwner",
			req: &model.CreateApplicationRequest{
				ServiceName:  "test-service",
				ServiceOwner: "",
			},
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := svc.CreateApplication(tc.req)
			if err != model.ErrInvalidData {
				t.Errorf("Expected ErrInvalidData, got %v", err)
			}
		})
	}
}

func TestSubmitForReview(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	app, err := svc.SubmitForReview(app.ID, "operator")
	if err != nil {
		t.Fatalf("SubmitForReview failed: %v", err)
	}

	if app.Status != model.StatusPending {
		t.Errorf("Expected Status 'PENDING', got '%s'", app.Status)
	}
}

func TestSubmitForReview_InvalidState(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	app, _ = svc.SubmitForReview(app.ID, "operator")

	_, err := svc.SubmitForReview(app.ID, "operator")
	if err != model.ErrInvalidStateTransition {
		t.Errorf("Expected ErrInvalidStateTransition, got %v", err)
	}
}

func TestStartChecking(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)
	app, _ = svc.SubmitForReview(app.ID, "operator")

	app, err := svc.StartChecking(app.ID, "operator")
	if err != nil {
		t.Fatalf("StartChecking failed: %v", err)
	}

	if app.Status != model.StatusChecking {
		t.Errorf("Expected Status 'CHECKING', got '%s'", app.Status)
	}
}

func TestStartChecking_InvalidState(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	_, err := svc.StartChecking(app.ID, "operator")
	if err != model.ErrInvalidStateTransition {
		t.Errorf("Expected ErrInvalidStateTransition, got %v", err)
	}
}

func TestStateTransitions(t *testing.T) {
	testCases := []struct {
		name          string
		from          model.Status
		to            model.Status
		shouldSucceed bool
	}{
		{"DRAFT -> PENDING", model.StatusDraft, model.StatusPending, true},
		{"DRAFT -> CANCELLED", model.StatusDraft, model.StatusCancelled, true},
		{"PENDING -> CHECKING", model.StatusPending, model.StatusChecking, true},
		{"CHECKING -> APPROVED", model.StatusChecking, model.StatusApproved, true},
		{"DRAFT -> APPROVED", model.StatusDraft, model.StatusApproved, false},
		{"APPROVED -> CANCELLED", model.StatusApproved, model.StatusCancelled, false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := model.CanTransition(tc.from, tc.to)
			if result != tc.shouldSucceed {
				t.Errorf("Expected CanTransition(%s, %s) = %t, got %t",
					tc.from, tc.to, tc.shouldSucceed, result)
			}
		})
	}
}

func TestRegisterDependency(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
		Dependencies: []model.DependencyRequest{
			{
				APIName:     "UserAPI",
				APIEndpoint: "/api/v1/users",
				APIMethod:   "GET",
			},
		},
	}
	app, _ := svc.CreateApplication(req)

	if len(app.Dependencies) != 1 {
		t.Fatalf("Expected 1 dependency, got %d", len(app.Dependencies))
	}

	depID := app.Dependencies[0].ID

	result, err := svc.RegisterDependency(app.ID, depID, "operator")
	if err != nil {
		t.Fatalf("RegisterDependency failed: %v", err)
	}

	if !result.Passed {
		t.Errorf("Expected result.Passed = true, got false")
	}

	app, _ = svc.GetApplication(app.ID)
	if !app.Dependencies[0].Registered {
		t.Errorf("Expected dependency to be registered")
	}
}

func TestCheckPermissions_Valid(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	checkReq := &model.PermissionCheckRequest{
		Credentials: []model.PermissionCred{
			{
				CredType:  "API_KEY",
				CredID:    uuid.New().String(),
				Valid:     true,
				ExpireAt:  time.Now().AddDate(1, 0, 0),
			},
		},
		Operator: "admin",
	}

	result, err := svc.CheckPermissions(app.ID, checkReq)
	if err != nil {
		t.Fatalf("CheckPermissions failed: %v", err)
	}

	if !result.Passed {
		t.Errorf("Expected result.Passed = true, got false")
	}
}

func TestCheckPermissions_Invalid(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	checkReq := &model.PermissionCheckRequest{
		Credentials: []model.PermissionCred{
			{
				CredType:  "",
				CredID:    "",
				Valid:     false,
			},
		},
		Operator: "admin",
	}

	result, err := svc.CheckPermissions(app.ID, checkReq)
	if err != nil {
		t.Fatalf("CheckPermissions failed: %v", err)
	}

	if result.Passed {
		t.Errorf("Expected result.Passed = false, got true")
	}
}

func TestCheckQuota_Valid(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	checkReq := &model.QuotaCheckRequest{
		Quotas: []model.QuotaRequirement{
			{
				QuotaType: "QPS",
				Requested: 100,
				Available: 1000,
			},
		},
		Operator: "admin",
	}

	result, err := svc.CheckQuota(app.ID, checkReq)
	if err != nil {
		t.Fatalf("CheckQuota failed: %v", err)
	}

	if !result.Passed {
		t.Errorf("Expected result.Passed = true, got false")
	}
}

func TestCheckQuota_Exceeded(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	checkReq := &model.QuotaCheckRequest{
		Quotas: []model.QuotaRequirement{
			{
				QuotaType: "QPS",
				Requested: 2000,
				Available: 1000,
			},
		},
		Operator: "admin",
	}

	result, err := svc.CheckQuota(app.ID, checkReq)
	if err != nil {
		t.Fatalf("CheckQuota failed: %v", err)
	}

	if result.Passed {
		t.Errorf("Expected result.Passed = false, got true")
	}
}

func TestCheckAlerts_Resolved(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	checkReq := &model.AlertCheckRequest{
		Alerts: []model.AlertItem{
			{
				AlertType: "SECURITY_SCAN",
				Severity:  "LOW",
				Message:   "No critical vulnerabilities",
				Resolved:  true,
			},
		},
		Operator: "admin",
	}

	result, err := svc.CheckAlerts(app.ID, checkReq)
	if err != nil {
		t.Fatalf("CheckAlerts failed: %v", err)
	}

	if !result.Passed {
		t.Errorf("Expected result.Passed = true, got false")
	}
}

func TestCheckAlerts_UnresolvedCritical(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	checkReq := &model.AlertCheckRequest{
		Alerts: []model.AlertItem{
			{
				AlertType: "SECURITY_SCAN",
				Severity:  "CRITICAL",
				Message:   "SQL injection vulnerability found",
				Resolved:  false,
			},
		},
		Operator: "admin",
	}

	result, err := svc.CheckAlerts(app.ID, checkReq)
	if err != nil {
		t.Fatalf("CheckAlerts failed: %v", err)
	}

	if result.Passed {
		t.Errorf("Expected result.Passed = false, got true")
	}
}

func TestApproveApplication_WithAllChecks(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
		Dependencies: []model.DependencyRequest{
			{APIName: "UserAPI", APIEndpoint: "/api/v1/users", APIMethod: "GET"},
		},
	}
	app, _ := svc.CreateApplication(req)

	app, _ = svc.SubmitForReview(app.ID, "operator")
	app, _ = svc.StartChecking(app.ID, "operator")

	depID := app.Dependencies[0].ID
	svc.RegisterDependency(app.ID, depID, "operator")

	svc.CheckPermissions(app.ID, &model.PermissionCheckRequest{
		Credentials: []model.PermissionCred{
			{CredType: "API_KEY", CredID: uuid.New().String(), Valid: true},
		},
		Operator: "admin",
	})

	svc.CheckQuota(app.ID, &model.QuotaCheckRequest{
		Quotas: []model.QuotaRequirement{
			{QuotaType: "QPS", Requested: 100, Available: 1000},
		},
		Operator: "admin",
	})

	svc.CheckAlerts(app.ID, &model.AlertCheckRequest{
		Alerts: []model.AlertItem{
			{AlertType: "SECURITY_SCAN", Severity: "LOW", Message: "OK", Resolved: true},
		},
		Operator: "admin",
	})

	app, err := svc.ApproveApplication(app.ID, "reviewer")
	if err != nil {
		t.Fatalf("ApproveApplication failed: %v", err)
	}

	if app.Status != model.StatusApproved {
		t.Errorf("Expected Status 'APPROVED', got '%s'", app.Status)
	}

	if app.AdmissionResult == nil {
		t.Fatalf("Expected AdmissionResult to be set")
	}

	if !app.AdmissionResult.Approved {
		t.Errorf("Expected AdmissionResult.Approved = true")
	}
}

func TestApproveApplication_WithoutChecks(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	app, _ = svc.SubmitForReview(app.ID, "operator")
	app, _ = svc.StartChecking(app.ID, "operator")

	_, err := svc.ApproveApplication(app.ID, "reviewer")
	if err != model.ErrCheckIncomplete {
		t.Errorf("Expected ErrCheckIncomplete, got %v", err)
	}
}

func TestRejectApplication(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	app, _ = svc.SubmitForReview(app.ID, "operator")
	app, _ = svc.StartChecking(app.ID, "operator")

	app, err := svc.RejectApplication(app.ID, "reviewer", "security issue")
	if err != nil {
		t.Fatalf("RejectApplication failed: %v", err)
	}

	if app.Status != model.StatusRejected {
		t.Errorf("Expected Status 'REJECTED', got '%s'", app.Status)
	}
}

func TestCancelApplication(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	app, err := svc.CancelApplication(app.ID, "operator")
	if err != nil {
		t.Fatalf("CancelApplication failed: %v", err)
	}

	if app.Status != model.StatusCancelled {
		t.Errorf("Expected Status 'CANCELLED', got '%s'", app.Status)
	}
}

func TestGetHistory(t *testing.T) {
	svc := setupTestService()

	req := &model.CreateApplicationRequest{
		ServiceName:  "test-service",
		ServiceOwner: "test-owner",
	}
	app, _ := svc.CreateApplication(req)

	app, _ = svc.SubmitForReview(app.ID, "operator")
	app, _ = svc.CancelApplication(app.ID, "operator")

	history, err := svc.GetHistory(app.ID)
	if err != nil {
		t.Fatalf("GetHistory failed: %v", err)
	}

	if len(history) < 3 {
		t.Errorf("Expected at least 3 history records, got %d", len(history))
	}

	t.Logf("History records: %d", len(history))
	for _, h := range history {
		t.Logf("  - ActionType: %s, Operator: %s, Remark: %s", h.ActionType, h.Operator, h.Remark)
	}
}

func TestGetApplication_NotFound(t *testing.T) {
	svc := setupTestService()

	_, err := svc.GetApplication("non-existent-id")
	if err != model.ErrApplicationNotFound {
		t.Errorf("Expected ErrApplicationNotFound, got %v", err)
	}
}
