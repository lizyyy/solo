package service

import (
	"api-cache-tribunal/models"
	"api-cache-tribunal/storage"
	"encoding/json"
	"errors"
	"time"
)

type TribunalService struct {
	storage *storage.MemoryStorage
}

func NewTribunalService(storage *storage.MemoryStorage) *TribunalService {
	return &TribunalService{
		storage: storage,
	}
}

func (s *TribunalService) CreateStrategy(path, method string, ttl time.Duration, paramKeys []string) (*models.CacheStrategy, error) {
	if path == "" || method == "" {
		return nil, errors.New("path and method are required")
	}
	if ttl <= 0 {
		return nil, errors.New("ttl must be positive")
	}
	strategy := &models.CacheStrategy{
		ID:        models.GenerateID(),
		Path:      path,
		Method:    method,
		TTL:       ttl,
		ParamKeys: paramKeys,
		Enabled:   true,
	}
	err := s.storage.CreateStrategy(strategy)
	if err != nil {
		return nil, err
	}
	return strategy, nil
}

func (s *TribunalService) CheckCache(path, method string, params map[string]interface{}) (*models.CacheRecord, string, error) {
	strategy, err := s.storage.GetStrategyByPathAndMethod(path, method)
	if err != nil {
		return nil, "no strategy found", nil
	}
	paramHash := models.HashParams(params, strategy.ParamKeys)
	bypass, err := s.storage.GetBypassRecord(path, method, paramHash)
	if err == nil {
		return nil, "bypassed: " + bypass.Reason, nil
	}
	record, err := s.storage.GetRecordByHash(strategy.ID, paramHash)
	if err != nil {
		return nil, "miss: no cached record", nil
	}
	if record.Status != models.StatusActive {
		return nil, "miss: record not active", nil
	}
	if time.Now().After(record.ExpiresAt) {
		s.UpdateRecordStatus(record.ID, models.StatusExpired)
		return nil, "miss: expired", nil
	}
	now := time.Now()
	record.HitCount++
	record.LastHitAt = &now
	record.HitReason = "cache hit, ttl remaining: " + time.Until(record.ExpiresAt).String()
	s.storage.UpdateRecord(record)
	return record, record.HitReason, nil
}

func (s *TribunalService) CreateRecord(strategyID string, params map[string]interface{}, response interface{}) (*models.CacheRecord, error) {
	strategy, err := s.storage.GetStrategy(strategyID)
	if err != nil {
		return nil, err
	}
	paramHash := models.HashParams(params, strategy.ParamKeys)
	existing, _ := s.storage.GetRecordByHash(strategyID, paramHash)
	if existing != nil {
		return existing, nil
	}
	responseBytes, err := json.Marshal(response)
	if err != nil {
		return nil, err
	}
	record := &models.CacheRecord{
		ID:         models.GenerateID(),
		StrategyID: strategyID,
		Path:       strategy.Path,
		Method:     strategy.Method,
		ParamHash:  paramHash,
		Params:     params,
		Response:   responseBytes,
		Status:     models.StatusPending,
		HitCount:   0,
		ExpiresAt:  time.Now().Add(strategy.TTL),
	}
	err = s.storage.CreateRecord(record)
	if err != nil {
		return nil, err
	}
	return record, nil
}

func (s *TribunalService) UpdateRecordStatus(recordID string, newStatus models.CacheStatus) error {
	record, err := s.storage.GetRecord(recordID)
	if err != nil {
		return err
	}
	if !record.CanTransitionTo(newStatus) {
		return errors.New("invalid status transition from " + string(record.Status) + " to " + string(newStatus))
	}
	record.Status = newStatus
	return s.storage.UpdateRecord(record)
}

func (s *TribunalService) InvalidateCache(recordID, reason, operator string) error {
	err := s.UpdateRecordStatus(recordID, models.StatusInvalid)
	if err != nil {
		return err
	}
	event := &models.InvalidationEvent{
		RecordID: recordID,
		Reason:   reason,
		Operator: operator,
	}
	return s.storage.CreateInvalidationEvent(event)
}

func (s *TribunalService) CreateBypass(path, method string, params map[string]interface{}, reason, operator string, duration time.Duration) (*models.BypassRecord, error) {
	strategy, err := s.storage.GetStrategyByPathAndMethod(path, method)
	if err != nil {
		return nil, err
	}
	paramHash := models.HashParams(params, strategy.ParamKeys)
	bypass := &models.BypassRecord{
		ID:        models.GenerateID(),
		Path:      path,
		Method:    method,
		ParamHash: paramHash,
		Params:    params,
		Reason:    reason,
		Operator:  operator,
		ExpiresAt: time.Now().Add(duration),
	}
	err = s.storage.CreateBypassRecord(bypass)
	if err != nil {
		return nil, err
	}
	return bypass, nil
}

func (s *TribunalService) GetRecordHistory(recordID string) ([]*models.InvalidationEvent, error) {
	_, err := s.storage.GetRecord(recordID)
	if err != nil {
		return nil, err
	}
	return s.storage.ListInvalidationEvents(recordID), nil
}

func (s *TribunalService) ListRecords(strategyID string) []*models.CacheRecord {
	return s.storage.ListRecords(strategyID)
}

func (s *TribunalService) ListStrategies() []*models.CacheStrategy {
	return s.storage.ListStrategies()
}

func (s *TribunalService) GetAuditLogs(limit int) []*models.AuditLog {
	return s.storage.ListAuditLogs(limit)
}

func (s *TribunalService) ExportRecords(strategyID string) ([]byte, error) {
	records := s.storage.ListRecords(strategyID)
	return json.MarshalIndent(records, "", "  ")
}
