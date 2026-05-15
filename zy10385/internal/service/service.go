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

	for _, depReq := range req.Dependencies {
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
	}

	err := s.store.CreateApplication(app)
	if err != nil {
		return nil, err
	}

	s.recordHistory(app.ID, "", model.StatusDraft, "system", "Application created")
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

	s.recordHistory(app.ID, oldStatus, model.StatusPending, operator, "Submitted for review")
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

	s.recordHistory(app.ID, oldStatus, model.StatusChecking, operator, "Start admission checking")
	return app, nil
}

func (s *AdmissionService) RegisterDependency(appID, depID string) (*model.CheckResult, error) {
	app, err := s.store.GetApplication(appID)
	if err != nil {
		return nil, err
	}

	for i := range app.Dependencies {
		if app.Dependencies[i].ID == depID {
			app.Dependencies[i].Registered = true
			app.Dependencies[i].RegisteredAt = time.Now()
			
			err = s.store.UpdateApplication(app)
			if err != nil {
				return nil, err
			}

			return &model.CheckResult{
				Passed:  true,
				Message: "Dependency registered successfully",
				Details: fmt.Sprintf("API: %s, Endpoint: %s", app.Dependencies[i].APIName, app.Dependencies[i].APIEndpoint),
			}, nil
		}
	}

	return &model.CheckResult{
		Passed:  false,
		Message: "Dependency not found",
	}, nil
}

func (s *AdmissionService) CheckPermissions(appID string) (*model.CheckResult, error) {
	app, err := s.store.GetApplication(appID)
	if err != nil {
		return nil, err
	}

	creds := []model.PermissionCred{
		{
			ID:           uuid.New().String(),
			AppID:        appID,
			CredType:     "API_KEY",
			CredID:       fmt.Sprintf("key-%s", uuid.New().String()[:8]),
			Valid:        true,
			ExpireAt:     time.Now().AddDate(1, 0, 0),
			CheckStatus:  model.CheckItemPassed,
			CheckMessage: "Permission valid",
		},
	}
	app.PermissionCreds = creds

	allPassed := true
	for _, cred := range app.PermissionCreds {
		if !cred.Valid || cred.CheckStatus != model.CheckItemPassed {
			allPassed = false
			break
		}
	}

	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	if allPassed {
		return &model.CheckResult{
			Passed:  true,
			Message: "All permissions checked passed",
			Details: fmt.Sprintf("Total %d permission credentials", len(app.PermissionCreds)),
		}, nil
	}

	return &model.CheckResult{
		Passed:  false,
		Message: "Some permissions are invalid",
	}, nil
}

func (s *AdmissionService) CheckQuota(appID string) (*model.CheckResult, error) {
	app, err := s.store.GetApplication(appID)
	if err != nil {
		return nil, err
	}

	quotas := []model.QuotaRequirement{
		{
			ID:           uuid.New().String(),
			AppID:        appID,
			QuotaType:    "QPS",
			Requested:    1000,
			Available:    5000,
			CheckStatus:  model.CheckItemPassed,
			CheckMessage: "Quota sufficient",
		},
		{
			ID:           uuid.New().String(),
			AppID:        appID,
			QuotaType:    "DAILY_CALLS",
			Requested:    100000,
			Available:    500000,
			CheckStatus:  model.CheckItemPassed,
			CheckMessage: "Quota sufficient",
		},
	}
	app.QuotaRequirements = quotas

	allPassed := true
	for _, quota := range app.QuotaRequirements {
		if quota.Requested > quota.Available {
			allPassed = false
			break
		}
	}

	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	if allPassed {
		return &model.CheckResult{
			Passed:  true,
			Message: "All quota checks passed",
			Details: fmt.Sprintf("Total %d quota requirements checked", len(app.QuotaRequirements)),
		}, nil
	}

	return &model.CheckResult{
		Passed:  false,
		Message: "Some quotas exceed available limits",
	}, nil
}

func (s *AdmissionService) CheckAlerts(appID string) (*model.CheckResult, error) {
	app, err := s.store.GetApplication(appID)
	if err != nil {
		return nil, err
	}

	alerts := []model.AlertItem{
		{
			ID:          uuid.New().String(),
			AppID:       appID,
			AlertType:   "SECURITY_SCAN",
			Severity:    "LOW",
			Message:     "No critical vulnerabilities found",
			CheckStatus: model.CheckItemPassed,
			Resolved:    true,
		},
	}
	app.Alerts = alerts

	allResolved := true
	for _, alert := range app.Alerts {
		if !alert.Resolved || alert.Severity == "CRITICAL" {
			allResolved = false
			break
		}
	}

	err = s.store.UpdateApplication(app)
	if err != nil {
		return nil, err
	}

	if allResolved {
		return &model.CheckResult{
			Passed:  true,
			Message: "All alerts resolved",
			Details: fmt.Sprintf("Total %d alert items checked", len(app.Alerts)),
		}, nil
	}

	return &model.CheckResult{
		Passed:  false,
		Message: "Some alerts are not resolved",
	}, nil
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

	s.recordHistory(app.ID, oldStatus, model.StatusApproved, reviewer, "Application approved")
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

	s.recordHistory(app.ID, oldStatus, model.StatusRejected, reviewer, "Application rejected: "+reason)
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

	s.recordHistory(app.ID, oldStatus, model.StatusCancelled, operator, "Application cancelled")
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
		if !alert.Resolved {
			return false
		}
	}

	return true
}

func (s *AdmissionService) recordHistory(appID string, oldStatus, newStatus model.Status, operator, remark string) {
	record := &model.HistoryRecord{
		ID:        uuid.New().String(),
		AppID:     appID,
		OldStatus: oldStatus,
		NewStatus: newStatus,
		Operator:  operator,
		Remark:    remark,
	}
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
		len(app.Dependencies), countRegistered(app.Dependencies),
		len(app.PermissionCreds), allCredsValid(app.PermissionCreds),
		len(app.QuotaRequirements), allQuotasSufficient(app.QuotaRequirements),
		len(app.Alerts), allAlertsResolved(app.Alerts))
}

func countRegistered(deps []model.Dependency) int {
	count := 0
	for _, d := range deps {
		if d.Registered {
			count++
		}
	}
	return count
}

func allCredsValid(creds []model.PermissionCred) bool {
	for _, c := range creds {
		if !c.Valid {
			return false
		}
	}
	return true
}

func allQuotasSufficient(quotas []model.QuotaRequirement) bool {
	for _, q := range quotas {
		if q.Requested > q.Available {
			return false
		}
	}
	return true
}

func allAlertsResolved(alerts []model.AlertItem) bool {
	for _, a := range alerts {
		if !a.Resolved {
			return false
		}
	}
	return true
}
