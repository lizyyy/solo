package store

import (
	"db-pool-protect-api/internal/model"
	"encoding/json"
	"os"
	"sync"
	"time"
)

type DataStore interface {
	CreateRule(rule *model.ProtectionRule) error
	GetRule(id string) (*model.ProtectionRule, error)
	ListRules() ([]*model.ProtectionRule, error)
	UpdateRule(rule *model.ProtectionRule) error
	DeleteRule(id string) error

	RecordConnectionStats(stats *model.ConnectionStats) error
	ListConnectionStats(ruleID string, limit int) ([]*model.ConnectionStats, error)

	RecordSlowQuery(record *model.SlowQueryRecord) error
	ListSlowQueries(ruleID string, limit int) ([]*model.SlowQueryRecord, error)

	CreateProtectionEvent(event *model.ProtectionEvent) error
	ListProtectionEvents(ruleID string, limit int) ([]*model.ProtectionEvent, error)

	CreateRestoreRecord(record *model.RestoreRecord) error
	ListRestoreRecords(ruleID string, limit int) ([]*model.RestoreRecord, error)

	AddHistory(record *model.HistoryRecord) error
	ListHistory(resourceID string, limit int) ([]*model.HistoryRecord, error)

	CheckRequestID(requestID string) bool
	SaveToFile(filename string) error
	LoadFromFile(filename string) error
}

type MemoryStore struct {
	rules            map[string]*model.ProtectionRule
	connectionStats  map[string][]*model.ConnectionStats
	slowQueries      map[string][]*model.SlowQueryRecord
	protectionEvents map[string][]*model.ProtectionEvent
	restoreRecords   map[string][]*model.RestoreRecord
	history          map[string][]*model.HistoryRecord
	requestIDSet     map[string]bool
	mu               sync.RWMutex
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		rules:            make(map[string]*model.ProtectionRule),
		connectionStats:  make(map[string][]*model.ConnectionStats),
		slowQueries:      make(map[string][]*model.SlowQueryRecord),
		protectionEvents: make(map[string][]*model.ProtectionEvent),
		restoreRecords:   make(map[string][]*model.RestoreRecord),
		history:          make(map[string][]*model.HistoryRecord),
		requestIDSet:     make(map[string]bool),
	}
}

func (s *MemoryStore) CreateRule(rule *model.ProtectionRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if rule.RequestID != "" {
		if s.requestIDSet[rule.RequestID] {
			return nil
		}
		s.requestIDSet[rule.RequestID] = true
	}

	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	rule.Version = 1
	s.rules[rule.ID] = rule
	return nil
}

func (s *MemoryStore) GetRule(id string) (*model.ProtectionRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rule, ok := s.rules[id]
	if !ok {
		return nil, nil
	}
	return rule, nil
}

func (s *MemoryStore) ListRules() ([]*model.ProtectionRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	rules := make([]*model.ProtectionRule, 0, len(s.rules))
	for _, rule := range s.rules {
		rules = append(rules, rule)
	}
	return rules, nil
}

func (s *MemoryStore) UpdateRule(rule *model.ProtectionRule) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	oldRule := s.rules[rule.ID]
	if oldRule != nil {
		rule.Version = oldRule.Version + 1
	}
	rule.UpdatedAt = time.Now()
	s.rules[rule.ID] = rule
	return nil
}

func (s *MemoryStore) DeleteRule(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	delete(s.rules, id)
	return nil
}

func (s *MemoryStore) RecordConnectionStats(stats *model.ConnectionStats) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	stats.ID = model.NewUUID()
	stats.Timestamp = time.Now()
	s.connectionStats[stats.RuleID] = append(s.connectionStats[stats.RuleID], stats)
	return nil
}

func (s *MemoryStore) ListConnectionStats(ruleID string, limit int) ([]*model.ConnectionStats, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	stats := s.connectionStats[ruleID]
	if limit > 0 && len(stats) > limit {
		stats = stats[len(stats)-limit:]
	}
	return stats, nil
}

func (s *MemoryStore) RecordSlowQuery(record *model.SlowQueryRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	record.ID = model.NewUUID()
	record.Timestamp = time.Now()
	s.slowQueries[record.RuleID] = append(s.slowQueries[record.RuleID], record)
	return nil
}

func (s *MemoryStore) ListSlowQueries(ruleID string, limit int) ([]*model.SlowQueryRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	records := s.slowQueries[ruleID]
	if limit > 0 && len(records) > limit {
		records = records[len(records)-limit:]
	}
	return records, nil
}

func (s *MemoryStore) CreateProtectionEvent(event *model.ProtectionEvent) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	event.ID = model.NewUUID()
	event.Timestamp = time.Now()
	s.protectionEvents[event.RuleID] = append(s.protectionEvents[event.RuleID], event)
	return nil
}

func (s *MemoryStore) ListProtectionEvents(ruleID string, limit int) ([]*model.ProtectionEvent, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	events := s.protectionEvents[ruleID]
	if limit > 0 && len(events) > limit {
		events = events[len(events)-limit:]
	}
	return events, nil
}

func (s *MemoryStore) CreateRestoreRecord(record *model.RestoreRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	record.ID = model.NewUUID()
	record.Timestamp = time.Now()
	s.restoreRecords[record.RuleID] = append(s.restoreRecords[record.RuleID], record)
	return nil
}

func (s *MemoryStore) ListRestoreRecords(ruleID string, limit int) ([]*model.RestoreRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	records := s.restoreRecords[ruleID]
	if limit > 0 && len(records) > limit {
		records = records[len(records)-limit:]
	}
	return records, nil
}

func (s *MemoryStore) AddHistory(record *model.HistoryRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	record.ID = model.NewUUID()
	record.Timestamp = time.Now()
	s.history[record.ResourceID] = append(s.history[record.ResourceID], record)
	return nil
}

func (s *MemoryStore) ListHistory(resourceID string, limit int) ([]*model.HistoryRecord, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var records []*model.HistoryRecord
	if resourceID == "" {
		for _, recs := range s.history {
			records = append(records, recs...)
		}
	} else {
		records = s.history[resourceID]
	}

	if limit > 0 && len(records) > limit {
		records = records[len(records)-limit:]
	}
	return records, nil
}

func (s *MemoryStore) CheckRequestID(requestID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.requestIDSet[requestID]
}

func (s *MemoryStore) SaveToFile(filename string) error {
	s.mu.RLock()
	defer s.mu.RUnlock()

	data := map[string]any{
		"rules":             s.rules,
		"connection_stats":  s.connectionStats,
		"slow_queries":      s.slowQueries,
		"protection_events": s.protectionEvents,
		"restore_records":   s.restoreRecords,
		"history":           s.history,
		"request_ids":       s.requestIDSet,
	}

	jsonData, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	return os.WriteFile(filename, jsonData, 0644)
}

func (s *MemoryStore) LoadFromFile(filename string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(filename); os.IsNotExist(err) {
		return nil
	}

	data, err := os.ReadFile(filename)
	if err != nil {
		return err
	}

	var loaded struct {
		Rules            map[string]*model.ProtectionRule   `json:"rules"`
		ConnectionStats  map[string][]*model.ConnectionStats `json:"connection_stats"`
		SlowQueries      map[string][]*model.SlowQueryRecord `json:"slow_queries"`
		ProtectionEvents map[string][]*model.ProtectionEvent `json:"protection_events"`
		RestoreRecords   map[string][]*model.RestoreRecord   `json:"restore_records"`
		History          map[string][]*model.HistoryRecord   `json:"history"`
		RequestIDs       map[string]bool                     `json:"request_ids"`
	}

	if err := json.Unmarshal(data, &loaded); err != nil {
		return err
	}

	if loaded.Rules != nil {
		s.rules = loaded.Rules
	}
	if loaded.ConnectionStats != nil {
		s.connectionStats = loaded.ConnectionStats
	}
	if loaded.SlowQueries != nil {
		s.slowQueries = loaded.SlowQueries
	}
	if loaded.ProtectionEvents != nil {
		s.protectionEvents = loaded.ProtectionEvents
	}
	if loaded.RestoreRecords != nil {
		s.restoreRecords = loaded.RestoreRecords
	}
	if loaded.History != nil {
		s.history = loaded.History
	}
	if loaded.RequestIDs != nil {
		s.requestIDSet = loaded.RequestIDs
	}

	return nil
}
