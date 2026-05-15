package service

import (
	"fmt"
	"time"

	"github.com/google/uuid"

	"api-admission-check/internal/model"
	"api-admission-check/internal/store"
)

type AdmissionService struct {
	store store.Store
}

func NewAdmissionService(s store.Store) *AdmissionService {
	return &AdmissionService{store: s}
}

func (s *AdmissionService) CreateApplication(req *model.CreateApplicationRequest) (*model.ServiceApplication, error) {
	if req.ServiceName == "" || req.ServiceOwner == "" {
		return nil, model.ErrInvalidData
	}

	app := &model.ServiceApplication{
		ID:               generateAppID(),
		ServiceName:      req.ServiceName,
		ServiceOwner:     req.ServiceOwner,
		Description:      req.Description,
		Status:           model.StatusDraft,
		Dependencies:     make([]model.Dependency, 0, len(req.Dependencies)),
		PermissionCreds:  []model.PermissionCred{},
		QuotaRequirements: []model.QuotaRequirement{},
		Alerts:           []model.AlertItem{},
		AdmissionResult:  nil,
	}

	for i, depReq := range req.Dependencies {
		dep := model.Dependency{
			ID:          uuid.New().String(),
			AppID:       app.ID,
			APIName:     depReq.APIName,
			APIEndpoint: depReq.APIEndpoint,
			APIMethod:   depReq.APIMethod,
			Description: depReq.Description,
			Registered:  false,
		}
		app.Dependencies = append(app.Dependencies, dep)
		_ = i
	}

	err := s.store.CreateApplication(app)
	if err != nil {
		return nil, err
	}

	s.recordHistory(&model.HistoryRecord{
		ID:         uuid.New().String(),
		AppID:      app.ID,
		OldStatus:  "",
		NewStatus:  model.StatusDraft,
		Operator:   "system",
		Remark:     "Application created",
		ActionType: "create",
	})
	return app, nil
}

func (s *AdmissionService) GetApplication(id string) (*model.ServiceApplication, error) {
	return s.store.GetApplication(id)
}

func (s *AdmissionService) ListApplications() ([]*model.ServiceApplication, error) {
	return s.store.ListApplications()
}

func (s *AdmissionService) SubmitForReview(id string, operator string) (*model.ServiceApplication, error) {
	app, err := s.store.GetApplication(id)
	if err != nil {
		return nil, err
	}

	if app.Status != model.StatusDraft {
		return nil, model.ErrInvalidStateTransition
	}

	oldStatus := app.Status
	app.Status = model.StatusPending
	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	s.recordHistory(&model.HistoryRecord{
		ID:         uuid.New().String(),
		AppID:      app.ID,
		OldStatus:  oldStatus,
		NewStatus:  model.StatusPending,
		Operator:   operator,
		Remark:     "Submitted for review",
		ActionType: "status_change",
	})
	return app, nil
}

func (s *AdmissionService) StartChecking(id string, operator string) (*model.ServiceApplication, error) {
	app, err := s.store.GetApplication(id)
	if err != nil {
		return nil, err
	}

	if app.Status != model.StatusPending {
		return nil, model.ErrInvalidStateTransition
	}

	oldStatus := app.Status
	app.Status = model.StatusChecking
	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	s.recordHistory(&model.HistoryRecord{
		ID:         uuid.New().String(),
		AppID:      app.ID,
		OldStatus:  oldStatus,
		NewStatus:  model.StatusChecking,
		Operator:   operator,
		Remark:     "Start admission checking",
		ActionType: "status_change",
	})
	return app, nil
}

func (s *AdmissionService) RegisterDependency(appID, depID, operator string) (*model.CheckResult, error) {
	app, err := s.store.GetApplication(appID)
	if err != nil {
		return nil, err
	}

	found := false
	for i := range app.Dependencies {
		if app.Dependencies[i].ID == depID {
			if app.Dependencies[i].Registered {
				return &model.CheckResult{
					Passed:  true,
					Message: "Dependency already registered",
					Details: fmt.Sprintf("API: %s", app.Dependencies[i].APIName),
				}, nil
			}

			app.Dependencies[i].Registered = true
			app.Dependencies[i].RegisteredAt = time.Now()
			found = true

			err = s.store.UpdateApplication(app)
			if err != nil {
				return nil, err
			}

			s.recordHistory(&model.HistoryRecord{
				ID:         uuid.New().String(),
				AppID:      appID,
				Operator:   operator,
				Remark:     fmt.Sprintf("Dependency registered: %s", app.Dependencies[i].APIName),
				ActionType: "dependency_register",
				Details: map[string]interface{}{
					"dependency_id": depID,
					"api_name":      app.Dependencies[i].APIName,
					"api_endpoint":  app.Dependencies[i].APIEndpoint,
				},
			})

			return &model.CheckResult{
				Passed:  true,
				Message: "Dependency registered successfully",
				Details: fmt.Sprintf("API: %s, Endpoint: %s", app.Dependencies[i].APIName, app.Dependencies[i].APIEndpoint),
			}, nil
		}
	}

	if !found {
		return &model.CheckResult{
			Passed:  false,
			Message: "Dependency not found",
		}, nil
	}

	return &model.CheckResult{Passed: false}, nil
}

func (s *AdmissionService) CheckPermissions(appID string, req *model.PermissionCheckRequest) (*model.CheckResult, error) {
	app, err := s.store.GetApplication(appID)
	if err != nil {
		return nil, err
	}

	allPassed := true
	failedCount := 0
	for i := range req.Credentials {
		cred := &req.Credentials[i]

		if cred.CredID == "" || cred.CredType == "" {
			cred.Valid = false
			cred.CheckStatus = model.CheckItemFailed
			cred.CheckMessage = "Invalid credential: missing ID or type"
			allPassed = false
			failedCount++
			continue
		}

		if cred.ExpireAt.Before(time.Now()) && !cred.ExpireAt.IsZero() {
			cred.Valid = false
			cred.CheckStatus = model.CheckItemFailed
			cred.CheckMessage = "Credential expired"
			allPassed = false
			failedCount++
			continue
		}

		if cred.CheckStatus == "" {
			cred.CheckStatus = model.CheckItemPassed
			cred.Valid = true
			cred.CheckMessage = "Permission valid"
		}

		if cred.CheckStatus == model.CheckItemFailed {
			allPassed = false
			failedCount++
		}
	}

	app.PermissionCreds = req.Credentials

	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	result := &model.CheckResult{
		Passed:  allPassed,
		Message: fmt.Sprintf("Permission check completed. Total: %d, Failed: %d", len(req.Credentials), failedCount),
	}

	s.recordHistory(&model.HistoryRecord{
		ID:         uuid.New().String(),
		AppID:      appID,
		Operator:   req.Operator,
		Remark:     result.Message,
		ActionType: "permission_check",
		Details: map[string]interface{}{
			"passed":       allPassed,
			"total_count":  len(req.Credentials),
			"failed_count": failedCount,
		},
	})

	return result, nil
}

func (s *AdmissionService) CheckQuota(appID string, req *model.QuotaCheckRequest) (*model.CheckResult, error) {
	app, err := s.store.GetApplication(appID)
	if err != nil {
		return nil, err
	}

	allPassed := true
	failedCount := 0
	for i := range req.Quotas {
		quota := &req.Quotas[i]

		if quota.QuotaType == "" {
			quota.CheckStatus = model.CheckItemFailed
			quota.CheckMessage = "Invalid quota: missing type"
			allPassed = false
			failedCount++
			continue
		}

		if quota.Requested > quota.Available && quota.Available > 0 {
			quota.CheckStatus = model.CheckItemFailed
			quota.CheckMessage = fmt.Sprintf("Quota exceeded: requested %d, available %d", quota.Requested, quota.Available)
			allPassed = false
			failedCount++
			continue
		}

		if quota.CheckStatus == "" {
			quota.CheckStatus = model.CheckItemPassed
			quota.CheckMessage = "Quota sufficient"
		}

		if quota.CheckStatus == model.CheckItemFailed {
			allPassed = false
			failedCount++
		}
	}

	app.QuotaRequirements = req.Quotas

	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	result := &model.CheckResult{
		Passed:  allPassed,
		Message: fmt.Sprintf("Quota check completed. Total: %d, Failed: %d", len(req.Quotas), failedCount),
	}

	s.recordHistory(&model.HistoryRecord{
		ID:         uuid.New().String(),
		AppID:      appID,
		Operator:   req.Operator,
		Remark:     result.Message,
		ActionType: "quota_check",
		Details: map[string]interface{}{
			"passed":       allPassed,
			"total_count":  len(req.Quotas),
			"failed_count": failedCount,
		},
	})

	return result, nil
}

func (s *AdmissionService) CheckAlerts(appID string, req *model.AlertCheckRequest) (*model.CheckResult, error) {
	app, err := s.store.GetApplication(appID)
	if err != nil {
		return nil, err
	}

	allPassed := true
	failedCount := 0
	for i := range req.Alerts {
		alert := &req.Alerts[i]

		if alert.AlertType == "" {
			alert.CheckStatus = model.CheckItemFailed
			alert.Resolved = false
			alert.Message = "Invalid alert: missing type"
			allPassed = false
			failedCount++
			continue
		}

		if alert.Severity == "CRITICAL" && !alert.Resolved {
			alert.CheckStatus = model.CheckItemFailed
			alert.Message = fmt.Sprintf("CRITICAL alert not resolved: %s", alert.Message)
			allPassed = false
			failedCount++
			continue
		}

		if !alert.Resolved {
			alert.CheckStatus = model.CheckItemFailed
			allPassed = false
			failedCount++
			continue
		}

		if alert.CheckStatus == "" {
			alert.CheckStatus = model.CheckItemPassed
		}

		if alert.CheckStatus == model.CheckItemFailed {
			allPassed = false
			failedCount++
		}
	}

	app.Alerts = req.Alerts

	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	result := &model.CheckResult{
		Passed:  allPassed,
		Message: fmt.Sprintf("Alert check completed. Total: %d, Failed: %d", len(req.Alerts), failedCount),
	}

	s.recordHistory(&model.HistoryRecord{
		ID:         uuid.New().String(),
		AppID:      appID,
		Operator:   req.Operator,
		Remark:     result.Message,
		ActionType: "alert_check",
		Details: map[string]interface{}{
			"passed":       allPassed,
			"total_count":  len(req.Alerts),
			"failed_count": failedCount,
		},
	})

	return result, nil
}

func (s *AdmissionService) ApproveApplication(id string, reviewer string) (*model.ServiceApplication, error) {
	app, err := s.store.GetApplication(id)
	if err != nil {
		return nil, err
	}

	if app.Status != model.StatusChecking {
		return nil, model.ErrInvalidStateTransition
	}

	if !s.allChecksPassed(app) {
		return nil, model.ErrCheckIncomplete
	}

	result := &model.AdmissionResult{
		ID:         uuid.New().String(),
		AppID:      id,
		Conclusion: "APPROVED",
		Approved:   true,
		ReportContent: generateReport(app, true),
		ReviewedBy: reviewer,
		ReviewedAt: time.Now(),
	}
	app.AdmissionResult = result

	oldStatus := app.Status
	app.Status = model.StatusApproved
	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	s.recordHistory(&model.HistoryRecord{
		ID:         uuid.New().String(),
		AppID:      app.ID,
		OldStatus:  oldStatus,
		NewStatus:  model.StatusApproved,
		Operator:   reviewer,
		Remark:     "Application approved",
		ActionType: "status_change",
	})
	return app, nil
}

func (s *AdmissionService) RejectApplication(id string, reviewer string, reason string) (*model.ServiceApplication, error) {
	app, err := s.store.GetApplication(id)
	if err != nil {
		return nil, err
	}

	if app.Status != model.StatusChecking {
		return nil, model.ErrInvalidStateTransition
	}

	result := &model.AdmissionResult{
		ID:         uuid.New().String(),
		AppID:      id,
		Conclusion: "REJECTED",
		Approved:   false,
		ReportContent: generateReport(app, false) + "\nReason: " + reason,
		ReviewedBy: reviewer,
		ReviewedAt: time.Now(),
	}
	app.AdmissionResult = result

	oldStatus := app.Status
	app.Status = model.StatusRejected
	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	s.recordHistory(&model.HistoryRecord{
		ID:         uuid.New().String(),
		AppID:      app.ID,
		OldStatus:  oldStatus,
		NewStatus:  model.StatusRejected,
		Operator:   reviewer,
		Remark:     fmt.Sprintf("Application rejected: %s", reason),
		ActionType: "status_change",
	})
	return app, nil
}

func (s *AdmissionService) CancelApplication(id string, operator string) (*model.ServiceApplication, error) {
	app, err := s.store.GetApplication(id)
	if err != nil {
		return nil, err
	}

	if !model.CanTransition(app.Status, model.StatusCancelled) {
		return nil, model.ErrInvalidStateTransition
	}

	oldStatus := app.Status
	app.Status = model.StatusCancelled
	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	s.recordHistory(&model.HistoryRecord{
		ID:         uuid.New().String(),
		AppID:      app.ID,
		OldStatus:  oldStatus,
		NewStatus:  model.StatusCancelled,
		Operator:   operator,
		Remark:     "Application cancelled",
		ActionType: "status_change",
	})
	return app, nil
}

func (s *AdmissionService) GetHistory(id string) ([]*model.HistoryRecord, error) {
	return s.store.GetHistoryRecords(id)
}

func (s *AdmissionService) allChecksPassed(app *model.ServiceApplication) bool {
	if len(app.PermissionCreds) == 0 || len(app.QuotaRequirements) == 0 || len(app.Alerts) == 0 {
		return false
	}

	for _, dep := range app.Dependencies {
		if !dep.Registered {
			return false
		}
	}

	for _, cred := range app.PermissionCreds {
		if cred.CheckStatus != model.CheckItemPassed {
			return false
		}
	}

	for _, quota := range app.QuotaRequirements {
		if quota.CheckStatus != model.CheckItemPassed {
			return false
		}
	}

	for _, alert := range app.Alerts {
		if !alert.Resolved || alert.CheckStatus != model.CheckItemPassed {
			return false
		}
	}

	return true
}

func (s *AdmissionService) recordHistory(record *model.HistoryRecord) {
	s.store.AddHistoryRecord(record)
}

func generateAppID() string {
	return fmt.Sprintf("APP-%s", uuid.New().String()[:8])
}

func generateReport(app *model.ServiceApplication, approved bool) string {
	status := "REJECTED"
	if approved {
		status = "APPROVED"
	}

	registeredDeps := 0
	for _, d := range app.Dependencies {
		if d.Registered {
			registeredDeps++
		}
	}

	return fmt.Sprintf(`
=== API Dependency Admission Report ===
Application ID: %s
Service Name: %s
Service Owner: %s
Status: %s
Generated At: %s

--- Dependency Check ---
Total Dependencies: %d
Registered: %d

--- Permission Check ---
Credentials: %d
All Valid: %t

--- Quota Check ---
Quota Items: %d
All Sufficient: %t

--- Alert Check ---
Alerts: %d
All Resolved: %t
`, app.ID, app.ServiceName, app.ServiceOwner, status, time.Now().Format(time.RFC3339),
		len(app.Dependencies), registeredDeps,
		len(app.PermissionCreds), allCredsValid(app.PermissionCreds),
		len(app.QuotaRequirements), allQuotasSufficient(app.QuotaRequirements),
		len(app.Alerts), allAlertsResolved(app.Alerts))
}

func allCredsValid(creds []model.PermissionCred) bool {
	for _, c := range creds {
		if !c.Valid || c.CheckStatus != model.CheckItemPassed {
			return false
		}
	}
	return true
}

func allQuotasSufficient(quotas []model.QuotaRequirement) bool {
	for _, q := range quotas {
		if q.CheckStatus != model.CheckItemPassed {
			return false
		}
	}
	return true
}

func allAlertsResolved(alerts []model.AlertItem) bool {
	for _, a := range alerts {
		if !a.Resolved || a.CheckStatus != model.CheckItemPassed {
			return false
		}
	}
	return true
}
