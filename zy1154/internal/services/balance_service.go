package services

import (
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"

	"saga-demo/internal/database"
	"saga-demo/internal/models"
	"saga-demo/internal/utils"
)

type BalanceService struct {
	db             *gorm.DB
	failureService *FailureService
}

func NewBalanceService(fs *FailureService) *BalanceService {
	return &BalanceService{
		db:             database.GetDB(),
		failureService: fs,
	}
}

func (s *BalanceService) CreateBalance(userID string, amount float64) (*models.Balance, error) {
	balance := &models.Balance{
		ID:        utils.GenerateID(),
		UserID:    userID,
		Amount:    amount,
		Frozen:    0,
		Status:    models.BalanceStatusAvailable,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.db.Create(balance).Error; err != nil {
		return nil, fmt.Errorf("failed to create balance: %w", err)
	}

	return balance, nil
}

func (s *BalanceService) GetBalance(userID string) (*models.Balance, error) {
	var balance models.Balance
	if err := s.db.Where("user_id = ?", userID).First(&balance).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("balance not found for user: %s", userID)
		}
		return nil, err
	}
	return &balance, nil
}

func (s *BalanceService) FreezeBalance(orderID, userID string, amount float64) error {
	if err := s.failureService.InjectFailure("balance", "freeze"); err != nil {
		return err
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var balance models.Balance
	if err := tx.Where("user_id = ?", userID).First(&balance).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("balance not found: %w", err)
	}

	available := balance.Amount - balance.Frozen
	if available < amount {
		tx.Rollback()
		return fmt.Errorf("insufficient balance: available %.2f, requested %.2f", available, amount)
	}

	beforeAmount := balance.Amount
	beforeFrozen := balance.Frozen

	balance.Frozen += amount
	balance.Status = models.BalanceStatusFrozen
	balance.UpdatedAt = time.Now()

	if err := tx.Save(&balance).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to freeze balance: %w", err)
	}

	log := &models.BalanceLog{
		ID:           utils.GenerateID(),
		UserID:       userID,
		OrderID:      orderID,
		Amount:       amount,
		BeforeAmount: beforeAmount,
		AfterAmount:  balance.Amount,
		BeforeFrozen: beforeFrozen,
		AfterFrozen:  balance.Frozen,
		Operation:    "freeze",
		Status:       models.BalanceStatusFrozen,
		CreatedAt:    time.Now(),
	}

	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create balance log: %w", err)
	}

	return tx.Commit().Error
}

func (s *BalanceService) DeductBalance(orderID, userID string, amount float64) error {
	if err := s.failureService.InjectFailure("balance", "deduct"); err != nil {
		return err
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var balance models.Balance
	if err := tx.Where("user_id = ?", userID).First(&balance).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("balance not found: %w", err)
	}

	if balance.Frozen < amount {
		tx.Rollback()
		return fmt.Errorf("insufficient frozen balance: frozen %.2f, requested %.2f", balance.Frozen, amount)
	}

	beforeAmount := balance.Amount
	beforeFrozen := balance.Frozen

	balance.Amount -= amount
	balance.Frozen -= amount
	balance.Status = models.BalanceStatusDeducted
	balance.UpdatedAt = time.Now()

	if err := tx.Save(&balance).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to deduct balance: %w", err)
	}

	log := &models.BalanceLog{
		ID:           utils.GenerateID(),
		UserID:       userID,
		OrderID:      orderID,
		Amount:       amount,
		BeforeAmount: beforeAmount,
		AfterAmount:  balance.Amount,
		BeforeFrozen: beforeFrozen,
		AfterFrozen:  balance.Frozen,
		Operation:    "deduct",
		Status:       models.BalanceStatusDeducted,
		CreatedAt:    time.Now(),
	}

	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create balance log: %w", err)
	}

	return tx.Commit().Error
}

func (s *BalanceService) ReleaseBalance(orderID, userID string, amount float64) error {
	if err := s.failureService.InjectFailure("balance", "release"); err != nil {
		return err
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var balance models.Balance
	if err := tx.Where("user_id = ?", userID).First(&balance).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("balance not found: %w", err)
	}

	if balance.Frozen < amount {
		tx.Rollback()
		return fmt.Errorf("insufficient frozen balance to release: frozen %.2f, requested %.2f", balance.Frozen, amount)
	}

	beforeAmount := balance.Amount
	beforeFrozen := balance.Frozen

	balance.Frozen -= amount
	if balance.Frozen == 0 {
		balance.Status = models.BalanceStatusAvailable
	}
	balance.UpdatedAt = time.Now()

	if err := tx.Save(&balance).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to release balance: %w", err)
	}

	log := &models.BalanceLog{
		ID:           utils.GenerateID(),
		UserID:       userID,
		OrderID:      orderID,
		Amount:       amount,
		BeforeAmount: beforeAmount,
		AfterAmount:  balance.Amount,
		BeforeFrozen: beforeFrozen,
		AfterFrozen:  balance.Frozen,
		Operation:    "release",
		Status:       models.BalanceStatusReleased,
		CreatedAt:    time.Now(),
	}

	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create balance log: %w", err)
	}

	return tx.Commit().Error
}

func (s *BalanceService) GetBalanceLogs(orderID string) ([]models.BalanceLog, error) {
	var logs []models.BalanceLog
	err := s.db.Where("order_id = ?", orderID).Order("created_at ASC").Find(&logs).Error
	return logs, err
}

func (s *BalanceService) GetBalanceLogsByUser(userID string) ([]models.BalanceLog, error) {
	var logs []models.BalanceLog
	err := s.db.Where("user_id = ?", userID).Order("created_at DESC").Find(&logs).Error
	return logs, err
}
