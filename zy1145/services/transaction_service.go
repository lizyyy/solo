package services

import (
	"btc-recharge-service/config"
	"btc-recharge-service/models"
	"errors"
	"fmt"
	"time"

	"gorm.io/gorm"
)

type TransactionService struct {
	db         *gorm.DB
	config     *config.Config
	addressSvc *AddressService
	riskSvc    *RiskControlService
}

func NewTransactionService(db *gorm.DB, cfg *config.Config, addrSvc *AddressService, riskSvc *RiskControlService) *TransactionService {
	return &TransactionService{
		db:         db,
		config:     cfg,
		addressSvc: addrSvc,
		riskSvc:    riskSvc,
	}
}

type ImportBlockRequest struct {
	Height       int64             `json:"height" binding:"required"`
	Hash         string            `json:"hash" binding:"required"`
	PrevHash     string            `json:"prev_hash" binding:"required"`
	Timestamp    time.Time         `json:"timestamp"`
	TxIDs        []string          `json:"tx_ids"`
	Transactions []MockTransaction `json:"transactions"`
}

type MockTransaction struct {
	TxID    string                  `json:"tx_id" binding:"required"`
	Inputs  []MockTransactionInput  `json:"inputs"`
	Outputs []MockTransactionOutput `json:"outputs"`
	IsRBF   bool                    `json:"is_rbf"`
	Fee     int64                   `json:"fee"`
	RawTx   string                  `json:"raw_tx"`
}

type MockTransactionInput struct {
	TxID        string `json:"tx_id"`
	OutputIndex int    `json:"output_index"`
}

type MockTransactionOutput struct {
	Address string `json:"address" binding:"required"`
	Amount  int64  `json:"amount" binding:"required"`
	Index   int    `json:"index" binding:"required"`
}

type ImportMempoolRequest struct {
	TxID    string                  `json:"tx_id" binding:"required"`
	Inputs  []MockTransactionInput  `json:"inputs"`
	Outputs []MockTransactionOutput `json:"outputs"`
	IsRBF   bool                    `json:"is_rbf"`
	Fee     int64                   `json:"fee"`
	RawTx   string                  `json:"raw_tx"`
}

type ImportTransactionResponse struct {
	Code    string             `json:"code"`
	Message string             `json:"message"`
	Data    *TransactionResult `json:"data,omitempty"`
}

type TransactionResult struct {
	TxID             string `json:"tx_id"`
	Status           string `json:"status"`
	Confirmations    int    `json:"confirmations"`
	IsConfirmed      bool   `json:"is_confirmed"`
	IsSuspicious     bool   `json:"is_suspicious"`
	SuspiciousReason string `json:"suspicious_reason,omitempty"`
}

func (s *TransactionService) ImportBlock(req *ImportBlockRequest) (*ImportTransactionResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("开始事务失败: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var existingBlock models.Block
	err := tx.Where("height = ?", req.Height).First(&existingBlock).Error
	if err == nil {
		if existingBlock.Hash != req.Hash {
			if err := s.handleChainReorg(tx, req); err != nil {
				tx.Rollback()
				return nil, err
			}
		} else {
			tx.Commit()
			return &ImportTransactionResponse{
				Code:    models.Success.Code,
				Message: "区块已存在",
				Data:    nil,
			}, nil
		}
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		return nil, fmt.Errorf("查询区块失败: %w", err)
	}

	newBlock := models.Block{
		Height:    req.Height,
		Hash:      req.Hash,
		PrevHash:  req.PrevHash,
		Timestamp: req.Timestamp,
		TxCount:   len(req.Transactions),
		IsReorged: false,
	}

	if err := tx.Create(&newBlock).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建区块记录失败: %w", err)
	}

	for _, mockTx := range req.Transactions {
		if err := s.processBlockTransaction(tx, &mockTx, req.Height, req.Hash); err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("处理交易 %s 失败: %w", mockTx.TxID, err)
		}
	}

	if err := s.updateConfirmations(tx, req.Height); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新确认数失败: %w", err)
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &ImportTransactionResponse{
		Code:    models.Success.Code,
		Message: "区块导入成功",
		Data:    nil,
	}, nil
}

func (s *TransactionService) ImportMempool(req *ImportMempoolRequest) (*ImportTransactionResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("开始事务失败: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var existingTx models.Transaction
	err := tx.Where("tx_id = ?", req.TxID).First(&existingTx).Error
	if err == nil {
		tx.Rollback()
		return &ImportTransactionResponse{
			Code:    models.IdempotentConflict.Code,
			Message: models.IdempotentConflict.Message,
			Data: &TransactionResult{
				TxID:          existingTx.TxID,
				Status:        existingTx.Status,
				Confirmations: existingTx.Confirmations,
				IsConfirmed:   existingTx.IsConfirmed,
				IsSuspicious:  existingTx.HasDoubleSpend || existingTx.IsRBF,
			},
		}, nil
	} else if !errors.Is(err, gorm.ErrRecordNotFound) {
		tx.Rollback()
		return nil, fmt.Errorf("查询交易失败: %w", err)
	}

	doubleSpendRisk, err := s.checkDoubleSpend(tx, req)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("检查双花风险失败: %w", err)
	}

	newTx := models.Transaction{
		TxID:           req.TxID,
		BlockHeight:    0,
		BlockHash:      "",
		Confirmations:  0,
		IsConfirmed:    false,
		IsRBF:          req.IsRBF,
		HasDoubleSpend: doubleSpendRisk,
		Status:         "pending",
		Fee:            req.Fee,
		RawTx:          req.RawTx,
	}

	if req.IsRBF || doubleSpendRisk {
		newTx.Status = "suspicious"
	}

	if err := tx.Create(&newTx).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建交易记录失败: %w", err)
	}

	for _, output := range req.Outputs {
		addr, err := s.addressSvc.GetAddressByAddressString(output.Address)
		if err != nil {
			continue
		}
		if addr == nil {
			continue
		}

		isDust := output.Amount < s.config.DustThreshold
		if isDust {
			continue
		}

		utxo := models.UTXO{
			TxID:          req.TxID,
			OutputIndex:   output.Index,
			Address:       output.Address,
			Amount:        output.Amount,
			Confirmations: 0,
			BlockHeight:   0,
			Status:        "unspent",
			IsDust:        isDust,
		}

		if req.IsRBF || doubleSpendRisk {
			utxo.Status = "suspicious"
		}

		if err := tx.Create(&utxo).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("创建 UTXO 失败: %w", err)
		}

		if err := s.logAudit(tx, "CREATE", "UTXO", fmt.Sprintf("%d", utxo.ID), "system",
			fmt.Sprintf("从 mempool 交易 %s 创建 UTXO，金额: %d", req.TxID, output.Amount), ""); err != nil {
			tx.Rollback()
			return nil, err
		}
	}

	suspiciousReason := ""
	if req.IsRBF {
		suspiciousReason = "RBF 风险"
	} else if doubleSpendRisk {
		suspiciousReason = "双花风险"
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &ImportTransactionResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data: &TransactionResult{
			TxID:             req.TxID,
			Status:           newTx.Status,
			Confirmations:    0,
			IsConfirmed:      false,
			IsSuspicious:     req.IsRBF || doubleSpendRisk,
			SuspiciousReason: suspiciousReason,
		},
	}, nil
}

func (s *TransactionService) processBlockTransaction(tx *gorm.DB, mockTx *MockTransaction, blockHeight int64, blockHash string) error {
	var existingTx models.Transaction
	err := tx.Where("tx_id = ?", mockTx.TxID).First(&existingTx).Error

	if err == nil {
		existingTx.BlockHeight = blockHeight
		existingTx.BlockHash = blockHash
		existingTx.Confirmations = 1
		existingTx.Status = "pending"

		if err := tx.Save(&existingTx).Error; err != nil {
			return fmt.Errorf("更新交易确认数失败: %w", err)
		}

		if err := s.updateUTXOConfirmations(tx, mockTx.TxID, blockHeight); err != nil {
			return err
		}
	} else if errors.Is(err, gorm.ErrRecordNotFound) {
		doubleSpendRisk, err := s.checkDoubleSpendFromInputs(tx, mockTx.Inputs)
		if err != nil {
			return err
		}

		newTx := models.Transaction{
			TxID:           mockTx.TxID,
			BlockHeight:    blockHeight,
			BlockHash:      blockHash,
			Confirmations:  1,
			IsConfirmed:    false,
			IsRBF:          mockTx.IsRBF,
			HasDoubleSpend: doubleSpendRisk,
			Status:         "pending",
			Fee:            mockTx.Fee,
			RawTx:          mockTx.RawTx,
		}

		if mockTx.IsRBF || doubleSpendRisk {
			newTx.Status = "suspicious"
		}

		if err := tx.Create(&newTx).Error; err != nil {
			return fmt.Errorf("创建交易记录失败: %w", err)
		}

		for _, output := range mockTx.Outputs {
			addr, err := s.addressSvc.GetAddressByAddressString(output.Address)
			if err != nil {
				continue
			}
			if addr == nil {
				continue
			}

			isDust := output.Amount < s.config.DustThreshold
			if isDust {
				continue
			}

			utxo := models.UTXO{
				TxID:          mockTx.TxID,
				OutputIndex:   output.Index,
				Address:       output.Address,
				Amount:        output.Amount,
				Confirmations: 1,
				BlockHeight:   blockHeight,
				Status:        "unspent",
				IsDust:        isDust,
			}

			if mockTx.IsRBF || doubleSpendRisk {
				utxo.Status = "suspicious"
			}

			if err := tx.Create(&utxo).Error; err != nil {
				return fmt.Errorf("创建 UTXO 失败: %w", err)
			}
		}
	} else {
		return fmt.Errorf("查询交易失败: %w", err)
	}

	if err := s.markInputsAsSpent(tx, mockTx.Inputs); err != nil {
		return err
	}

	return nil
}

func (s *TransactionService) updateConfirmations(tx *gorm.DB, currentHeight int64) error {
	var transactions []models.Transaction
	if err := tx.Where("block_height > 0 AND is_confirmed = ?", false).Find(&transactions).Error; err != nil {
		return fmt.Errorf("查询待确认交易失败: %w", err)
	}

	for _, t := range transactions {
		newConfirmations := int(currentHeight - t.BlockHeight + 1)
		if newConfirmations > t.Confirmations {
			t.Confirmations = newConfirmations

			if newConfirmations >= s.config.ConfirmedBlocks {
				t.IsConfirmed = true
				t.Status = "confirmed"
			}

			if err := tx.Save(&t).Error; err != nil {
				return fmt.Errorf("更新交易确认数失败: %w", err)
			}

			if t.Status == "confirmed" {
				if err := s.confirmUTXOs(tx, t.TxID); err != nil {
					return err
				}
			} else {
				if err := s.updateUTXOConfirmations(tx, t.TxID, t.BlockHeight); err != nil {
					return err
				}
			}
		}
	}

	return nil
}

func (s *TransactionService) updateUTXOConfirmations(tx *gorm.DB, txID string, blockHeight int64) error {
	var utxos []models.UTXO
	if err := tx.Where("tx_id = ? AND status != ?", txID, "spent").Find(&utxos).Error; err != nil {
		return fmt.Errorf("查询 UTXO 失败: %w", err)
	}

	for _, u := range utxos {
		u.Confirmations = 1
		u.BlockHeight = blockHeight
		if err := tx.Save(&u).Error; err != nil {
			return fmt.Errorf("更新 UTXO 确认数失败: %w", err)
		}
	}

	return nil
}

func (s *TransactionService) confirmUTXOs(tx *gorm.DB, txID string) error {
	var utxos []models.UTXO
	if err := tx.Where("tx_id = ? AND status = ?", txID, "unspent").Find(&utxos).Error; err != nil {
		return fmt.Errorf("查询 UTXO 失败: %w", err)
	}

	for _, u := range utxos {
		u.Confirmations = s.config.ConfirmedBlocks
		if err := tx.Save(&u).Error; err != nil {
			return fmt.Errorf("确认 UTXO 失败: %w", err)
		}

		if err := s.logAudit(tx, "CONFIRM", "UTXO", fmt.Sprintf("%d", u.ID), "system",
			fmt.Sprintf("UTXO 已确认，金额: %d", u.Amount), ""); err != nil {
			return err
		}
	}

	return nil
}

func (s *TransactionService) markInputsAsSpent(tx *gorm.DB, inputs []MockTransactionInput) error {
	for _, input := range inputs {
		var utxo models.UTXO
		err := tx.Where("tx_id = ? AND output_index = ?", input.TxID, input.OutputIndex).First(&utxo).Error
		if err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			return fmt.Errorf("查询输入 UTXO 失败: %w", err)
		}

		utxo.Status = "spent"
		if err := tx.Save(&utxo).Error; err != nil {
			return fmt.Errorf("标记 UTXO 为已花费失败: %w", err)
		}
	}

	return nil
}

func (s *TransactionService) checkDoubleSpend(tx *gorm.DB, req *ImportMempoolRequest) (bool, error) {
	return s.checkDoubleSpendFromInputs(tx, req.Inputs)
}

func (s *TransactionService) checkDoubleSpendFromInputs(tx *gorm.DB, inputs []MockTransactionInput) (bool, error) {
	for _, input := range inputs {
		var utxo models.UTXO
		err := tx.Where("tx_id = ? AND output_index = ? AND status = ?",
			input.TxID, input.OutputIndex, "spent").First(&utxo).Error
		if err == nil {
			return true, nil
		}
		if !errors.Is(err, gorm.ErrRecordNotFound) {
			return false, fmt.Errorf("查询 UTXO 状态失败: %w", err)
		}
	}
	return false, nil
}

func (s *TransactionService) handleChainReorg(tx *gorm.DB, req *ImportBlockRequest) error {
	var oldBlocks []models.Block
	if err := tx.Where("height >= ? AND is_reorged = ?", req.Height, false).
		Order("height DESC").Find(&oldBlocks).Error; err != nil {
		return fmt.Errorf("查询待回滚区块失败: %w", err)
	}

	for _, block := range oldBlocks {
		if err := s.rollbackBlock(tx, &block); err != nil {
			return err
		}

		block.IsReorged = true
		if err := tx.Save(&block).Error; err != nil {
			return fmt.Errorf("标记区块为重组失败: %w", err)
		}

		if err := s.logAudit(tx, "ROLLBACK", "BLOCK", fmt.Sprintf("%d", block.ID), "system",
			fmt.Sprintf("链重组回滚区块 %d，原哈希: %s", block.Height, block.Hash), ""); err != nil {
			return err
		}
	}

	return nil
}

func (s *TransactionService) rollbackBlock(tx *gorm.DB, block *models.Block) error {
	var transactions []models.Transaction
	if err := tx.Where("block_height = ?", block.Height).Find(&transactions).Error; err != nil {
		return fmt.Errorf("查询区块交易失败: %w", err)
	}

	for _, t := range transactions {
		t.BlockHeight = 0
		t.BlockHash = ""
		t.Confirmations = 0
		t.IsConfirmed = false
		t.Status = "pending"
		if err := tx.Save(&t).Error; err != nil {
			return fmt.Errorf("回滚交易确认状态失败: %w", err)
		}

		var utxos []models.UTXO
		if err := tx.Where("tx_id = ?", t.TxID).Find(&utxos).Error; err != nil {
			return fmt.Errorf("查询交易 UTXO 失败: %w", err)
		}

		for _, u := range utxos {
			if u.Status != "spent" {
				u.BlockHeight = 0
				u.Confirmations = 0
				if err := tx.Save(&u).Error; err != nil {
					return fmt.Errorf("回滚 UTXO 确认状态失败: %w", err)
				}
			}
		}
	}

	return nil
}

func (s *TransactionService) logAudit(tx *gorm.DB, action, resource, resourceID, userID, details, ip string) error {
	logEntry := models.AuditLog{
		LogID:      fmt.Sprintf("log_%s", time.Now().Format("20060102150405")),
		Action:     action,
		Resource:   resource,
		ResourceID: resourceID,
		UserID:     userID,
		Details:    details,
		IPAddress:  ip,
		CreatedAt:  time.Now(),
	}

	if err := tx.Create(&logEntry).Error; err != nil {
		return fmt.Errorf("创建审计日志失败: %w", err)
	}

	return nil
}

func (s *TransactionService) GetTransactionByID(txID string) (*models.Transaction, error) {
	var txn models.Transaction
	if err := s.db.Where("tx_id = ?", txID).First(&txn).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, fmt.Errorf("查询交易失败: %w", err)
	}
	return &txn, nil
}

func (s *TransactionService) GetTransactionsByAddress(address string) ([]models.Transaction, error) {
	var utxos []models.UTXO
	if err := s.db.Where("address = ?", address).Find(&utxos).Error; err != nil {
		return nil, fmt.Errorf("查询地址 UTXO 失败: %w", err)
	}

	txIDs := make(map[string]bool)
	for _, u := range utxos {
		txIDs[u.TxID] = true
	}

	if len(txIDs) == 0 {
		return []models.Transaction{}, nil
	}

	txIDList := make([]string, 0, len(txIDs))
	for id := range txIDs {
		txIDList = append(txIDList, id)
	}

	var transactions []models.Transaction
	if err := s.db.Where("tx_id IN ?", txIDList).Find(&transactions).Error; err != nil {
		return nil, fmt.Errorf("查询交易列表失败: %w", err)
	}

	return transactions, nil
}

func (s *TransactionService) MarkTransactionAsSuspicious(txID, reason, userID string) (*ImportTransactionResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("开始事务失败: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var transaction models.Transaction
	if err := tx.Where("tx_id = ?", txID).First(&transaction).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &ImportTransactionResponse{
				Code:    models.ResourceNotFound.Code,
				Message: models.ResourceNotFound.Message,
			}, nil
		}
		return nil, fmt.Errorf("查询交易失败: %w", err)
	}

	transaction.HasDoubleSpend = true
	transaction.Status = "suspicious"
	if err := tx.Save(&transaction).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新交易状态失败: %w", err)
	}

	var utxos []models.UTXO
	if err := tx.Where("tx_id = ?", txID).Find(&utxos).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("查询 UTXO 失败: %w", err)
	}

	for _, u := range utxos {
		if u.Status != "spent" {
			u.Status = "suspicious"
			if err := tx.Save(&u).Error; err != nil {
				tx.Rollback()
				return nil, fmt.Errorf("更新 UTXO 状态失败: %w", err)
			}
		}
	}

	if err := s.logAudit(tx, "FLAG_SUSPICIOUS", "TRANSACTION", transaction.TxID, userID, reason, ""); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &ImportTransactionResponse{
		Code:    models.Success.Code,
		Message: "交易已标记为可疑",
		Data: &TransactionResult{
			TxID:             transaction.TxID,
			Status:           transaction.Status,
			Confirmations:    transaction.Confirmations,
			IsConfirmed:      transaction.IsConfirmed,
			IsSuspicious:     true,
			SuspiciousReason: reason,
		},
	}, nil
}

func (s *TransactionService) CalculateDepositStatus(txID string) (*TransactionResult, error) {
	transaction, err := s.GetTransactionByID(txID)
	if err != nil {
		return nil, err
	}
	if transaction == nil {
		return &TransactionResult{
			TxID:         txID,
			Status:       "not_found",
			IsSuspicious: false,
		}, nil
	}

	status := transaction.Status
	if transaction.IsConfirmed {
		status = "confirmed"
	} else if transaction.Confirmations >= s.config.ConfirmedBlocks {
		status = "confirmed"
	} else if transaction.Status == "suspicious" {
		status = "suspicious"
	} else {
		status = "pending"
	}

	suspiciousReason := ""
	if transaction.IsRBF {
		suspiciousReason = "RBF 风险"
	} else if transaction.HasDoubleSpend {
		suspiciousReason = "双花风险"
	}

	return &TransactionResult{
		TxID:             transaction.TxID,
		Status:           status,
		Confirmations:    transaction.Confirmations,
		IsConfirmed:      transaction.IsConfirmed || transaction.Confirmations >= s.config.ConfirmedBlocks,
		IsSuspicious:     transaction.IsRBF || transaction.HasDoubleSpend,
		SuspiciousReason: suspiciousReason,
	}, nil
}
