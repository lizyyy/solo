package test

import (
	"api-cache-tribunal/models"
	"api-cache-tribunal/service"
	"api-cache-tribunal/storage"
	"testing"
	"time"
)

func TestDuplicateRecordCreation(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := service.NewTribunalService(store)
	strategy, _ := svc.CreateStrategy("/api/test", "GET", 5*time.Minute, []string{"id", "name"})
	params := map[string]interface{}{"id": "123", "name": "test"}
	response := map[string]interface{}{"data": "value"}
	record1, err := svc.CreateRecord(strategy.ID, params, response)
	if err != nil {
		t.Fatalf("First creation should succeed: %v", err)
	}
	record2, err := svc.CreateRecord(strategy.ID, params, response)
	if err != nil {
		t.Fatalf("Duplicate creation should not return error: %v", err)
	}
	if record1.ID != record2.ID {
		t.Error("Duplicate creation should return existing record, not create new one")
	}
	records := svc.ListRecords(strategy.ID)
	if len(records) != 1 {
		t.Errorf("Should have only 1 record, got %d", len(records))
	}
}

func TestInvalidStatusTransition(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := service.NewTribunalService(store)
	strategy, _ := svc.CreateStrategy("/api/test", "GET", 5*time.Minute, []string{"id"})
	params := map[string]interface{}{"id": "123"}
	response := map[string]interface{}{"data": "value"}
	record, _ := svc.CreateRecord(strategy.ID, params, response)
	err := svc.UpdateRecordStatus(record.ID, models.StatusActive)
	if err != nil {
		t.Errorf("Pending -> Active should be allowed: %v", err)
	}
	err = svc.UpdateRecordStatus(record.ID, models.StatusInvalid)
	if err != nil {
		t.Errorf("Active -> Invalid should be allowed: %v", err)
	}
	err = svc.UpdateRecordStatus(record.ID, models.StatusActive)
	if err == nil {
		t.Error("Invalid -> Active should NOT be allowed")
	}
	record2, _ := svc.CreateRecord(strategy.ID, map[string]interface{}{"id": "456"}, response)
	err = svc.UpdateRecordStatus(record2.ID, models.StatusBypassed)
	if err == nil {
		t.Error("Pending -> Bypassed should NOT be allowed")
	}
}

func TestDirtyDataWithExtraParams(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := service.NewTribunalService(store)
	strategy, _ := svc.CreateStrategy("/api/test", "GET", 5*time.Minute, []string{"id"})
	params1 := map[string]interface{}{"id": "123", "extra": "ignored"}
	params2 := map[string]interface{}{"id": "123", "other": "also_ignored"}
	response := map[string]interface{}{"data": "value"}
	record1, _ := svc.CreateRecord(strategy.ID, params1, response)
	record2, _ := svc.CreateRecord(strategy.ID, params2, response)
	if record1.ID != record2.ID {
		t.Error("Records with same key params should hash to same record")
	}
}

func TestCacheHitLogic(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := service.NewTribunalService(store)
	strategy, _ := svc.CreateStrategy("/api/test", "GET", 5*time.Minute, []string{"id"})
	params := map[string]interface{}{"id": "123"}
	response := map[string]interface{}{"data": "value"}
	record, _ := svc.CreateRecord(strategy.ID, params, response)
	cached, reason, _ := svc.CheckCache("/api/test", "GET", params)
	if cached != nil {
		t.Error("Pending record should not be hit: " + reason)
	}
	svc.UpdateRecordStatus(record.ID, models.StatusActive)
	cached, reason, _ = svc.CheckCache("/api/test", "GET", params)
	if cached == nil {
		t.Error("Active record should be hit: " + reason)
	}
}

func TestBypassMechanism(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := service.NewTribunalService(store)
	strategy, _ := svc.CreateStrategy("/api/test", "GET", 5*time.Minute, []string{"id"})
	params := map[string]interface{}{"id": "123"}
	response := map[string]interface{}{"data": "value"}
	record, _ := svc.CreateRecord(strategy.ID, params, response)
	svc.UpdateRecordStatus(record.ID, models.StatusActive)
	svc.CreateBypass("/api/test", "GET", params, "manual bypass", "admin", 1*time.Minute)
	cached, reason, _ := svc.CheckCache("/api/test", "GET", params)
	if cached != nil {
		t.Error("Bypassed record should not be hit: " + reason)
	}
}

func TestStatusTransitions(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := service.NewTribunalService(store)
	strategy, _ := svc.CreateStrategy("/api/test", "GET", 5*time.Minute, []string{"id"})
	params := map[string]interface{}{"id": "123"}
	response := map[string]interface{}{"data": "value"}
	record, _ := svc.CreateRecord(strategy.ID, params, response)
	if record.Status != models.StatusPending {
		t.Error("New record should be Pending")
	}
}

func TestStrategyIdempotency(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := service.NewTribunalService(store)
	strategy1, err := svc.CreateStrategy("/api/test", "GET", 5*time.Minute, []string{"id"})
	if err != nil {
		t.Fatalf("First strategy creation should succeed: %v", err)
	}
	strategy2, err := svc.CreateStrategy("/api/test", "GET", 10*time.Minute, []string{"id", "name"})
	if err != nil {
		t.Fatalf("Duplicate strategy creation should not return error: %v", err)
	}
	if strategy1.ID != strategy2.ID {
		t.Error("Duplicate strategy creation should return existing record, not create new one")
	}
	if strategy1.TTL != strategy2.TTL {
		t.Error("Existing strategy TTL should not be changed")
	}
	strategies := svc.ListStrategies()
	if len(strategies) != 1 {
		t.Errorf("Should have only 1 strategy, got %d", len(strategies))
	}
}

func TestAuditLogCoverage(t *testing.T) {
	store := storage.NewMemoryStorage()
	svc := service.NewTribunalService(store)
	strategy, _ := svc.CreateStrategy("/api/test", "GET", 5*time.Minute, []string{"id"})
	params := map[string]interface{}{"id": "123"}
	response := map[string]interface{}{"data": "value"}
	record, _ := svc.CreateRecord(strategy.ID, params, response)
	svc.UpdateRecordStatus(record.ID, models.StatusActive)
	svc.CreateBypass("/api/test", "GET", params, "debug", "admin", 1*time.Minute)
	svc.InvalidateCache(record.ID, "obsolete", "admin")
	svc.ExportRecords(strategy.ID)
	logs := svc.GetAuditLogs(100)
	if len(logs) == 0 {
		t.Error("Audit logs should not be empty")
	}
	actions := make(map[string]bool)
	for _, log := range logs {
		actions[log.Action] = true
	}
	expectedActions := []string{"create_strategy", "update_status", "create_bypass", "invalidate_cache", "export_records"}
	for _, action := range expectedActions {
		if !actions[action] {
			t.Errorf("Expected audit action not found: %s", action)
		}
	}
}
