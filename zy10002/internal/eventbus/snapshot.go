package eventbus

import (
	"encoding/json"
	"sync"
	"time"

	"gorm.io/gorm"

	"chaos-payment/internal/models"
)

type StateManager struct {
	db              *gorm.DB
	snapshotMu      sync.RWMutex
	snapshotInterval time.Duration
}

func NewStateManager(db *gorm.DB, interval time.Duration) *StateManager {
	sm := &StateManager{
		db:              db,
		snapshotInterval: interval,
	}
	return sm
}

func (sm *StateManager) CreateSnapshot(entityType, entityID string, state interface{}) error {
	stateJSON, err := json.Marshal(state)
	if err != nil {
		return err
	}

	snapshot := &models.StateSnapshot{
		EntityType: entityType,
		EntityID:   entityID,
		State:      string(stateJSON),
		Timestamp:  time.Now(),
	}

	return sm.db.Create(snapshot).Error
}

func (sm *StateManager) GetLatestSnapshot(entityType, entityID string) (*models.StateSnapshot, error) {
	var snapshot models.StateSnapshot
	err := sm.db.Where("entity_type = ? AND entity_id = ?", entityType, entityID).
		Order("timestamp DESC").
		First(&snapshot).Error
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}

func (sm *StateManager) GetSnapshotsAtTime(entityType, entityID string, targetTime time.Time) (*models.StateSnapshot, error) {
	var snapshot models.StateSnapshot
	err := sm.db.Where("entity_type = ? AND entity_id = ? AND timestamp <= ?", entityType, entityID, targetTime).
		Order("timestamp DESC").
		First(&snapshot).Error
	if err != nil {
		return nil, err
	}
	return &snapshot, nil
}

func (sm *StateManager) ListSnapshots(entityType, entityID string, limit int) ([]models.StateSnapshot, error) {
	var snapshots []models.StateSnapshot
	err := sm.db.Where("entity_type = ? AND entity_id = ?", entityType, entityID).
		Order("timestamp DESC").
		Limit(limit).
		Find(&snapshots).Error
	return snapshots, err
}

type OrderState struct {
	ID            string              `json:"id"`
	Amount        float64             `json:"amount"`
	Status        models.OrderStatus  `json:"status"`
	CallbackCount int                 `json:"callback_count"`
	Transactions  []TransactionRecord `json:"transactions"`
}

type TransactionRecord struct {
	TransactionID string    `json:"transaction_id"`
	Amount        float64   `json:"amount"`
	Status        string    `json:"status"`
	ProcessedAt   time.Time `json:"processed_at"`
	IsDuplicate   bool      `json:"is_duplicate"`
}

func (sm *StateManager) CreateOrderSnapshot(order *models.Order, callbacks []models.PaymentCallback) error {
	transactions := make([]TransactionRecord, len(callbacks))
	for i, cb := range callbacks {
		transactions[i] = TransactionRecord{
			TransactionID: cb.TransactionID,
			Amount:        cb.Amount,
			Status:        cb.Status,
			ProcessedAt:   cb.ProcessedAt,
			IsDuplicate:   cb.IsDuplicate,
		}
	}

	state := OrderState{
		ID:            order.ID,
		Amount:        order.Amount,
		Status:        order.Status,
		CallbackCount: order.CallbackCount,
		Transactions:  transactions,
	}

	return sm.CreateSnapshot("order", order.ID, state)
}

func (sm *StateManager) GetOrderStateAtTime(orderID string, targetTime time.Time) (*OrderState, error) {
	snapshot, err := sm.GetSnapshotsAtTime("order", orderID, targetTime)
	if err != nil {
		return nil, err
	}

	var state OrderState
	if err := json.Unmarshal([]byte(snapshot.State), &state); err != nil {
		return nil, err
	}
	return &state, nil
}
