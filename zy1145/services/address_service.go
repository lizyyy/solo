package services

import (
	"btc-recharge-service/config"
	"btc-recharge-service/models"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type AddressService struct {
	db     *gorm.DB
	config *config.Config
}

func NewAddressService(db *gorm.DB, cfg *config.Config) *AddressService {
	return &AddressService{
		db:     db,
		config: cfg,
	}
}

type CreateAddressRequest struct {
	UserID      string `json:"user_id" binding:"required"`
	RequestID   string `json:"request_id"`
}

type CreateAddressResponse struct {
	Code    string                 `json:"code"`
	Message string                 `json:"message"`
	Data    *models.RechargeAddress `json:"data,omitempty"`
}

func (s *AddressService) CreateAddress(req *CreateAddressRequest) (*CreateAddressResponse, error) {
	if req.RequestID != "" {
		var existingAddr models.RechargeAddress
		err := s.db.Where("user_id = ? AND created_at > datetime('now', '-1 hour')", req.UserID).
			Order("created_at DESC").
			First(&existingAddr).Error
		if err == nil {
			return &CreateAddressResponse{
				Code:    models.IdempotentConflict.Code,
				Message: models.IdempotentConflict.Message,
				Data:    &existingAddr,
			}, nil
		}
	}

	var maxIndex int
	err := s.db.Model(&models.RechargeAddress{}).
		Where("user_id = ?", req.UserID).
		Select("COALESCE(MAX(`index`), -1)").
		Scan(&maxIndex).Error
	if err != nil {
		return nil, fmt.Errorf("获取地址索引失败: %w", err)
	}

	newIndex := maxIndex + 1
	address := s.generateMockAddress(req.UserID, newIndex)

	newAddr := models.RechargeAddress{
		UserID:  req.UserID,
		Address: address,
		Index:   newIndex,
		Status:  "active",
	}

	if err := s.db.Create(&newAddr).Error; err != nil {
		return nil, fmt.Errorf("创建充值地址失败: %w", err)
	}

	return &CreateAddressResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    &newAddr,
	}, nil
}

func (s *AddressService) GetAddressByID(addressID uint) (*models.RechargeAddress, error) {
	var addr models.RechargeAddress
	if err := s.db.First(&addr, addressID).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("查询地址失败: %w", err)
	}
	return &addr, nil
}

func (s *AddressService) GetAddressByAddressString(address string) (*models.RechargeAddress, error) {
	var addr models.RechargeAddress
	if err := s.db.Where("address = ?", address).First(&addr).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("查询地址失败: %w", err)
	}
	return &addr, nil
}

func (s *AddressService) GetAddressesByUserID(userID string) ([]models.RechargeAddress, error) {
	var addrs []models.RechargeAddress
	if err := s.db.Where("user_id = ?", userID).Find(&addrs).Error; err != nil {
		return nil, fmt.Errorf("查询用户地址列表失败: %w", err)
	}
	return addrs, nil
}

func (s *AddressService) GetAllAddresses() ([]models.RechargeAddress, error) {
	var addrs []models.RechargeAddress
	if err := s.db.Find(&addrs).Error; err != nil {
		return nil, fmt.Errorf("查询所有地址失败: %w", err)
	}
	return addrs, nil
}

func (s *AddressService) generateMockAddress(userID string, index int) string {
	uuidPart := uuid.New().String()[:8]
	return fmt.Sprintf("bc1q%s%s%d", userID, uuidPart, index)
}
