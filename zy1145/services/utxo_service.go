package services

import (
	"btc-recharge-service/config"
	"btc-recharge-service/models"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type UTXOService struct {
	db      *gorm.DB
	config  *config.Config
	riskSvc *RiskControlService
}

func NewUTXOService(db *gorm.DB, cfg *config.Config, riskSvc *RiskControlService) *UTXOService {
	return &UTXOService{
		db:      db,
		config:  cfg,
		riskSvc: riskSvc,
	}
}

type AddressBalance struct {
	Address           string `json:"address"`
	TotalBalance      int64  `json:"total_balance"`
	ConfirmedBalance  int64  `json:"confirmed_balance"`
	PendingBalance    int64  `json:"pending_balance"`
	SuspiciousBalance int64  `json:"suspicious_balance"`
	UTXOCount         int    `json:"utxo_count"`
}

type UTXODetail struct {
	ID            uint   `json:"id"`
	TxID          string `json:"tx_id"`
	OutputIndex   int    `json:"output_index"`
	Address       string `json:"address"`
	Amount        int64  `json:"amount"`
	Confirmations int    `json:"confirmations"`
	BlockHeight   int64  `json:"block_height"`
	Status        string `json:"status"`
	IsDust        bool   `json:"is_dust"`
	CreatedAt     string `json:"created_at"`
}

func (s *UTXOService) GetAddressBalance(address string) (*AddressBalance, error) {
	var utxos []models.UTXO
	if err := s.db.Where("address = ? AND status != ?", address, "spent").Find(&utxos).Error; err != nil {
		return nil, fmt.Errorf("查询地址 UTXO 失败: %w", err)
	}

	balance := &AddressBalance{
		Address:           address,
		TotalBalance:      0,
		ConfirmedBalance:  0,
		PendingBalance:    0,
		SuspiciousBalance: 0,
		UTXOCount:         len(utxos),
	}

	for _, u := range utxos {
		balance.TotalBalance += u.Amount

		if u.Status == "suspicious" {
			balance.SuspiciousBalance += u.Amount
		} else if u.Confirmations >= s.config.ConfirmedBlocks {
			balance.ConfirmedBalance += u.Amount
		} else {
			balance.PendingBalance += u.Amount
		}
	}

	return balance, nil
}

func (s *UTXOService) GetUserBalances(userID string) ([]AddressBalance, error) {
	var addresses []models.RechargeAddress
	if err := s.db.Where("user_id = ?", userID).Find(&addresses).Error; err != nil {
		return nil, fmt.Errorf("查询用户地址失败: %w", err)
	}

	var balances []AddressBalance
	for _, addr := range addresses {
		balance, err := s.GetAddressBalance(addr.Address)
		if err != nil {
			continue
		}
		balances = append(balances, *balance)
	}

	return balances, nil
}

func (s *UTXOService) GetUTXOsByAddress(address string) ([]UTXODetail, error) {
	var utxos []models.UTXO
	if err := s.db.Where("address = ?", address).Order("created_at DESC").Find(&utxos).Error; err != nil {
		return nil, fmt.Errorf("查询地址 UTXO 失败: %w", err)
	}

	var details []UTXODetail
	for _, u := range utxos {
		details = append(details, UTXODetail{
			ID:            u.ID,
			TxID:          u.TxID,
			OutputIndex:   u.OutputIndex,
			Address:       u.Address,
			Amount:        u.Amount,
			Confirmations: u.Confirmations,
			BlockHeight:   u.BlockHeight,
			Status:        u.Status,
			IsDust:        u.IsDust,
			CreatedAt:     u.CreatedAt.Format(time.RFC3339),
		})
	}

	return details, nil
}

func (s *UTXOService) GetSpendableUTXOs(address string) ([]UTXODetail, error) {
	var utxos []models.UTXO
	if err := s.db.Where("address = ? AND status = ? AND is_dust = ? AND confirmations >= ?",
		address, "unspent", false, s.config.ConfirmedBlocks).
		Order("amount DESC").Find(&utxos).Error; err != nil {
		return nil, fmt.Errorf("查询可花费 UTXO 失败: %w", err)
	}

	var details []UTXODetail
	for _, u := range utxos {
		details = append(details, UTXODetail{
			ID:            u.ID,
			TxID:          u.TxID,
			OutputIndex:   u.OutputIndex,
			Address:       u.Address,
			Amount:        u.Amount,
			Confirmations: u.Confirmations,
			BlockHeight:   u.BlockHeight,
			Status:        u.Status,
			IsDust:        u.IsDust,
			CreatedAt:     u.CreatedAt.Format(time.RFC3339),
		})
	}

	return details, nil
}

func (s *UTXOService) GetAllSpendableUTXOs() ([]UTXODetail, error) {
	var utxos []models.UTXO
	if err := s.db.Where("status = ? AND is_dust = ? AND confirmations >= ?",
		"unspent", false, s.config.ConfirmedBlocks).
		Order("amount DESC").Find(&utxos).Error; err != nil {
		return nil, fmt.Errorf("查询所有可花费 UTXO 失败: %w", err)
	}

	var details []UTXODetail
	for _, u := range utxos {
		details = append(details, UTXODetail{
			ID:            u.ID,
			TxID:          u.TxID,
			OutputIndex:   u.OutputIndex,
			Address:       u.Address,
			Amount:        u.Amount,
			Confirmations: u.Confirmations,
			BlockHeight:   u.BlockHeight,
			Status:        u.Status,
			IsDust:        u.IsDust,
			CreatedAt:     u.CreatedAt.Format(time.RFC3339),
		})
	}

	return details, nil
}

func (s *UTXOService) MarkUTXOAsSpent(txID string, outputIndex int) error {
	var utxo models.UTXO
	if err := s.db.Where("tx_id = ? AND output_index = ?", txID, outputIndex).First(&utxo).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil
		}
		return fmt.Errorf("查询 UTXO 失败: %w", err)
	}

	utxo.Status = "spent"
	if err := s.db.Save(&utxo).Error; err != nil {
		return fmt.Errorf("标记 UTXO 为已花费失败: %w", err)
	}

	return nil
}

func (s *UTXOService) GetSuspiciousUTXOs() ([]UTXODetail, error) {
	var utxos []models.UTXO
	if err := s.db.Where("status = ?", "suspicious").Find(&utxos).Error; err != nil {
		return nil, fmt.Errorf("查询可疑 UTXO 失败: %w", err)
	}

	var details []UTXODetail
	for _, u := range utxos {
		details = append(details, UTXODetail{
			ID:            u.ID,
			TxID:          u.TxID,
			OutputIndex:   u.OutputIndex,
			Address:       u.Address,
			Amount:        u.Amount,
			Confirmations: u.Confirmations,
			BlockHeight:   u.BlockHeight,
			Status:        u.Status,
			IsDust:        u.IsDust,
			CreatedAt:     u.CreatedAt.Format(time.RFC3339),
		})
	}

	return details, nil
}

func (s *UTXOService) CalculateTotalConfirmedBalance() int64 {
	var total int64
	s.db.Model(&models.UTXO{}).
		Where("status = ? AND is_dust = ? AND confirmations >= ?", "unspent", false, s.config.ConfirmedBlocks).
		Select("COALESCE(SUM(amount), 0)").Scan(&total)
	return total
}

func (s *UTXOService) CalculateTotalPendingBalance() int64 {
	var total int64
	s.db.Model(&models.UTXO{}).
		Where("status = ? AND is_dust = ? AND confirmations < ?", "unspent", false, s.config.ConfirmedBlocks).
		Select("COALESCE(SUM(amount), 0)").Scan(&total)
	return total
}

func (s *UTXOService) CalculateTotalSuspiciousBalance() int64 {
	var total int64
	s.db.Model(&models.UTXO{}).
		Where("status = ?", "suspicious").
		Select("COALESCE(SUM(amount), 0)").Scan(&total)
	return total
}

type CollectionUTXO struct {
	ID          uint   `json:"id"`
	TxID        string `json:"tx_id"`
	OutputIndex int    `json:"output_index"`
	Amount      int64  `json:"amount"`
}

type SelectedUTXOs struct {
	UTXOs       []CollectionUTXO `json:"utxos"`
	TotalAmount int64            `json:"total_amount"`
	InputCount  int              `json:"input_count"`
}

func (s *UTXOService) SelectUTXOsForCollection(targetAmount int64) (*SelectedUTXOs, error) {
	var utxos []models.UTXO
	if err := s.db.Where("status = ? AND is_dust = ? AND confirmations >= ?",
		"unspent", false, s.config.ConfirmedBlocks).
		Order("amount DESC").Find(&utxos).Error; err != nil {
		return nil, fmt.Errorf("查询可花费 UTXO 失败: %w", err)
	}

	var selected []CollectionUTXO
	var totalAmount int64 = 0

	for _, u := range utxos {
		if totalAmount >= targetAmount {
			break
		}
		selected = append(selected, CollectionUTXO{
			ID:          u.ID,
			TxID:        u.TxID,
			OutputIndex: u.OutputIndex,
			Amount:      u.Amount,
		})
		totalAmount += u.Amount
	}

	if totalAmount == 0 {
		return nil, fmt.Errorf("没有可用的 UTXO")
	}

	return &SelectedUTXOs{
		UTXOs:       selected,
		TotalAmount: totalAmount,
		InputCount:  len(selected),
	}, nil
}

func (s *UTXOService) SelectAllEligibleUTXOs() (*SelectedUTXOs, error) {
	var utxos []models.UTXO
	if err := s.db.Where("status = ? AND is_dust = ? AND confirmations >= ?",
		"unspent", false, s.config.ConfirmedBlocks).
		Order("amount DESC").Find(&utxos).Error; err != nil {
		return nil, fmt.Errorf("查询可花费 UTXO 失败: %w", err)
	}

	var selected []CollectionUTXO
	var totalAmount int64 = 0

	for _, u := range utxos {
		selected = append(selected, CollectionUTXO{
			ID:          u.ID,
			TxID:        u.TxID,
			OutputIndex: u.OutputIndex,
			Amount:      u.Amount,
		})
		totalAmount += u.Amount
	}

	return &SelectedUTXOs{
		UTXOs:       selected,
		TotalAmount: totalAmount,
		InputCount:  len(selected),
	}, nil
}
