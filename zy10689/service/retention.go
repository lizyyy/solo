package service

import (
	"audit-log-retention/model"
	"errors"
	"fmt"
	"sync"
	"time"
)

var (
	ErrApplicationNotFound     = errors.New("application not found")
	ErrDuplicateApplication    = errors.New("duplicate application for this log source")
	ErrInvalidStatusTransition = errors.New("invalid status transition")
	ErrAlreadyArchived         = errors.New("application already archived")
	ErrNotApproved             = errors.New("application not approved")
)

type RetentionService struct {
	applications map[string]*model.RetentionApplication
	logSourceIdx map[string]string
	mu           sync.RWMutex
}

func NewRetentionService() *RetentionService {
	return &RetentionService{
		applications: make(map[string]*model.RetentionApplication),
		logSourceIdx: make(map[string]string),
	}
}

func (s *RetentionService) CreateApplication(req model.CreateApplicationRequest) (*model.RetentionApplication, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if existingID, exists := s.logSourceIdx[req.LogSource]; exists {
		existing := s.applications[existingID]
		if existing.Status == model.StatusApproved || existing.Status == model.StatusExceptionApplied {
			return nil, fmt.Errorf("%w: active application exists for %s", ErrDuplicateApplication, req.LogSource)
		}
	}

	app := model.NewRetentionApplication(req)
	s.applications[app.ID] = app
	s.logSourceIdx[app.LogSource] = app.ID

	return app, nil
}

func (s *RetentionService) GetApplication(id string) (*model.RetentionApplication, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	app, exists := s.applications[id]
	if !exists {
		return nil, ErrApplicationNotFound
	}

	return app, nil
}

func (s *RetentionService) GetApplicationByLogSource(logSource string) (*model.RetentionApplication, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	id, exists := s.logSourceIdx[logSource]
	if !exists {
		return nil, ErrApplicationNotFound
	}

	return s.applications[id], nil
}

func (s *RetentionService) ListApplications(status model.RetentionStatus) []*model.RetentionApplication {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*model.RetentionApplication, 0)
	for _, app := range s.applications {
		if status == "" || app.Status == status {
			result = append(result, app)
		}
	}
	return result
}

func (s *RetentionService) ApproveApplication(id string, req model.ApproveApplicationRequest) (*model.RetentionApplication, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	app, exists := s.applications[id]
	if !exists {
		return nil, ErrApplicationNotFound
	}

	if app.Status != model.StatusExceptionApplied {
		return nil, fmt.Errorf("%w: cannot approve from status %s", ErrInvalidStatusTransition, app.Status)
	}

	if req.Approved {
		app.Approve(req.Approver, req.Comment)
	} else {
		app.Reject(req.Approver, req.Comment)
	}

	return app, nil
}

func (s *RetentionService) CheckExpiration(id string) (*model.ExpirationCheckResult, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	app, exists := s.applications[id]
	if !exists {
		return nil, ErrApplicationNotFound
	}

	result := app.CheckExpiration()
	return &result, nil
}

func (s *RetentionService) CheckAllExpirations() []model.ExpirationCheckResult {
	s.mu.Lock()
	defer s.mu.Unlock()

	results := make([]model.ExpirationCheckResult, 0)
	for _, app := range s.applications {
		result := app.CheckExpiration()
		results = append(results, result)
	}
	return results
}

func (s *RetentionService) ArchiveApplication(id string, req model.ArchiveApplicationRequest) (*model.ArchiveRecord, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	app, exists := s.applications[id]
	if !exists {
		return nil, ErrApplicationNotFound
	}

	if app.Status != model.StatusApproved && app.Status != model.StatusExpired {
		return nil, fmt.Errorf("%w: cannot archive from status %s", ErrInvalidStatusTransition, app.Status)
	}

	if app.IsArchived {
		return nil, ErrAlreadyArchived
	}

	archiveRecord := app.Archive(req.ArchiveLocation, req.ArchivedBy)
	return archiveRecord, nil
}

func (s *RetentionService) RenewApplication(id string, additionalDays int, approver string) (*model.RetentionApplication, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	app, exists := s.applications[id]
	if !exists {
		return nil, ErrApplicationNotFound
	}

	if app.Status != model.StatusExpired && app.Status != model.StatusApproved {
		return nil, fmt.Errorf("%w: cannot renew from status %s", ErrInvalidStatusTransition, app.Status)
	}

	app.RetentionDays += additionalDays
	app.ExpiresAt = app.ExpiresAt.AddDate(0, 0, additionalDays)
	app.Status = model.StatusApproved

	now := time.Now()
	app.ApprovalRecords = append(app.ApprovalRecords, model.ApprovalRecord{
		ID:            generateID(),
		ApplicationID: app.ID,
		Approver:      approver,
		Comment:       fmt.Sprintf("Renewed for %d additional days", additionalDays),
		Approved:      true,
		ApprovedAt:    now,
	})

	return app, nil
}

func (s *RetentionService) GetExpiredApplications() []*model.RetentionApplication {
	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now()
	result := make([]*model.RetentionApplication, 0)

	for _, app := range s.applications {
		if app.ExpiresAt.Before(now) && !app.IsArchived {
			result = append(result, app)
		}
	}

	return result
}

func (s *RetentionService) GetLongRetentionRiskApplications() []*model.RetentionApplication {
	s.mu.RLock()
	defer s.mu.RUnlock()

	threshold := time.Now().AddDate(0, 0, -30)
	result := make([]*model.RetentionApplication, 0)

	for _, app := range s.applications {
		if app.ExpiresAt.Before(threshold) && !app.IsArchived {
			result = append(result, app)
		}
	}

	return result
}

func (s *RetentionService) ExportApprovalRecords(id string) ([]model.ApprovalRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	app, exists := s.applications[id]
	if !exists {
		return nil, ErrApplicationNotFound
	}

	return app.ApprovalRecords, nil
}

func (s *RetentionService) ExportArchiveRecords(id string) ([]model.ArchiveRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	app, exists := s.applications[id]
	if !exists {
		return nil, ErrApplicationNotFound
	}

	return app.ArchiveRecords, nil
}

func generateID() string {
	return fmt.Sprintf("%d", time.Now().UnixNano())
}
