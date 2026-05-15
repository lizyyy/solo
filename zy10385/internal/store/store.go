package store

import (
	"sync"
	"time"

	"api-admission-check/internal/model"
)

type Store interface {
	CreateApplication(app *model.ServiceApplication) error
	GetApplication(id string) (*model.ServiceApplication, error)
	UpdateApplication(app *model.ServiceApplication) error
	ListApplications() ([]*model.ServiceApplication, error)
	AddHistoryRecord(record *model.HistoryRecord) error
	GetHistoryRecords(appID string) ([]*model.HistoryRecord, error)
}

type MemoryStore struct {
	applications map[string]*model.ServiceApplication
	history      map[string][]*model.HistoryRecord
	mu           sync.RWMutex
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		applications: make(map[string]*model.ServiceApplication),
		history:      make(map[string][]*model.HistoryRecord),
	}
}

func (s *MemoryStore) CreateApplication(app *model.ServiceApplication) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.applications[app.ID]; exists {
		return model.ErrDuplicateSubmission
	}

	appCopy := *app
	appCopy.CreatedAt = time.Now()
	appCopy.UpdatedAt = time.Now()
	appCopy.Version = 1
	s.applications[app.ID] = &appCopy
	return nil
}

func (s *MemoryStore) GetApplication(id string) (*model.ServiceApplication, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	app, exists := s.applications[id]
	if !exists {
		return nil, model.ErrApplicationNotFound
	}
	appCopy := *app
	return &appCopy, nil
}

func (s *MemoryStore) UpdateApplication(app *model.ServiceApplication) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	existing, exists := s.applications[app.ID]
	if !exists {
		return model.ErrApplicationNotFound
	}

	if existing.Version != app.Version {
		return model.ErrVersionConflict
	}

	app.UpdatedAt = time.Now()
	app.Version++
	s.applications[app.ID] = app
	return nil
}

func (s *MemoryStore) ListApplications() ([]*model.ServiceApplication, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	result := make([]*model.ServiceApplication, 0, len(s.applications))
	for _, app := range s.applications {
		result = append(result, app)
	}
	return result, nil
}

func (s *MemoryStore) AddHistoryRecord(record *model.HistoryRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	record.CreatedAt = time.Now()
	s.history[record.AppID] = append(s.history[record.AppID], record)
	return nil
}

func (s *MemoryStore) GetHistoryRecords(appID string) ([]*model.HistoryRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	records, exists := s.history[appID]
	if !exists {
		return []*model.HistoryRecord{}, nil
	}
	return records, nil
}
