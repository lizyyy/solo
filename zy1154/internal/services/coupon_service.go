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

type CouponService struct {
	db             *gorm.DB
	failureService *FailureService
}

func NewCouponService(fs *FailureService) *CouponService {
	return &CouponService{
		db:             database.GetDB(),
		failureService: fs,
	}
}

func (s *CouponService) CreateCoupon(code string, discount, minAmount float64, validFrom, validTo time.Time) (*models.Coupon, error) {
	coupon := &models.Coupon{
		ID:        utils.GenerateID(),
		Code:      code,
		Discount:  discount,
		MinAmount: minAmount,
		Status:    models.CouponStatusAvailable,
		ValidFrom: validFrom,
		ValidTo:   validTo,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.db.Create(coupon).Error; err != nil {
		return nil, fmt.Errorf("failed to create coupon: %w", err)
	}

	return coupon, nil
}

func (s *CouponService) GetCoupon(couponID string) (*models.Coupon, error) {
	var coupon models.Coupon
	if err := s.db.Where("id = ?", couponID).First(&coupon).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("coupon not found: %s", couponID)
		}
		return nil, err
	}
	return &coupon, nil
}

func (s *CouponService) GetCouponByCode(code string) (*models.Coupon, error) {
	var coupon models.Coupon
	if err := s.db.Where("code = ?", code).First(&coupon).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("coupon not found with code: %s", code)
		}
		return nil, err
	}
	return &coupon, nil
}

func (s *CouponService) LockCoupon(orderID, couponID string) error {
	if err := s.failureService.InjectFailure("coupon", "lock"); err != nil {
		return err
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var coupon models.Coupon
	if err := tx.Where("id = ?", couponID).First(&coupon).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("coupon not found: %w", err)
	}

	if coupon.Status != models.CouponStatusAvailable {
		tx.Rollback()
		return fmt.Errorf("coupon not available: current status %s", coupon.Status)
	}

	now := time.Now()
	if now.Before(coupon.ValidFrom) || now.After(coupon.ValidTo) {
		tx.Rollback()
		return fmt.Errorf("coupon is not valid at this time")
	}

	coupon.Status = models.CouponStatusLocked
	coupon.OrderID = orderID
	coupon.UpdatedAt = time.Now()

	if err := tx.Save(&coupon).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to lock coupon: %w", err)
	}

	return tx.Commit().Error
}

func (s *CouponService) UseCoupon(orderID, couponID string) error {
	if err := s.failureService.InjectFailure("coupon", "use"); err != nil {
		return err
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var coupon models.Coupon
	if err := tx.Where("id = ?", couponID).First(&coupon).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("coupon not found: %w", err)
	}

	if coupon.Status != models.CouponStatusLocked {
		tx.Rollback()
		return fmt.Errorf("coupon is not locked: current status %s", coupon.Status)
	}

	coupon.Status = models.CouponStatusUsed
	coupon.UpdatedAt = time.Now()

	if err := tx.Save(&coupon).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to use coupon: %w", err)
	}

	return tx.Commit().Error
}

func (s *CouponService) ReleaseCoupon(orderID, couponID string) error {
	if err := s.failureService.InjectFailure("coupon", "release"); err != nil {
		return err
	}

	tx := s.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var coupon models.Coupon
	if err := tx.Where("id = ?", couponID).First(&coupon).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("coupon not found: %w", err)
	}

	if coupon.Status != models.CouponStatusLocked {
		tx.Rollback()
		return fmt.Errorf("coupon is not locked: current status %s", coupon.Status)
	}

	coupon.Status = models.CouponStatusReleased
	coupon.OrderID = ""
	coupon.UpdatedAt = time.Now()

	if err := tx.Save(&coupon).Error; err != nil {
		tx.Rollback()
		return fmt.Errorf("failed to release coupon: %w", err)
	}

	return tx.Commit().Error
}

func (s *CouponService) CalculateDiscount(couponID string, orderAmount float64) (float64, error) {
	coupon, err := s.GetCoupon(couponID)
	if err != nil {
		return 0, err
	}

	if orderAmount < coupon.MinAmount {
		return 0, fmt.Errorf("order amount %.2f is less than coupon minimum %.2f", orderAmount, coupon.MinAmount)
	}

	return coupon.Discount, nil
}
