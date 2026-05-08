package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"time"

	"gorm.io/gorm"

	"chaos-payment/internal/cache"
	"chaos-payment/internal/eventbus"
	"chaos-payment/internal/models"
)

type RecoveryService struct {
	db           *gorm.DB
	cache        *cache.Cache
	bus          *eventbus.EventBus
	stateManager *eventbus.StateManager
}

func NewRecoveryService(db *gorm.DB, c *cache.Cache, bus *eventbus.EventBus, sm *eventbus.StateManager) *RecoveryService {
	return &RecoveryService{
		db:           db,
		cache:        c,
		bus:          bus,
		stateManager: sm,
	}
}

type ReplayResult struct {
	EventsProcessed int                    `json:"events_processed"`
	FinalState      map[string]interface{} `json:"final_state"`
	Errors          []string               `json:"errors"`
}

func (rs *RecoveryService) ReplayEvents(ctx context.Context, entityID string, startTime, endTime time.Time) (*ReplayResult, error) {
	events, err := rs.bus.GetEvents(entityID, nil, &startTime, &endTime, 10000)
	if err != nil {
		return nil, err
	}

	if len(events) == 0 {
		return &ReplayResult{EventsProcessed: 0}, nil
	}

	sort.Slice(events, func(i, j int) bool {
		return events[i].Timestamp.Before(events[j].Timestamp)
	})

	result := &ReplayResult{
		EventsProcessed: 0,
		FinalState:      make(map[string]interface{}),
		Errors:          make([]string, 0),
	}

	var currentState map[string]interface{}

	for _, event := range events {
		if event.IsReplay {
			continue
		}

		result.EventsProcessed++

		var newValue map[string]interface{}
		if event.NewValue != "" {
			json.Unmarshal([]byte(event.NewValue), &newValue)
		}

		switch eventbus.EventType(event.EventType) {
		case eventbus.EventTypeOrderCreated:
			currentState = newValue
		case eventbus.EventTypeOrderStatusChanged:
			if currentState != nil {
				if status, ok := newValue["new_status"]; ok {
					currentState["status"] = status
				}
			}
		case eventbus.EventTypePaymentCallback:
			if currentState != nil {
				if count, ok := currentState["callback_count"].(float64); ok {
					currentState["callback_count"] = count + 1
				} else {
					currentState["callback_count"] = float64(1)
				}
			}
		}

		rs.bus.Publish(eventbus.EventType(event.EventType), event.EntityID, event.EntityType,
			nil, newValue, fmt.Sprintf("replay-%s", event.ID))
	}

	result.FinalState = currentState
	return result, nil
}

func (rs *RecoveryService) RevertToSnapshot(ctx context.Context, entityType, entityID string, snapshotTime time.Time) error {
	snapshot, err := rs.stateManager.GetSnapshotsAtTime(entityType, entityID, snapshotTime)
	if err != nil {
		return fmt.Errorf("snapshot not found: %w", err)
	}

	rs.bus.Publish(eventbus.EventTypeRecoveryAction, entityID, entityType,
		map[string]interface{}{
			"action":         "revert",
			"snapshot_time":  snapshot.Timestamp,
			"snapshot_state": snapshot.State,
		},
		nil,
		"recovery-service")

	if entityType == "order" {
		var state eventbus.OrderState
		if err := json.Unmarshal([]byte(snapshot.State), &state); err != nil {
			return err
		}

		tx := rs.db.Begin()
		if tx.Error != nil {
			return tx.Error
		}

		if err := tx.Model(&models.Order{}).Where("id = ?", entityID).Updates(map[string]interface{}{
			"status":         state.Status,
			"callback_count": state.CallbackCount,
		}).Error; err != nil {
			tx.Rollback()
			return err
		}

		if err := tx.Commit().Error; err != nil {
			return err
		}

		if rs.cache != nil {
			rs.cache.DelOrder(ctx, entityID)
		}

		rs.bus.Publish(eventbus.EventTypeOrderStatusChanged, entityID, "order",
			nil, map[string]interface{}{"reverted_to": state.Status},
			"recovery-service")
	}

	return nil
}

func (rs *RecoveryService) FixDuplicateCallback(ctx context.Context, orderID string) (bool, error) {
	var callbacks []models.PaymentCallback
	if err := rs.db.Where("order_id = ?", orderID).Find(&callbacks).Error; err != nil {
		return false, err
	}

	seen := make(map[string]bool)
	var validCallbacks []models.PaymentCallback
	removedCount := 0

	for _, cb := range callbacks {
		if !seen[cb.TransactionID] {
			seen[cb.TransactionID] = true
			validCallbacks = append(validCallbacks, cb)
		} else {
			removedCount++
		}
	}

	if removedCount == 0 {
		return false, nil
	}

	tx := rs.db.Begin()
	if tx.Error != nil {
		return false, tx.Error
	}

	for _, cb := range callbacks {
		if seen[cb.TransactionID] {
			continue
		}
		if err := tx.Delete(&cb).Error; err != nil {
			tx.Rollback()
			return false, err
		}
	}

	if err := tx.Model(&models.Order{}).Where("id = ?", orderID).
		Update("callback_count", len(validCallbacks)).Error; err != nil {
		tx.Rollback()
		return false, err
	}

	if err := tx.Commit().Error; err != nil {
		return false, err
	}

	if rs.cache != nil {
		rs.cache.DelOrder(ctx, orderID)
	}

	rs.bus.Publish(eventbus.EventTypeRecoveryAction, orderID, "order",
		map[string]interface{}{"duplicates_removed": removedCount},
		nil,
		"recovery-service")

	return true, nil
}

func (rs *RecoveryService) FixCacheDirtyData(ctx context.Context, orderID string) (bool, error) {
	if rs.cache == nil {
		return false, fmt.Errorf("cache not initialized")
	}

	var order models.Order
	if err := rs.db.Where("id = ?", orderID).First(&order).Error; err != nil {
		return false, err
	}

	if err := rs.cache.SetOrder(ctx, &order, 5*time.Minute); err != nil {
		return false, err
	}

	rs.bus.Publish(eventbus.EventTypeRecoveryAction, orderID, "cache",
		map[string]interface{}{"action": "cache_sync_with_db"},
		nil,
		"recovery-service")

	return true, nil
}

func (rs *RecoveryService) AnalyzeAnomalies(ctx context.Context, startTime, endTime time.Time) ([]map[string]interface{}, error) {
	events, err := rs.bus.GetTimeline(startTime, endTime, 10000)
	if err != nil {
		return nil, err
	}

	anomalies := make([]map[string]interface{}, 0)

	transactionCounts := make(map[string]int)
	orderStatusChanges := make(map[string][]string)

	for _, event := range events {
		switch eventbus.EventType(event.EventType) {
		case eventbus.EventTypeDuplicateCallback:
			anomalies = append(anomalies, map[string]interface{}{
				"type":      "duplicate_callback",
				"entity_id": event.EntityID,
				"timestamp": event.Timestamp,
				"severity":  "high",
				"message":   "检测到重复支付回调",
			})

		case eventbus.EventTypePaymentCallback:
			transactionCounts[event.EntityID]++

		case eventbus.EventTypeOrderStatusChanged:
			orderStatusChanges[event.EntityID] = append(orderStatusChanges[event.EntityID], event.EventType)
		}
	}

	for orderID, count := range transactionCounts {
		if count > 3 {
			anomalies = append(anomalies, map[string]interface{}{
				"type":      "excessive_callbacks",
				"entity_id": orderID,
				"timestamp": time.Now(),
				"severity":  "medium",
				"message":   fmt.Sprintf("订单有 %d 次回调，超过正常范围", count),
			})
		}
	}

	return anomalies, nil
}

func (rs *RecoveryService) GetRecoveryHistory(entityID string, limit int) ([]models.Event, error) {
	eventType := eventbus.EventTypeRecoveryAction
	return rs.bus.GetEvents(entityID, &eventType, nil, nil, limit)
}
