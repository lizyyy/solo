package store

import (
	"env-switch-guard/internal/model"
	"sync"
	"time"
)

type Store interface {
	CreateTicket(ticket *model.ApprovalTicket) error
	GetTicket(id string) (*model.ApprovalTicket, error)
	GetTicketByIdempotentKey(key string) (*model.ApprovalTicket, error)
	UpdateTicket(ticket *model.ApprovalTicket) error
	ListTickets(query *model.HistoryQuery) ([]*model.ApprovalTicket, int, error)
	CreateResult(result *model.ChangeResult) error
	GetResult(id string) (*model.ChangeResult, error)
	GetResultsByTicketID(ticketID string) ([]*model.ChangeResult, error)
	CreateMisuseReport(report *model.MisuseReport) error
	GetSwitchItem(id string) (*model.SwitchItem, error)
	CreateSwitchItem(item *model.SwitchItem) error
}

type MemoryStore struct {
	tickets     map[string]*model.ApprovalTicket
	idempotentMap map[string]string
	results     map[string]*model.ChangeResult
	reports     map[string]*model.MisuseReport
	switchItems map[string]*model.SwitchItem
	mu          sync.RWMutex
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		tickets:       make(map[string]*model.ApprovalTicket),
		idempotentMap: make(map[string]string),
		results:       make(map[string]*model.ChangeResult),
		reports:       make(map[string]*model.MisuseReport),
		switchItems:   make(map[string]*model.SwitchItem),
	}
}

func (s *MemoryStore) CreateTicket(ticket *model.ApprovalTicket) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.tickets[ticket.ID] = ticket
	s.idempotentMap[ticket.IdempotentKey] = ticket.ID
	return nil
}

func (s *MemoryStore) GetTicket(id string) (*model.ApprovalTicket, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ticket, exists := s.tickets[id]
	if !exists {
		return nil, nil
	}
	return ticket, nil
}

func (s *MemoryStore) GetTicketByIdempotentKey(key string) (*model.ApprovalTicket, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	ticketID, exists := s.idempotentMap[key]
	if !exists {
		return nil, nil
	}
	return s.tickets[ticketID], nil
}

func (s *MemoryStore) UpdateTicket(ticket *model.ApprovalTicket) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	ticket.UpdatedAt = time.Now()
	s.tickets[ticket.ID] = ticket
	return nil
}

func (s *MemoryStore) ListTickets(query *model.HistoryQuery) ([]*model.ApprovalTicket, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result = make([]*model.ApprovalTicket, 0)
	for _, ticket := range s.tickets {
		if query.SwitchID != nil && *query.SwitchID != ticket.SwitchID {
			continue
		}
		if query.OperatorID != nil && *query.OperatorID != ticket.Operator.ID {
			continue
		}
		if query.Environment != nil && *query.Environment != ticket.Environment {
			continue
		}
		if query.Status != nil && *query.Status != ticket.Status {
			continue
		}
		if query.StartTime != nil && ticket.CreatedAt.Before(*query.StartTime) {
			continue
		}
		if query.EndTime != nil && ticket.CreatedAt.After(*query.EndTime) {
			continue
		}
		result = append(result, ticket)
	}

	total := len(result)
	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize <= 0 {
		pageSize = 10
	}
	start := (page - 1) * pageSize
	if start >= total {
		return []*model.ApprovalTicket{}, total, nil
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return result[start:end], total, nil
}

func (s *MemoryStore) CreateResult(result *model.ChangeResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.results[result.ID] = result
	return nil
}

func (s *MemoryStore) GetResult(id string) (*model.ChangeResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result, exists := s.results[id]
	if !exists {
		return nil, nil
	}
	return result, nil
}

func (s *MemoryStore) GetResultsByTicketID(ticketID string) ([]*model.ChangeResult, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var results []*model.ChangeResult
	for _, r := range s.results {
		if r.TicketID == ticketID {
			results = append(results, r)
		}
	}
	return results, nil
}

func (s *MemoryStore) CreateMisuseReport(report *model.MisuseReport) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.reports[report.ID] = report
	return nil
}

func (s *MemoryStore) GetSwitchItem(id string) (*model.SwitchItem, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	item, exists := s.switchItems[id]
	if !exists {
		return nil, nil
	}
	return item, nil
}

func (s *MemoryStore) CreateSwitchItem(item *model.SwitchItem) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.switchItems[item.ID] = item
	return nil
}
