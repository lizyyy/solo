package storage

import (
	"errors"
	"fmt"
	"time"

	"client-capability-negotiation/internal/model"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

var (
	ErrNotFound      = errors.New("record not found")
	ErrDuplicate     = errors.New("duplicate record")
	ErrInvalidStatus = errors.New("invalid status transition")
)

type Storage struct {
	db *gorm.DB
}

func NewSQLiteStorage(dbPath string) (*Storage, error) {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	if err := db.AutoMigrate(
		&model.ClientIdentity{},
		&model.CapabilityDeclaration{},
		&model.NegotiationResult{},
		&model.HitLog{},
		&model.StatusTransition{},
	); err != nil {
		return nil, fmt.Errorf("failed to migrate schema: %w", err)
	}

	return &Storage{db: db}, nil
}

func (s *Storage) GetDB() *gorm.DB {
	return s.db
}

func (s *Storage) CreateClient(client *model.ClientIdentity) error {
	result := s.db.Create(client)
	if result.Error != nil {
		return fmt.Errorf("failed to create client: %w", result.Error)
	}
	return nil
}

func (s *Storage) GetClient(clientID string) (*model.ClientIdentity, error) {
	var client model.ClientIdentity
	result := s.db.First(&client, "client_id = ?", clientID)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get client: %w", result.Error)
	}
	return &client, nil
}

func (s *Storage) ListClients() ([]model.ClientIdentity, error) {
	var clients []model.ClientIdentity
	result := s.db.Order("created_at DESC").Find(&clients)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to list clients: %w", result.Error)
	}
	return clients, nil
}

func (s *Storage) CreateDeclaration(declaration *model.CapabilityDeclaration) error {
	result := s.db.Create(declaration)
	if result.Error != nil {
		return fmt.Errorf("failed to create declaration: %w", result.Error)
	}
	return nil
}

func (s *Storage) GetDeclaration(id string) (*model.CapabilityDeclaration, error) {
	var declaration model.CapabilityDeclaration
	result := s.db.First(&declaration, "id = ?", id)
	if result.Error != nil {
		if errors.Is(result.Error, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get declaration: %w", result.Error)
	}
	return &declaration, nil
}

func (s *Storage) GetDeclarationsByClient(clientID string) ([]model.CapabilityDeclaration, error) {
	var declarations []model.CapabilityDeclaration
	result := s.db.Where("client_id = ?", clientID).Order("declared_at DESC").Find(&declarations)
	if result.Error != nil {
		return nil, fmt.Errorf("failed to get declarations: %w", result.Error)
	}
	return declarations, nil
}

func (s *Storage) CreateNegotiationResult(result *model.NegotiationResult) error {
	result := s.db.Create(result)
	if result.Error != nil {
		return fmt.Errorf("failed to create negotiation result: %w", result.Error)
	}
	return nil
}

func (s *Storage) GetNegotiationResult(id string) (*model.NegotiationResult, error) {
	var result model.NegotiationResult
	dbResult := s.db.First(&result, "id = ?", id)
	if dbResult.Error != nil {
		if errors.Is(dbResult.Error, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get negotiation result: %w", dbResult.Error)
	}
	return &result, nil
}

func (s *Storage) GetNegotiationResultByDeclaration(declarationID string) (*model.NegotiationResult, error) {
	var result model.NegotiationResult
	dbResult := s.db.First(&result, "declaration_id = ?", declarationID)
	if dbResult.Error != nil {
		if errors.Is(dbResult.Error, gorm.ErrRecordNotFound) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("failed to get negotiation result: %w", dbResult.Error)
	}
	return &result, nil
}

func (s *Storage) UpdateNegotiationResult(result *model.NegotiationResult) error {
	result.UpdatedAt = time.Now()
	dbResult := s.db.Save(result)
	if dbResult.Error != nil {
		return fmt.Errorf("failed to update negotiation result: %w", dbResult.Error)
	}
	return nil
}

func (s *Storage) ListNegotiationResults(clientID string, status *model.NegotiationStatus, limit int) ([]model.NegotiationResult, error) {
	var results []model.NegotiationResult
	query := s.db.Order("created_at DESC")
	if clientID != "" {
		query = query.Where("client_id = ?", clientID)
	}
	if status != nil {
		query = query.Where("status = ?", *status)
	}
	if limit > 0 {
		query = query.Limit(limit)
	}
	dbResult := query.Find(&results)
	if dbResult.Error != nil {
		return nil, fmt.Errorf("failed to list negotiation results: %w", dbResult.Error)
	}
	return results, nil
}

func (s *Storage) CreateStatusTransition(transition *model.StatusTransition) error {
	result := s.db.Create(transition)
	if result.Error != nil {
		return fmt.Errorf("failed to create status transition: %w", result.Error)
	}
	return nil
}

func (s *Storage) GetStatusTransitions(resultID string) ([]model.StatusTransition, error) {
	var transitions []model.StatusTransition
	dbResult := s.db.Where("result_id = ?", resultID).Order("transitioned_at ASC").Find(&transitions)
	if dbResult.Error != nil {
		return nil, fmt.Errorf("failed to get status transitions: %w", dbResult.Error)
	}
	return transitions, nil
}

func (s *Storage) CreateHitLog(hitLog *model.HitLog) error {
	result := s.db.Create(hitLog)
	if result.Error != nil {
		return fmt.Errorf("failed to create hit log: %w", result.Error)
	}
	return nil
}

func (s *Storage) GetHitLogs(resultID string, limit int) ([]model.HitLog, error) {
	var logs []model.HitLog
	query := s.db.Where("result_id = ?", resultID).Order("hit_time DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	dbResult := query.Find(&logs)
	if dbResult.Error != nil {
		return nil, fmt.Errorf("failed to get hit logs: %w", dbResult.Error)
	}
	return logs, nil
}

func (s *Storage) GetHitLogsByClient(clientID string, limit int) ([]model.HitLog, error) {
	var logs []model.HitLog
	query := s.db.Where("client_id = ?", clientID).Order("hit_time DESC")
	if limit > 0 {
		query = query.Limit(limit)
	}
	dbResult := query.Find(&logs)
	if dbResult.Error != nil {
		return nil, fmt.Errorf("failed to get hit logs: %w", dbResult.Error)
	}
	return logs, nil
}
