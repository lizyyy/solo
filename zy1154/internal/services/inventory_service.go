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

type InventoryService struct {
	db             *gorm.DB
	failureService *FailureService
}

func NewInventoryService(fs *FailureService) *InventoryService {
	return &InventoryService{
		db:             database.GetDB(),
		failureService: fs,
	}
}

func (s *InventoryService) CreateInventory(productID string, quantity int) (*models.Inventory, error) {
	inventory := &models.Inventory{
		ID:        utils.GenerateID(),
		ProductID: productID,
		Quantity:  quantity,
		Locked:    0,
		Status:    models.InventoryStatusAvailable,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.db.Create(inventory).Error; err != nil {
		return nil, fmt.Errorf("failed to create inventory: %w", err)
	}

	return inventory, nil
}

func (s *InventoryService) GetInventory(productID string) (*models.Inventory, error) {
	var inventory models.Inventory
	if err := s.db.Where("product_id = ?", productID).First(&inventory).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("inventory not found for product: %s", productID)
		}
		return nil, err
	}
	return &inventory, nil
}

func (s *InventoryService) LockInventory(orderID, productID string, quantity int) error {
	if err := s.failureService.InjectFailure("inventory", "lock"); err != nil {
		return err
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var inventory models.Inventory
	if err := tx.Where("product_id = ?", productID).First(&inventory).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("inventory not found: %w", err)
	}

	available := inventory.Quantity - inventory.Locked
	if available < quantity {
		tx.Rollback()
		return fmt.Errorf("insufficient inventory: available %d, requested %d", available, quantity)
	}

	beforeQty := inventory.Quantity
	beforeLocked := inventory.Locked

	inventory.Locked += quantity
	inventory.Status = models.InventoryStatusLocked
	inventory.UpdatedAt = time.Now()

	if err := tx.Save(&inventory).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to lock inventory: %w", err)
	}

	log := &models.InventoryLog{
		ID:           utils.GenerateID(),
		ProductID:    productID,
		OrderID:      orderID,
		Quantity:     quantity,
		BeforeQty:    beforeQty,
		AfterQty:     inventory.Quantity,
		BeforeLocked: beforeLocked,
		AfterLocked:  inventory.Locked,
		Operation:    "lock",
		Status:       models.InventoryStatusLocked,
		CreatedAt:    time.Now(),
	}

	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create inventory log: %w", err)
	}

	return tx.Commit().Error
}

func (s *InventoryService) DeductInventory(orderID, productID string, quantity int) error {
	if err := s.failureService.InjectFailure("inventory", "deduct"); err != nil {
		return err
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var inventory models.Inventory
	if err := tx.Where("product_id = ?", productID).First(&inventory).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("inventory not found: %w", err)
	}

	if inventory.Locked < quantity {
		tx.Rollback()
		return fmt.Errorf("insufficient locked inventory: locked %d, requested %d", inventory.Locked, quantity)
	}

	beforeQty := inventory.Quantity
	beforeLocked := inventory.Locked

	inventory.Quantity -= quantity
	inventory.Locked -= quantity
	inventory.Status = models.InventoryStatusDeducted
	inventory.UpdatedAt = time.Now()

	if err := tx.Save(&inventory).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to deduct inventory: %w", err)
	}

	log := &models.InventoryLog{
		ID:           utils.GenerateID(),
		ProductID:    productID,
		OrderID:      orderID,
		Quantity:     quantity,
		BeforeQty:    beforeQty,
		AfterQty:     inventory.Quantity,
		BeforeLocked: beforeLocked,
		AfterLocked:  inventory.Locked,
		Operation:    "deduct",
		Status:       models.InventoryStatusDeducted,
		CreatedAt:    time.Now(),
	}

	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create inventory log: %w", err)
	}

	return tx.Commit().Error
}

func (s *InventoryService) ReleaseInventory(orderID, productID string, quantity int) error {
	if err := s.failureService.InjectFailure("inventory", "release"); err != nil {
		return err
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var inventory models.Inventory
	if err := tx.Where("product_id = ?", productID).First(&inventory).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("inventory not found: %w", err)
	}

	if inventory.Locked < quantity {
		tx.Rollback()
		return fmt.Errorf("insufficient locked inventory to release: locked %d, requested %d", inventory.Locked, quantity)
	}

	beforeQty := inventory.Quantity
	beforeLocked := inventory.Locked

	inventory.Locked -= quantity
	if inventory.Locked == 0 {
		inventory.Status = models.InventoryStatusAvailable
	}
	inventory.UpdatedAt = time.Now()

	if err := tx.Save(&inventory).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to release inventory: %w", err)
	}

	log := &models.InventoryLog{
		ID:           utils.GenerateID(),
		ProductID:    productID,
		OrderID:      orderID,
		Quantity:     quantity,
		BeforeQty:    beforeQty,
		AfterQty:     inventory.Quantity,
		BeforeLocked: beforeLocked,
		AfterLocked:  inventory.Locked,
		Operation:    "release",
		Status:       models.InventoryStatusReleased,
		CreatedAt:    time.Now(),
	}

	if err := tx.Create(log).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to create inventory log: %w", err)
	}

	return tx.Commit().Error
}

func (s *InventoryService) GetInventoryLogs(orderID string) ([]models.InventoryLog, error) {
	var logs []models.InventoryLog
	err := s.db.Where("order_id = ?", orderID).Order("created_at ASC").Find(&logs).Error
	return logs, err
}
