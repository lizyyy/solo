package services

import (
	"log"
	"time"

	"gorm.io/gorm"

	"saga-demo/internal/database"
	"saga-demo/internal/models"
	"saga-demo/internal/utils"
)

type SeedService struct {
	db *gorm.DB
}

func NewSeedService() *SeedService {
	return &SeedService{
		db: database.GetDB(),
	}
}

type SeedStatus struct {
	Initialized bool     `json:"initialized"`
	Users       []string `json:"users"`
	Products    []string `json:"products"`
	Coupons     []string `json:"coupons"`
}

func (s *SeedService) Initialize() error {
	var count int64
	s.db.Model(&models.Inventory{}).Count(&count)
	if count > 0 {
		log.Println("Seed data already exists, skipping initialization")
		return nil
	}

	return s.createSeedData()
}

func (s *SeedService) Reset() error {
	s.db.Exec("DELETE FROM inventory_logs")
	s.db.Exec("DELETE FROM balance_logs")
	s.db.Exec("DELETE FROM orders")
	s.db.Exec("DELETE FROM saga_steps")
	s.db.Exec("DELETE FROM saga_instances")
	s.db.Exec("DELETE FROM outbox_events")
	s.db.Exec("DELETE FROM compensation_tasks")
	s.db.Exec("DELETE FROM manual_handlings")
	s.db.Exec("DELETE FROM failure_injections")

	return s.createSeedData()
}

func (s *SeedService) createSeedData() error {
	inventories := []models.Inventory{
		{
			ID:        utils.GenerateID(),
			ProductID: "PROD-001",
			Quantity:  100,
			Locked:    0,
			Status:    models.InventoryStatusAvailable,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        utils.GenerateID(),
			ProductID: "PROD-002",
			Quantity:  50,
			Locked:    0,
			Status:    models.InventoryStatusAvailable,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        utils.GenerateID(),
			ProductID: "PROD-003",
			Quantity:  200,
			Locked:    0,
			Status:    models.InventoryStatusAvailable,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}

	for _, inv := range inventories {
		if err := s.db.Create(&inv).Error; err != nil {
			return err
		}
	}
	log.Printf("Created %d inventory records", len(inventories))

	balances := []models.Balance{
		{
			ID:        utils.GenerateID(),
			UserID:    "USER-001",
			Amount:    5000.0,
			Frozen:    0.0,
			Status:    models.BalanceStatusAvailable,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        utils.GenerateID(),
			UserID:    "USER-002",
			Amount:    10000.0,
			Frozen:    0.0,
			Status:    models.BalanceStatusAvailable,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        utils.GenerateID(),
			UserID:    "USER-003",
			Amount:    500.0,
			Frozen:    0.0,
			Status:    models.BalanceStatusAvailable,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}

	for _, bal := range balances {
		if err := s.db.Create(&bal).Error; err != nil {
			return err
		}
	}
	log.Printf("Created %d balance records", len(balances))

	now := time.Now()
	coupons := []models.Coupon{
		{
			ID:        utils.GenerateID(),
			Code:      "SAVE10",
			Discount:  10.0,
			MinAmount: 100.0,
			Status:    models.CouponStatusAvailable,
			ValidFrom: now.Add(-24 * time.Hour),
			ValidTo:   now.Add(30 * 24 * time.Hour),
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        utils.GenerateID(),
			Code:      "SAVE50",
			Discount:  50.0,
			MinAmount: 500.0,
			Status:    models.CouponStatusAvailable,
			ValidFrom: now.Add(-24 * time.Hour),
			ValidTo:   now.Add(7 * 24 * time.Hour),
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		{
			ID:        utils.GenerateID(),
			Code:      "SAVE20",
			Discount:  20.0,
			MinAmount: 200.0,
			Status:    models.CouponStatusAvailable,
			ValidFrom: now.Add(-24 * time.Hour),
			ValidTo:   now.Add(14 * 24 * time.Hour),
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
	}

	for _, cp := range coupons {
		if err := s.db.Create(&cp).Error; err != nil {
			return err
		}
	}
	log.Printf("Created %d coupon records", len(coupons))

	log.Println("Seed data creation completed")
	return nil
}

func (s *SeedService) GetStatus() SeedStatus {
	status := SeedStatus{
		Initialized: false,
		Users:       make([]string, 0),
		Products:    make([]string, 0),
		Coupons:     make([]string, 0),
	}

	var invCount int64
	s.db.Model(&models.Inventory{}).Count(&invCount)
	if invCount == 0 {
		return status
	}

	status.Initialized = true

	var inventories []models.Inventory
	s.db.Find(&inventories)
	for _, inv := range inventories {
		status.Products = append(status.Products, inv.ProductID)
	}

	var balances []models.Balance
	s.db.Find(&balances)
	for _, bal := range balances {
		status.Users = append(status.Users, bal.UserID)
	}

	var coupons []models.Coupon
	s.db.Where("status = ?", models.CouponStatusAvailable).Find(&coupons)
	for _, cp := range coupons {
		status.Coupons = append(status.Coupons, cp.Code)
	}

	return status
}
