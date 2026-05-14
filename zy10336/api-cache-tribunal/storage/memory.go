package storage

import (
	"api-cache-tribunal/models"
	"errors"
	"sync"
	"time"
)

type MemoryStorage struct {
	strategies         map[string]*models.CacheStrategy
	records            map[string]*models.CacheRecord
	invalidationEvents map[string]*models.InvalidationEvent
	bypassRecords      map[string]*models.BypassRecord
	auditLogs          []*models.AuditLog
	mu                 sync.RWMutex
}

func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{
		strategies:         make(map[string]*models.CacheStrategy),
		records:            make(map[string]*models.CacheRecord),
		invalidationEvents: make(map[string]*models.InvalidationEvent),
		bypassRecords:      make(map[string]*models.BypassRecord),
		auditLogs:          make([]*models.AuditLog, 0),
	}
}

func (s *MemoryStorage) CreateStrategy(strategy *models.CacheStrategy) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.strategies[strategy.ID]; exists {
		return errors.New("strategy already exists")
	}
	for _, existing := range s.strategies {
		if existing.Path == strategy.Path && existing.Method == strategy.Method {
			return errors.New("strategy with same path and method already exists")
		}
	}
	strategy.CreatedAt = time.Now()
	strategy.UpdatedAt = time.Now()
	s.strategies[strategy.ID] = strategy
	return nil
}

func (s *MemoryStorage) GetOrCreateStrategy(strategy *models.CacheStrategy) (*models.CacheStrategy, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	for _, existing := range s.strategies {
		if existing.Path == strategy.Path && existing.Method == strategy.Method {
			return existing, nil
		}
	}
	strategy.CreatedAt = time.Now()
	strategy.UpdatedAt = time.Now()
	s.strategies[strategy.ID] = strategy
	return strategy, nil
}

func (s *MemoryStorage) GetStrategy(id string) (*models.CacheStrategy, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	strategy, exists := s.strategies[id]
	if !exists {
		return nil, errors.New("strategy not found")
	}
	return strategy, nil
}

func (s *MemoryStorage) GetStrategyByPathAndMethod(path, method string) (*models.CacheStrategy, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, strategy := range s.strategies {
		if strategy.Path == path && strategy.Method == method && strategy.Enabled {
			return strategy, nil
		}
	}
	return nil, errors.New("strategy not found")
}

func (s *MemoryStorage) ListStrategies() []*models.CacheStrategy {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*models.CacheStrategy, 0, len(s.strategies))
	for _, strategy := range s.strategies {
		result = append(result, strategy)
	}
	return result
}

func (s *MemoryStorage) UpdateStrategy(strategy *models.CacheStrategy) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.strategies[strategy.ID]; !exists {
		return errors.New("strategy not found")
	}
	strategy.UpdatedAt = time.Now()
	s.strategies[strategy.ID] = strategy
	return nil
}

func (s *MemoryStorage) CreateRecord(record *models.CacheRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.records[record.ID]; exists {
		return errors.New("record already exists")
	}
	record.CreatedAt = time.Now()
	s.records[record.ID] = record
	return nil
}

func (s *MemoryStorage) GetRecord(id string) (*models.CacheRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	record, exists := s.records[id]
	if !exists {
		return nil, errors.New("record not found")
	}
	return record, nil
}

func (s *MemoryStorage) GetRecordByHash(strategyID, paramHash string) (*models.CacheRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, record := range s.records {
		if record.StrategyID == strategyID && record.ParamHash == paramHash {
			return record, nil
		}
	}
	return nil, errors.New("record not found")
}

func (s *MemoryStorage) ListRecords(strategyID string) []*models.CacheRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*models.CacheRecord, 0)
	for _, record := range s.records {
		if strategyID == "" || record.StrategyID == strategyID {
			result = append(result, record)
		}
	}
	return result
}

func (s *MemoryStorage) UpdateRecord(record *models.CacheRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.records[record.ID]; !exists {
		return errors.New("record not found")
	}
	s.records[record.ID] = record
	return nil
}

func (s *MemoryStorage) CreateInvalidationEvent(event *models.InvalidationEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	event.ID = models.GenerateID()
	event.CreatedAt = time.Now()
	s.invalidationEvents[event.ID] = event
	return nil
}

func (s *MemoryStorage) ListInvalidationEvents(recordID string) []*models.InvalidationEvent {
	s.mu.RLock()
	defer s.mu.RUnlock()
	result := make([]*models.InvalidationEvent, 0)
	for _, event := range s.invalidationEvents {
		if recordID == "" || event.RecordID == recordID {
			result = append(result, event)
		}
	}
	return result
}

func (s *MemoryStorage) CreateBypassRecord(bypass *models.BypassRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.bypassRecords[bypass.ID]; exists {
		return errors.New("bypass record already exists")
	}
	bypass.CreatedAt = time.Now()
	s.bypassRecords[bypass.ID] = bypass
	return nil
}

func (s *MemoryStorage) GetBypassRecord(path, method, paramHash string) (*models.BypassRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, bypass := range s.bypassRecords {
		if bypass.Path == path && bypass.Method == method &&
			bypass.ParamHash == paramHash && bypass.ExpiresAt.After(time.Now()) {
			return bypass, nil
		}
	}
	return nil, errors.New("bypass record not found")
}

func (s *MemoryStorage) AddAuditLog(log *models.AuditLog) {
	s.mu.Lock()
	defer s.mu.Unlock()
	log.ID = models.GenerateID()
	log.CreatedAt = time.Now()
	s.auditLogs = append(s.auditLogs, log)
}

func (s *MemoryStorage) ListAuditLogs(limit int) []*models.AuditLog {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if limit <= 0 || limit > len(s.auditLogs) {
		limit = len(s.auditLogs)
	}
	return s.auditLogs[len(s.auditLogs)-limit:]
}
