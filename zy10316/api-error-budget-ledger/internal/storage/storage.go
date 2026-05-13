package storage

import (
	"errors"
	"sync"
	"time"

	"api-error-budget-ledger/internal/model"
)

var (
	ErrNotFound      = errors.New("resource not found")
	ErrDuplicate     = errors.New("duplicate resource")
	ErrAlreadyExists = errors.New("already exists")
)

type Storage interface {
	SaveBudget(budget *model.ErrorBudget) error
	GetBudget(id string) (*model.ErrorBudget, error)
	ListBudgets() []*model.ErrorBudget
	UpdateBudget(budget *model.ErrorBudget) error

	SaveWindow(window *model.RequestWindow) error
	GetWindow(id string) (*model.RequestWindow, error)
	GetActiveWindow(budgetID string) (*model.RequestWindow, error)
	ListWindows(budgetID string) []*model.RequestWindow
	UpdateWindow(window *model.RequestWindow) error

	SaveDeductEvent(event *model.DeductEvent) error
	GetDeductEvent(id string) (*model.DeductEvent, error)
	GetDeductEventByRequestID(requestID string) (*model.DeductEvent, error)
	ListDeductEvents(budgetID string, startTime, endTime *time.Time) []*model.DeductEvent
	UpdateDeductEvent(event *model.DeductEvent) error

	SaveExemption(exemption *model.Exemption) error
	GetExemption(id string) (*model.Exemption, error)
	ListExemptions(budgetID string) []*model.Exemption
	UpdateExemption(exemption *model.Exemption) error

	SaveFreezeAction(action *model.FreezeAction) error
	GetFreezeAction(id string) (*model.FreezeAction, error)
	GetActiveFreeze(budgetID string) (*model.FreezeAction, error)
	ListFreezeActions(budgetID string) []*model.FreezeAction
	UpdateFreezeAction(action *model.FreezeAction) error

	SaveTimelineEntry(entry *model.TimelineEntry) error
	ListTimeline(budgetID string, limit, offset int) []*model.TimelineEntry
	GetTimelineCount(budgetID string) int

	SaveCompensation(compensation *model.Compensation) error
	GetCompensation(id string) (*model.Compensation, error)
	ListCompensations(budgetID string) []*model.Compensation
}

type InMemoryStorage struct {
	budgets       map[string]*model.ErrorBudget
	windows       map[string]*model.RequestWindow
	deductEvents  map[string]*model.DeductEvent
	requestIDMap  map[string]string
	exemptions    map[string]*model.Exemption
	freezeActions map[string]*model.FreezeAction
	timeline      map[string][]*model.TimelineEntry
	compensations map[string]*model.Compensation

	mu sync.RWMutex
}

func NewInMemoryStorage() *InMemoryStorage {
	return &InMemoryStorage{
		budgets:       make(map[string]*model.ErrorBudget),
		windows:       make(map[string]*model.RequestWindow),
		deductEvents:  make(map[string]*model.DeductEvent),
		requestIDMap:  make(map[string]string),
		exemptions:    make(map[string]*model.Exemption),
		freezeActions: make(map[string]*model.FreezeAction),
		timeline:      make(map[string][]*model.TimelineEntry),
		compensations: make(map[string]*model.Compensation),
	}
}

func (s *InMemoryStorage) SaveBudget(budget *model.ErrorBudget) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.budgets[budget.ID] = budget
	return nil
}

func (s *InMemoryStorage) GetBudget(id string) (*model.ErrorBudget, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	budget, ok := s.budgets[id]
	if !ok {
		return nil, ErrNotFound
	}
	return budget, nil
}

func (s *InMemoryStorage) ListBudgets() []*model.ErrorBudget {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.ErrorBudget, 0, len(s.budgets))
	for _, b := range s.budgets {
		result = append(result, b)
	}
	return result
}

func (s *InMemoryStorage) UpdateBudget(budget *model.ErrorBudget) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.budgets[budget.ID]; !ok {
		return ErrNotFound
	}
	s.budgets[budget.ID] = budget
	return nil
}

func (s *InMemoryStorage) SaveWindow(window *model.RequestWindow) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.windows[window.ID] = window
	return nil
}

func (s *InMemoryStorage) GetWindow(id string) (*model.RequestWindow, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	window, ok := s.windows[id]
	if !ok {
		return nil, ErrNotFound
	}
	return window, nil
}

func (s *InMemoryStorage) GetActiveWindow(budgetID string) (*model.RequestWindow, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, w := range s.windows {
		if w.BudgetID == budgetID && w.IsActive {
			return w, nil
		}
	}
	return nil, ErrNotFound
}

func (s *InMemoryStorage) ListWindows(budgetID string) []*model.RequestWindow {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.RequestWindow, 0)
	for _, w := range s.windows {
		if w.BudgetID == budgetID {
			result = append(result, w)
		}
	}
	return result
}

func (s *InMemoryStorage) UpdateWindow(window *model.RequestWindow) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.windows[window.ID]; !ok {
		return ErrNotFound
	}
	s.windows[window.ID] = window
	return nil
}

func (s *InMemoryStorage) SaveDeductEvent(event *model.DeductEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.requestIDMap[event.RequestID]; ok {
		return ErrDuplicate
	}
	s.deductEvents[event.ID] = event
	s.requestIDMap[event.RequestID] = event.ID
	return nil
}

func (s *InMemoryStorage) GetDeductEvent(id string) (*model.DeductEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	event, ok := s.deductEvents[id]
	if !ok {
		return nil, ErrNotFound
	}
	return event, nil
}

func (s *InMemoryStorage) GetDeductEventByRequestID(requestID string) (*model.DeductEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	eventID, ok := s.requestIDMap[requestID]
	if !ok {
		return nil, ErrNotFound
	}
	return s.deductEvents[eventID], nil
}

func (s *InMemoryStorage) ListDeductEvents(budgetID string, startTime, endTime *time.Time) []*model.DeductEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.DeductEvent, 0)
	for _, e := range s.deductEvents {
		if e.BudgetID == budgetID {
			if startTime != nil && e.Timestamp.Before(*startTime) {
				continue
			}
			if endTime != nil && e.Timestamp.After(*endTime) {
				continue
			}
			result = append(result, e)
		}
	}
	return result
}

func (s *InMemoryStorage) UpdateDeductEvent(event *model.DeductEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.deductEvents[event.ID]; !ok {
		return ErrNotFound
	}
	s.deductEvents[event.ID] = event
	return nil
}

func (s *InMemoryStorage) SaveExemption(exemption *model.Exemption) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.exemptions[exemption.ID] = exemption
	return nil
}

func (s *InMemoryStorage) GetExemption(id string) (*model.Exemption, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	exemption, ok := s.exemptions[id]
	if !ok {
		return nil, ErrNotFound
	}
	return exemption, nil
}

func (s *InMemoryStorage) ListExemptions(budgetID string) []*model.Exemption {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.Exemption, 0)
	for _, e := range s.exemptions {
		if e.BudgetID == budgetID {
			result = append(result, e)
		}
	}
	return result
}

func (s *InMemoryStorage) UpdateExemption(exemption *model.Exemption) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.exemptions[exemption.ID]; !ok {
		return ErrNotFound
	}
	s.exemptions[exemption.ID] = exemption
	return nil
}

func (s *InMemoryStorage) SaveFreezeAction(action *model.FreezeAction) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.freezeActions[action.ID] = action
	return nil
}

func (s *InMemoryStorage) GetFreezeAction(id string) (*model.FreezeAction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	action, ok := s.freezeActions[id]
	if !ok {
		return nil, ErrNotFound
	}
	return action, nil
}

func (s *InMemoryStorage) GetActiveFreeze(budgetID string) (*model.FreezeAction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, a := range s.freezeActions {
		if a.BudgetID == budgetID && a.IsFrozen {
			return a, nil
		}
	}
	return nil, ErrNotFound
}

func (s *InMemoryStorage) ListFreezeActions(budgetID string) []*model.FreezeAction {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.FreezeAction, 0)
	for _, a := range s.freezeActions {
		if a.BudgetID == budgetID {
			result = append(result, a)
		}
	}
	return result
}

func (s *InMemoryStorage) UpdateFreezeAction(action *model.FreezeAction) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, ok := s.freezeActions[action.ID]; !ok {
		return ErrNotFound
	}
	s.freezeActions[action.ID] = action
	return nil
}

func (s *InMemoryStorage) SaveTimelineEntry(entry *model.TimelineEntry) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.timeline[entry.BudgetID] == nil {
		s.timeline[entry.BudgetID] = make([]*model.TimelineEntry, 0)
	}
	s.timeline[entry.BudgetID] = append(s.timeline[entry.BudgetID], entry)
	return nil
}

func (s *InMemoryStorage) ListTimeline(budgetID string, limit, offset int) []*model.TimelineEntry {
	s.mu.RLock()
	defer s.mu.RUnlock()
	entries, ok := s.timeline[budgetID]
	if !ok {
		return []*model.TimelineEntry{}
	}
	if offset >= len(entries) {
		return []*model.TimelineEntry{}
	}
	end := offset + limit
	if end > len(entries) {
		end = len(entries)
	}
	return entries[offset:end]
}

func (s *InMemoryStorage) GetTimelineCount(budgetID string) int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.timeline[budgetID])
}

func (s *InMemoryStorage) SaveCompensation(compensation *model.Compensation) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.compensations[compensation.ID] = compensation
	return nil
}

func (s *InMemoryStorage) GetCompensation(id string) (*model.Compensation, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	compensation, ok := s.compensations[id]
	if !ok {
		return nil, ErrNotFound
	}
	return compensation, nil
}

func (s *InMemoryStorage) ListCompensations(budgetID string) []*model.Compensation {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*model.Compensation, 0)
	for _, c := range s.compensations {
		if c.BudgetID == budgetID {
			result = append(result, c)
		}
	}
	return result
}
