package storage

import (
	"auth-simulator-api/internal/model"
	"auth-simulator-api/pkg/utils"
	"sync"
)

type MemoryStorage struct {
	simulations   map[string]*model.SimulationResult
	idempotency   map[string]string
	partners      map[string]*model.Partner
	scopes        map[string]*model.PermissionScope
	mu            sync.RWMutex
}

func NewMemoryStorage() *MemoryStorage {
	s := &MemoryStorage{
		simulations: make(map[string]*model.SimulationResult),
		idempotency: make(map[string]string),
		partners:    make(map[string]*model.Partner),
		scopes:      make(map[string]*model.PermissionScope),
	}
	s.initSeedData()
	return s
}

func (s *MemoryStorage) initSeedData() {
	s.partners["P001"] = &model.Partner{
		ID:          "P001",
		Name:        "测试合作方",
		Code:        "TEST_PARTNER",
		Description: "用于测试的合作方",
		CreatedAt:   utils.Now(),
	}

	s.scopes["user:read"] = &model.PermissionScope{
		ID:          "S001",
		Name:        "用户读取",
		Code:        "user:read",
		Description: "读取用户基本信息",
		Resources:   []string{"/api/v1/user/profile", "/api/v1/user/info"},
	}

	s.scopes["user:write"] = &model.PermissionScope{
		ID:          "S002",
		Name:        "用户写入",
		Code:        "user:write",
		Description: "修改用户信息",
		Resources:   []string{"/api/v1/user/profile"},
		ParentID:    "S001",
	}

	s.scopes["order:read"] = &model.PermissionScope{
		ID:          "S003",
		Name:        "订单读取",
		Code:        "order:read",
		Description: "读取订单信息",
		Resources:   []string{"/api/v1/order/list", "/api/v1/order/detail"},
	}

	s.scopes["order:write"] = &model.PermissionScope{
		ID:          "S004",
		Name:        "订单写入",
		Code:        "order:write",
		Description: "创建和修改订单",
		Resources:   []string{"/api/v1/order/create", "/api/v1/order/update"},
		ParentID:    "S003",
	}
}

func (s *MemoryStorage) CheckIdempotency(key string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, exists := s.idempotency[key]
	return id, exists
}

func (s *MemoryStorage) SaveIdempotency(key, simulationID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.idempotency[key] = simulationID
}

func (s *MemoryStorage) CreateSimulation(sim *model.SimulationResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.simulations[sim.ID] = sim
	return nil
}

func (s *MemoryStorage) UpdateSimulation(sim *model.SimulationResult) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.simulations[sim.ID]; !exists {
		return nil
	}
	sim.UpdatedAt = utils.Now()
	s.simulations[sim.ID] = sim
	return nil
}

func (s *MemoryStorage) GetSimulation(id string) (*model.SimulationResult, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	sim, exists := s.simulations[id]
	return sim, exists
}

func (s *MemoryStorage) GetPartner(id string) (*model.Partner, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	partner, exists := s.partners[id]
	return partner, exists
}

func (s *MemoryStorage) GetScope(code string) (*model.PermissionScope, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	scope, exists := s.scopes[code]
	return scope, exists
}

func (s *MemoryStorage) GetAllScopes() []*model.PermissionScope {
	s.mu.RLock()
	defer s.mu.RUnlock()
	scopes := make([]*model.PermissionScope, 0, len(s.scopes))
	for _, scope := range s.scopes {
		scopes = append(scopes, scope)
	}
	return scopes
}

func (s *MemoryStorage) QueryHistory(req model.QueryHistoryRequest) (*model.HistoryResponse, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var allItems []*model.SimulationResult
	for _, sim := range s.simulations {
		match := true
		if req.PartnerID != "" && sim.PartnerID != req.PartnerID {
			match = false
		}
		if req.Status != "" && sim.Status != req.Status {
			match = false
		}
		if !req.StartTime.IsZero() && sim.CreatedAt.Before(req.StartTime) {
			match = false
		}
		if !req.EndTime.IsZero() && sim.CreatedAt.After(req.EndTime) {
			match = false
		}
		if match {
			allItems = append(allItems, sim)
		}
	}

	total := int64(len(allItems))
	start := (req.Page - 1) * req.PageSize
	end := start + req.PageSize
	if start > len(allItems) {
		start = len(allItems)
	}
	if end > len(allItems) {
		end = len(allItems)
	}

	pagedItems := allItems[start:end]
	resultItems := make([]model.SimulationResult, len(pagedItems))
	for i, item := range pagedItems {
		resultItems[i] = *item
	}

	return &model.HistoryResponse{
		Total:    total,
		Page:     req.Page,
		PageSize: req.PageSize,
		Items:    resultItems,
	}, nil
}
