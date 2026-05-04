package services

import (
	"btc-recharge-service/config"
	"btc-recharge-service/models"
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type CollectionService struct {
	db           *gorm.DB
	config       *config.Config
	utxoSvc      *UTXOService
	riskSvc      *RiskControlService
}

func NewCollectionService(db *gorm.DB, cfg *config.Config, utxoSvc *UTXOService, riskSvc *RiskControlService) *CollectionService {
	return &CollectionService{
		db:      db,
		config:  cfg,
		utxoSvc: utxoSvc,
		riskSvc: riskSvc,
	}
}

type CreateCollectionPlanRequest struct {
	TargetAmount      int64  `json:"target_amount"`
	HotWalletAddress  string `json:"hot_wallet_address"`
	ColdWalletAddress string `json:"cold_wallet_address"`
	UserID            string `json:"user_id"`
	RequestID         string `json:"request_id"`
	CollectAll        bool   `json:"collect_all"`
}

type CollectionPlanResponse struct {
	Code              string              `json:"code"`
	Message           string              `json:"message"`
	Data              *CollectionPlanDetail `json:"data,omitempty"`
}

type CollectionPlanDetail struct {
	PlanID            string `json:"plan_id"`
	Status            string `json:"status"`
	TotalAmount       int64  `json:"total_amount"`
	FeeAmount         int64  `json:"fee_amount"`
	HotWalletAmount   int64  `json:"hot_wallet_amount"`
	ColdWalletAmount  int64  `json:"cold_wallet_amount"`
	HotWalletAddress  string `json:"hot_wallet_address"`
	ColdWalletAddress string `json:"cold_wallet_address"`
	UTXOs             []CollectionUTXO `json:"utxos"`
	NeedsAudit        bool   `json:"needs_audit"`
	AuditStatus       string `json:"audit_status"`
	CreatedAt         string `json:"created_at"`
}

func (s *CollectionService) CreateCollectionPlan(req *CreateCollectionPlanRequest) (*CollectionPlanResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("开始事务失败: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	if req.RequestID != "" {
		var existingPlan models.CollectionPlan
		err := tx.Where("plan_id = ? OR created_at > datetime('now', '-1 hour')", 
			fmt.Sprintf("plan_%s", req.RequestID)).
			First(&existingPlan).Error
		if err == nil {
			tx.Rollback()
			return &CollectionPlanResponse{
				Code:    models.IdempotentConflict.Code,
				Message: models.IdempotentConflict.Message,
				Data:    s.convertToPlanDetail(&existingPlan),
			}, nil
		}
	}

	var selectedUTXOs *SelectedUTXOs
	var err error

	if req.CollectAll {
		selectedUTXOs, err = s.utxoSvc.SelectAllEligibleUTXOs()
	} else {
		selectedUTXOs, err = s.utxoSvc.SelectUTXOsForCollection(req.TargetAmount)
	}

	if err != nil {
		tx.Rollback()
		return &CollectionPlanResponse{
			Code:    models.ResourceNotFound.Code,
			Message: fmt.Sprintf("选择 UTXO 失败: %v", err),
		}, nil
	}

	if selectedUTXOs.TotalAmount == 0 {
		tx.Rollback()
		return &CollectionPlanResponse{
			Code:    models.ResourceNotFound.Code,
			Message: "没有可用的 UTXO",
		}, nil
	}

	outputCount := 1
	if req.ColdWalletAddress != "" {
		outputCount = 2
	}

	estimatedFee := s.riskSvc.CalculateEstimatedFee(selectedUTXOs.InputCount, outputCount)

	feeCheck := s.riskSvc.CheckCollectionFee(selectedUTXOs.TotalAmount, estimatedFee)
	if !feeCheck.IsSafe {
		tx.Rollback()
		return &CollectionPlanResponse{
			Code:    feeCheck.ErrorCode,
			Message: feeCheck.RiskDescription,
		}, nil
	}

	netAmount := selectedUTXOs.TotalAmount - estimatedFee

	hotWalletAmount := netAmount
	coldWalletAmount := int64(0)

	if req.ColdWalletAddress != "" {
		if netAmount > s.config.MaxHotWalletBalance {
			coldWalletAmount = netAmount - s.config.MaxHotWalletBalance
			hotWalletAmount = s.config.MaxHotWalletBalance
		}
	}

	needsAudit := selectedUTXOs.TotalAmount > s.config.MaxHotWalletBalance

	utxosJSON, err := json.Marshal(selectedUTXOs.UTXOs)
	if err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("序列化 UTXO 失败: %w", err)
	}

	planID := fmt.Sprintf("plan_%s", uuid.New().String()[:12])

	plan := models.CollectionPlan{
		PlanID:            planID,
		Status:            "pending",
		TotalAmount:       selectedUTXOs.TotalAmount,
		FeeAmount:         estimatedFee,
		HotWalletAmount:   hotWalletAmount,
		ColdWalletAmount:  coldWalletAmount,
		HotWalletAddress:  req.HotWalletAddress,
		ColdWalletAddress: req.ColdWalletAddress,
		UTXOs:             string(utxosJSON),
		NeedsAudit:        needsAudit,
		AuditStatus:       "pending",
	}

	if needsAudit {
		plan.Status = "pending_audit"
	}

	if err := tx.Create(&plan).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建归集计划失败: %w", err)
	}

	if err := s.logAudit(tx, "CREATE", "COLLECTION_PLAN", planID, req.UserID, 
		fmt.Sprintf("创建归集计划，总金额: %d，手续费: %d", selectedUTXOs.TotalAmount, estimatedFee), ""); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &CollectionPlanResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    s.convertToPlanDetail(&plan),
	}, nil
}

func (s *CollectionService) GetCollectionPlan(planID string) (*CollectionPlanResponse, error) {
	var plan models.CollectionPlan
	if err := s.db.Where("plan_id = ?", planID).First(&plan).Error; err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &CollectionPlanResponse{
				Code:    models.ResourceNotFound.Code,
				Message: models.ResourceNotFound.Message,
			}, nil
		}
		return nil, fmt.Errorf("查询归集计划失败: %w", err)
	}

	return &CollectionPlanResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    s.convertToPlanDetail(&plan),
	}, nil
}

func (s *CollectionService) GetAllCollectionPlans() ([]CollectionPlanDetail, error) {
	var plans []models.CollectionPlan
	if err := s.db.Order("created_at DESC").Find(&plans).Error; err != nil {
		return nil, fmt.Errorf("查询归集计划列表失败: %w", err)
	}

	var details []CollectionPlanDetail
	for _, p := range plans {
		details = append(details, *s.convertToPlanDetail(&p))
	}

	return details, nil
}

func (s *CollectionService) ApproveCollectionPlan(planID, auditorID string) (*CollectionPlanResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("开始事务失败: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var plan models.CollectionPlan
	if err := tx.Where("plan_id = ?", planID).First(&plan).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &CollectionPlanResponse{
				Code:    models.ResourceNotFound.Code,
				Message: models.ResourceNotFound.Message,
			}, nil
		}
		return nil, fmt.Errorf("查询归集计划失败: %w", err)
	}

	if plan.Status != "pending_audit" {
		tx.Rollback()
		return &CollectionPlanResponse{
			Code:    models.ResourceConflict.Code,
			Message: "归集计划不需要审核",
		}, nil
	}

	plan.AuditStatus = "approved"
	plan.Status = "approved"

	if err := tx.Save(&plan).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新归集计划状态失败: %w", err)
	}

	audit := models.ManualAudit{
		AuditID:          fmt.Sprintf("audit_%s", uuid.New().String()[:12]),
		CollectionPlanID: plan.ID,
		AuditorID:        auditorID,
		AuditResult:      "approved",
		Reason:           "人工审核通过",
		AuditTime:        time.Now(),
	}

	if err := tx.Create(&audit).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建审核记录失败: %w", err)
	}

	if err := s.logAudit(tx, "APPROVE", "COLLECTION_PLAN", planID, auditorID, 
		"归集计划审核通过", ""); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &CollectionPlanResponse{
		Code:    models.Success.Code,
		Message: "归集计划审核通过",
		Data:    s.convertToPlanDetail(&plan),
	}, nil
}

func (s *CollectionService) RejectCollectionPlan(planID, auditorID, reason string) (*CollectionPlanResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("开始事务失败: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var plan models.CollectionPlan
	if err := tx.Where("plan_id = ?", planID).First(&plan).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &CollectionPlanResponse{
				Code:    models.ResourceNotFound.Code,
				Message: models.ResourceNotFound.Message,
			}, nil
		}
		return nil, fmt.Errorf("查询归集计划失败: %w", err)
	}

	if plan.Status != "pending_audit" {
		tx.Rollback()
		return &CollectionPlanResponse{
			Code:    models.ResourceConflict.Code,
			Message: "归集计划不需要审核",
		}, nil
	}

	plan.AuditStatus = "rejected"
	plan.Status = "rejected"

	if err := tx.Save(&plan).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新归集计划状态失败: %w", err)
	}

	audit := models.ManualAudit{
		AuditID:          fmt.Sprintf("audit_%s", uuid.New().String()[:12]),
		CollectionPlanID: plan.ID,
		AuditorID:        auditorID,
		AuditResult:      "rejected",
		Reason:           reason,
		AuditTime:        time.Now(),
	}

	if err := tx.Create(&audit).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("创建审核记录失败: %w", err)
	}

	if err := s.logAudit(tx, "REJECT", "COLLECTION_PLAN", planID, auditorID, 
		fmt.Sprintf("归集计划审核拒绝，原因: %s", reason), ""); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &CollectionPlanResponse{
		Code:    models.Success.Code,
		Message: "归集计划审核拒绝",
		Data:    s.convertToPlanDetail(&plan),
	}, nil
}

func (s *CollectionService) ExecuteCollectionPlan(planID string) (*CollectionPlanResponse, error) {
	tx := s.db.Begin()
	if tx.Error != nil {
		return nil, fmt.Errorf("开始事务失败: %w", tx.Error)
	}
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	var plan models.CollectionPlan
	if err := tx.Where("plan_id = ?", planID).First(&plan).Error; err != nil {
		tx.Rollback()
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return &CollectionPlanResponse{
				Code:    models.ResourceNotFound.Code,
				Message: models.ResourceNotFound.Message,
			}, nil
		}
		return nil, fmt.Errorf("查询归集计划失败: %w", err)
	}

	if plan.NeedsAudit && plan.AuditStatus != "approved" {
		tx.Rollback()
		return &CollectionPlanResponse{
			Code:    models.RequiresAudit.Code,
			Message: models.RequiresAudit.Message,
		}, nil
	}

	if plan.Status == "executed" || plan.Status == "confirmed" {
		tx.Rollback()
		return &CollectionPlanResponse{
			Code:    models.ResourceConflict.Code,
			Message: "归集计划已执行",
		}, nil
	}

	var utxos []CollectionUTXO
	if err := json.Unmarshal([]byte(plan.UTXOs), &utxos); err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("反序列化 UTXO 失败: %w", err)
	}

	for _, u := range utxos {
		var utxo models.UTXO
		if err := tx.Where("tx_id = ? AND output_index = ?", u.TxID, u.OutputIndex).First(&utxo).Error; err != nil {
			if errors.Is(err, gorm.ErrRecordNotFound) {
				continue
			}
			tx.Rollback()
			return nil, fmt.Errorf("查询 UTXO 失败: %w", err)
		}

		utxo.Status = "spent"
		if err := tx.Save(&utxo).Error; err != nil {
			tx.Rollback()
			return nil, fmt.Errorf("标记 UTXO 为已花费失败: %w", err)
		}
	}

	plan.Status = "executed"
	plan.TxID = fmt.Sprintf("collection_tx_%s", uuid.New().String()[:16])

	if err := tx.Save(&plan).Error; err != nil {
		tx.Rollback()
		return nil, fmt.Errorf("更新归集计划状态失败: %w", err)
	}

	if err := s.logAudit(tx, "EXECUTE", "COLLECTION_PLAN", planID, "system", 
		fmt.Sprintf("执行归集计划，交易 ID: %s", plan.TxID), ""); err != nil {
		tx.Rollback()
		return nil, err
	}

	if err := tx.Commit().Error; err != nil {
		return nil, fmt.Errorf("提交事务失败: %w", err)
	}

	return &CollectionPlanResponse{
		Code:    models.Success.Code,
		Message: "归集计划执行成功",
		Data:    s.convertToPlanDetail(&plan),
	}, nil
}

func (s *CollectionService) logAudit(tx *gorm.DB, action, resource, resourceID, userID, details, ip string) error {
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

func (s *CollectionService) convertToPlanDetail(plan *models.CollectionPlan) *CollectionPlanDetail {
	var utxos []CollectionUTXO
	if plan.UTXOs != "" {
		json.Unmarshal([]byte(plan.UTXOs), &utxos)
	}

	return &CollectionPlanDetail{
		PlanID:            plan.PlanID,
		Status:            plan.Status,
		TotalAmount:       plan.TotalAmount,
		FeeAmount:         plan.FeeAmount,
		HotWalletAmount:   plan.HotWalletAmount,
		ColdWalletAmount:  plan.ColdWalletAmount,
		HotWalletAddress:  plan.HotWalletAddress,
		ColdWalletAddress: plan.ColdWalletAddress,
		UTXOs:             utxos,
		NeedsAudit:        plan.NeedsAudit,
		AuditStatus:       plan.AuditStatus,
		CreatedAt:         plan.CreatedAt.Format(time.RFC3339),
	}
}
