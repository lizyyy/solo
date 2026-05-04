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

type OrderService struct {
	db             *gorm.DB
	failureService *FailureService
}

func NewOrderService(fs *FailureService) *OrderService {
	return &OrderService{
		db:             database.GetDB(),
		failureService: fs,
	}
}

func (s *OrderService) CreateOrder(userID, productID string, quantity int, couponID string) (*models.Order, error) {
	if err := s.failureService.InjectFailure("order", "create"); err != nil {
		return nil, err
	}

	order := &models.Order{
		ID:        utils.GenerateOrderID(),
		UserID:    userID,
		ProductID: productID,
		Quantity:  quantity,
		Status:    models.OrderStatusPending,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	if err := s.db.Create(order).Error; err != nil {
		return nil, fmt.Errorf("failed to create order: %w", err)
	}

	return order, nil
}

func (s *OrderService) UpdateOrderStatus(orderID string, status models.OrderStatus) error {
	if err := s.failureService.InjectFailure("order", "update_status"); err != nil {
		return err
	}

	result := s.db.Model(&models.Order{}).
		Where("id = ?", orderID).
		Updates(map[string]interface{}{
			"status":     status,
			"updated_at": time.Now(),
		})

	if result.RowsAffected == 0 {
		return fmt.Errorf("order not found: %s", orderID)
	}

	return result.Error
}

func (s *OrderService) UpdateOrderAmounts(orderID string, totalAmount, discount, payAmount float64) error {
	if err := s.failureService.InjectFailure("order", "update_amounts"); err != nil {
		return err
	}

	result := s.db.Model(&models.Order{}).
		Where("id = ?", orderID).
		Updates(map[string]interface{}{
			"total_amount": totalAmount,
			"discount":     discount,
			"pay_amount":   payAmount,
			"updated_at":   time.Now(),
		})

	if result.RowsAffected == 0 {
		return fmt.Errorf("order not found: %s", orderID)
	}

	return result.Error
}

func (s *OrderService) UpdateOrderCoupon(orderID, couponID string) error {
	result := s.db.Model(&models.Order{}).
		Where("id = ?", orderID).
		Updates(map[string]interface{}{
			"coupon_id":  couponID,
			"updated_at": time.Now(),
		})

	if result.RowsAffected == 0 {
		return fmt.Errorf("order not found: %s", orderID)
	}

	return result.Error
}

func (s *OrderService) GetOrder(orderID string) (*models.Order, error) {
	var order models.Order
	if err := s.db.Where("id = ?", orderID).First(&order).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, fmt.Errorf("order not found: %s", orderID)
		}
		return nil, err
	}
	return &order, nil
}

func (s *OrderService) ListOrders(userID string) ([]models.Order, error) {
	var orders []models.Order
	query := s.db.Order("created_at DESC")
	if userID != "" {
		query = query.Where("user_id = ?", userID)
	}
	err := query.Find(&orders).Error
	return orders, err
}

func (s *OrderService) CancelOrder(orderID string) error {
	return s.UpdateOrderStatus(orderID, models.OrderStatusCancelled)
}

func (s *OrderService) MarkAsPaid(orderID string) error {
	return s.UpdateOrderStatus(orderID, models.OrderStatusPaid)
}
