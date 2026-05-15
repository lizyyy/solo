package storage

import (
	"callback-whitelist-api/internal/model"
	"errors"
	"sync"
	"time"
)

var (
	ErrNotFound      = errors.New("resource not found")
	ErrDuplicate     = errors.New("duplicate request")
	ErrInvalidStatus = errors.New("invalid status transition")
)

type Storage struct {
	mu               sync.RWMutex
	parties          map[string]*model.CallbackParty
	sourceAddresses  map[string]*model.SourceAddress
	rules            map[string]*model.WhitelistRule
	ruleVersions     map[string]*model.RuleVersion
	requests         map[string]*model.VerificationRequest
	rejections       map[string]*model.RejectionRecord
	ruleIdempotency  map[string]string
	requestIdempotency map[string]string
}

func NewStorage() *Storage {
	return &Storage{
		parties:          make(map[string]*model.CallbackParty),
		sourceAddresses:  make(map[string]*model.SourceAddress),
		rules:            make(map[string]*model.WhitelistRule),
		ruleVersions:     make(map[string]*model.RuleVersion),
		requests:         make(map[string]*model.VerificationRequest),
		rejections:       make(map[string]*model.RejectionRecord),
		ruleIdempotency:  make(map[string]string),
		requestIdempotency: make(map[string]string),
	}
}

func (s *Storage) CheckRuleIdempotency(key string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, exists := s.ruleIdempotency[key]
	return id, exists
}

func (s *Storage) CheckRequestIdempotency(key string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, exists := s.requestIdempotency[key]
	return id, exists
}

func (s *Storage) CreateParty(party *model.CallbackParty) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	party.CreatedAt = time.Now()
	party.UpdatedAt = time.Now()
	s.parties[party.ID] = party
	return nil
}

func (s *Storage) GetParty(id string) (*model.CallbackParty, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	party, exists := s.parties[id]
	if !exists {
		return nil, ErrNotFound
	}
	return party, nil
}

func (s *Storage) AddSourceAddress(addr *model.SourceAddress) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	addr.CreatedAt = time.Now()
	addr.IsEnabled = true
	s.sourceAddresses[addr.ID] = addr
	return nil
}

func (s *Storage) GetSourceAddressesByParty(partyID string) []*model.SourceAddress {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var addrs []*model.SourceAddress
	for _, addr := range s.sourceAddresses {
		if addr.PartyID == partyID && addr.IsEnabled {
			addrs = append(addrs, addr)
		}
	}
	return addrs
}

func (s *Storage) CreateRule(rule *model.WhitelistRule, idempotencyKey string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if idempotencyKey != "" {
		if _, exists := s.ruleIdempotency[idempotencyKey]; exists {
			return ErrDuplicate
		}
		s.ruleIdempotency[idempotencyKey] = rule.ID
	}
	rule.CreatedAt = time.Now()
	rule.UpdatedAt = time.Now()
	rule.Version = 1
	rule.Status = model.RuleStatusDraft
	s.rules[rule.ID] = rule
	return nil
}

func (s *Storage) GetRule(id string) (*model.WhitelistRule, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	rule, exists := s.rules[id]
	if !exists {
		return nil, ErrNotFound
	}
	return rule, nil
}

func (s *Storage) GetRulesByParty(partyID string) []*model.WhitelistRule {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var rules []*model.WhitelistRule
	for _, rule := range s.rules {
		if rule.PartyID == partyID {
			rules = append(rules, rule)
		}
	}
	return rules
}

func (s *Storage) UpdateRuleStatus(id string, status model.RuleStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	rule, exists := s.rules[id]
	if !exists {
		return ErrNotFound
	}
	if !isValidStatusTransition(rule.Status, status) {
		return ErrInvalidStatus
	}
	rule.Status = status
	rule.UpdatedAt = time.Now()
	return nil
}

func (s *Storage) CreateRuleVersion(rv *model.RuleVersion) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	rv.CreatedAt = time.Now()
	s.ruleVersions[rv.ID] = rv
	return nil
}

func (s *Storage) GetRuleVersions(ruleID string) []*model.RuleVersion {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var versions []*model.RuleVersion
	for _, rv := range s.ruleVersions {
		if rv.RuleID == ruleID {
			versions = append(versions, rv)
		}
	}
	return versions
}

func (s *Storage) CreateRequest(req *model.VerificationRequest, idempotencyKey string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if idempotencyKey != "" {
		if _, exists := s.requestIdempotency[idempotencyKey]; exists {
			return ErrDuplicate
		}
		s.requestIdempotency[idempotencyKey] = req.ID
	}
	req.VerifiedAt = time.Now()
	s.requests[req.ID] = req
	return nil
}

func (s *Storage) GetRequest(id string) (*model.VerificationRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	req, exists := s.requests[id]
	if !exists {
		return nil, ErrNotFound
	}
	return req, nil
}

func (s *Storage) CreateRejection(rec *model.RejectionRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	rec.RejectedAt = time.Now()
	s.rejections[rec.ID] = rec
	return nil
}

func (s *Storage) GetRejections(filter map[string]interface{}) []*model.RejectionRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var recs []*model.RejectionRecord
	for _, rec := range s.rejections {
		match := true
		if partyID, ok := filter["party_id"].(string); ok && partyID != "" {
			match = match && (rec.PartyID == partyID)
		}
		if ruleID, ok := filter["rule_id"].(string); ok && ruleID != "" {
			match = match && (rec.RuleID == ruleID)
		}
		if match {
			recs = append(recs, rec)
		}
	}
	return recs
}

func isValidStatusTransition(from, to model.RuleStatus) bool {
	transitions := map[model.RuleStatus][]model.RuleStatus{
		model.RuleStatusDraft:    {model.RuleStatusTesting, model.RuleStatusInactive},
		model.RuleStatusTesting:  {model.RuleStatusActive, model.RuleStatusDraft, model.RuleStatusInactive},
		model.RuleStatusActive:   {model.RuleStatusTesting, model.RuleStatusInactive, model.RuleStatusRollback},
		model.RuleStatusInactive: {model.RuleStatusDraft},
		model.RuleStatusRollback: {model.RuleStatusActive, model.RuleStatusDraft},
	}
	for _, allowed := range transitions[from] {
		if allowed == to {
			return true
		}
	}
	return false
}
