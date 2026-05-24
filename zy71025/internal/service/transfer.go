package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"irrigation-water-rights/internal/models"
	"irrigation-water-rights/internal/repository"

	"gorm.io/gorm"
)

type WaterRightService struct {
	repo *repository.Repository
}

func NewWaterRightService(repo *repository.Repository) *WaterRightService {
	return &WaterRightService{repo: repo}
}

type TransferRequest struct {
	FromFarmerID uint    `json:"from_farmer_id"`
	ToFarmerID   uint    `json:"to_farmer_id"`
	Amount       float64 `json:"amount"`
	Reason       string  `json:"reason"`
	Week         int     `json:"week"`
	Year         int     `json:"year"`
	Operator     string  `json:"operator"`
}

type TransferResult struct {
	Success     bool    `json:"success"`
	Message     string  `json:"message"`
	TransferNo  string  `json:"transfer_no,omitempty"`
	FromBalance float64 `json:"from_balance,omitempty"`
	ToBalance   float64 `json:"to_balance,omitempty"`
	Transferred float64 `json:"transferred,omitempty"`
}

func (s *WaterRightService) CreateTransfer(req TransferRequest) (*TransferResult, error) {
	if req.FromFarmerID == req.ToFarmerID {
		return &TransferResult{
			Success: false,
			Message: "转让方和受让方不能相同",
		}, errors.New("same farmer")
	}

	if req.Amount <= 0 {
		return &TransferResult{
			Success: false,
			Message: "转让金额必须大于0",
		}, errors.New("invalid amount")
	}

	fromWR, err := s.repo.GetWaterRight(req.FromFarmerID, req.Year, req.Week)
	if err != nil {
		return &TransferResult{
			Success: false,
			Message: fmt.Sprintf("转让方水权信息不存在: 农户%d-%d年第%d周", req.FromFarmerID, req.Year, req.Week),
		}, err
	}

	if fromWR.Balance < req.Amount {
		return &TransferResult{
			Success: false,
			Message: fmt.Sprintf("额度不足: 可用余额%.2f立方米，申请转让%.2f立方米", fromWR.Balance, req.Amount),
		}, errors.New("insufficient balance")
	}

	_, err = s.repo.GetWaterRight(req.ToFarmerID, req.Year, req.Week)
	if err != nil {
		toWR := &models.WaterRight{
			FarmerID:   req.ToFarmerID,
			Year:       req.Year,
			Week:       req.Week,
			TotalQuota: 0,
			UsedQuota:  0,
			Balance:    0,
			Remarks:    "系统自动创建-接收转让",
		}
		if err := s.repo.CreateWaterRight(toWR); err != nil {
			return &TransferResult{
				Success: false,
				Message: "创建受让方水权账户失败",
			}, err
		}
	}

	transferNo := fmt.Sprintf("TF%04d%02d%010d", req.Year, req.Week, time.Now().UnixNano()%10000000000)
	transfer := &models.TransferApplication{
		TransferNo:    transferNo,
		FromFarmerID:  req.FromFarmerID,
		ToFarmerID:    req.ToFarmerID,
		Amount:        req.Amount,
		Reason:        req.Reason,
		Status:        models.TransferStatusPending,
		Week:          req.Week,
		Year:          req.Year,
		Operator:      req.Operator,
		EvidenceChain: fmt.Sprintf("创建申请:%s", time.Now().Format(time.RFC3339)),
	}

	if err := s.repo.CreateTransferApplication(transfer); err != nil {
		return &TransferResult{
			Success: false,
			Message: "创建转让申请失败",
		}, err
	}

	return &TransferResult{
		Success:     true,
		Message:     "转让申请已创建，等待审批",
		TransferNo:  transferNo,
		FromBalance: fromWR.Balance,
		Transferred: 0,
	}, nil
}

func (s *WaterRightService) ApproveTransfer(transferID uint, operator, opinion string) (*TransferResult, error) {
	transfer, err := s.repo.GetTransferByID(transferID)
	if err != nil {
		return &TransferResult{
			Success: false,
			Message: "转让申请不存在",
		}, err
	}

	if transfer.Status != models.TransferStatusPending {
		return &TransferResult{
			Success: false,
			Message: fmt.Sprintf("当前状态[%s]不允许审批", transfer.Status),
		}, errors.New("invalid status")
	}

	fromWR, err := s.repo.GetWaterRight(transfer.FromFarmerID, transfer.Year, transfer.Week)
	if err != nil {
		return &TransferResult{
			Success: false,
			Message: "转让方水权信息不存在",
		}, err
	}

	if fromWR.Balance < transfer.Amount {
		return &TransferResult{
			Success: false,
			Message: fmt.Sprintf("审批失败: 转让方余额不足，当前余额%.2f立方米", fromWR.Balance),
		}, errors.New("insufficient balance")
	}

	toWR, err := s.repo.GetWaterRight(transfer.ToFarmerID, transfer.Year, transfer.Week)
	if err != nil {
		return &TransferResult{
			Success: false,
			Message: "受让方水权信息不存在",
		}, err
	}

	tx := s.repo.DB().Begin()

	oldFromWR := *fromWR
	fromWR.Balance -= transfer.Amount
	fromWR.UsedQuota += transfer.Amount
	if err := tx.Save(fromWR).Error; err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "更新转让方水权失败",
		}, err
	}

	oldToWR := *toWR
	toWR.Balance += transfer.Amount
	if err := tx.Save(toWR).Error; err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "更新受让方水权失败",
		}, err
	}

	now := time.Now()
	oldTransfer := *transfer
	transfer.Status = models.TransferStatusApproved
	transfer.ApprovalOpinion = opinion
	transfer.ApprovedAt = &now
	transfer.EvidenceChain += fmt.Sprintf(" | 审批通过[%s]:%s", operator, time.Now().Format(time.RFC3339))
	if err := tx.Save(transfer).Error; err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "更新转让状态失败",
		}, err
	}

	if err := recordChangeHistoryTx(tx, "transfer", transfer.ID, oldTransfer, *transfer, "审批通过", operator); err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "记录变更历史失败",
		}, err
	}
	if err := recordChangeHistoryTx(tx, "water_right", fromWR.ID, oldFromWR, *fromWR, "转让转出", operator); err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "记录变更历史失败",
		}, err
	}
	if err := recordChangeHistoryTx(tx, "water_right", toWR.ID, oldToWR, *toWR, "转让转入", operator); err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "记录变更历史失败",
		}, err
	}

	tx.Commit()

	return &TransferResult{
		Success:     true,
		Message:     "转让审批通过，额度已划转",
		TransferNo:  transfer.TransferNo,
		FromBalance: fromWR.Balance,
		ToBalance:   toWR.Balance,
		Transferred: transfer.Amount,
	}, nil
}

func (s *WaterRightService) RevokeTransfer(transferID uint, operator, reason string) (*TransferResult, error) {
	transfer, err := s.repo.GetTransferByID(transferID)
	if err != nil {
		return &TransferResult{
			Success: false,
			Message: "转让申请不存在",
		}, err
	}

	if transfer.Status != models.TransferStatusApproved {
		return &TransferResult{
			Success: false,
			Message: fmt.Sprintf("只有已审批通过的转让才能撤销，当前状态[%s]", transfer.Status),
		}, errors.New("invalid status")
	}

	fromWR, err := s.repo.GetWaterRight(transfer.FromFarmerID, transfer.Year, transfer.Week)
	if err != nil {
		return &TransferResult{
			Success: false,
			Message: "转让方水权信息不存在",
		}, err
	}

	toWR, err := s.repo.GetWaterRight(transfer.ToFarmerID, transfer.Year, transfer.Week)
	if err != nil {
		return &TransferResult{
			Success: false,
			Message: "受让方水权信息不存在",
		}, err
	}

	if toWR.Balance < transfer.Amount {
		return &TransferResult{
			Success: false,
			Message: fmt.Sprintf("撤销失败: 受让方余额不足，当前余额%.2f立方米，需回退%.2f立方米", toWR.Balance, transfer.Amount),
		}, errors.New("insufficient balance for rollback")
	}

	tx := s.repo.DB().Begin()

	oldFromWR := *fromWR
	fromWR.Balance += transfer.Amount
	fromWR.UsedQuota -= transfer.Amount
	if err := tx.Save(fromWR).Error; err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "回退转让方水权失败",
		}, err
	}

	oldToWR := *toWR
	toWR.Balance -= transfer.Amount
	if err := tx.Save(toWR).Error; err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "回退受让方水权失败",
		}, err
	}

	now := time.Now()
	oldTransfer := *transfer
	transfer.Status = models.TransferStatusRevoked
	transfer.RevokedAt = &now
	transfer.RevokeReason = reason
	transfer.EvidenceChain += fmt.Sprintf(" | 撤销[%s]:%s - %s", operator, time.Now().Format(time.RFC3339), reason)
	if err := tx.Save(transfer).Error; err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "更新转让状态失败",
		}, err
	}

	if err := recordChangeHistoryTx(tx, "transfer", transfer.ID, oldTransfer, *transfer, "撤销转让", operator); err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "记录变更历史失败",
		}, err
	}
	if err := recordChangeHistoryTx(tx, "water_right", fromWR.ID, oldFromWR, *fromWR, "撤销转让-恢复额度", operator); err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "记录变更历史失败",
		}, err
	}
	if err := recordChangeHistoryTx(tx, "water_right", toWR.ID, oldToWR, *toWR, "撤销转让-扣减额度", operator); err != nil {
		tx.Rollback()
		return &TransferResult{
			Success: false,
			Message: "记录变更历史失败",
		}, err
	}

	tx.Commit()

	return &TransferResult{
		Success:     true,
		Message:     "转让已撤销，额度已回滚",
		TransferNo:  transfer.TransferNo,
		FromBalance: fromWR.Balance,
		ToBalance:   toWR.Balance,
		Transferred: -transfer.Amount,
	}, nil
}

func recordChangeHistoryTx(tx *gorm.DB, resourceType string, resourceID uint, before, after interface{}, reason, operator string) error {
	beforeJSON, _ := json.Marshal(before)
	afterJSON, _ := json.Marshal(after)
	history := &models.ChangeHistory{
		ResourceType: resourceType,
		ResourceID:   resourceID,
		BeforeValue:  string(beforeJSON),
		AfterValue:   string(afterJSON),
		ChangeReason: reason,
		Operator:     operator,
	}
	return tx.Create(history).Error
}
