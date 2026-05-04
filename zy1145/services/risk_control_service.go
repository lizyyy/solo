package services

import (
	"btc-recharge-service/config"
	"btc-recharge-service/models"
	"fmt"

	"gorm.io/gorm"
)

type RiskControlService struct {
	db     *gorm.DB
	config *config.Config
}

func NewRiskControlService(db *gorm.DB, cfg *config.Config) *RiskControlService {
	return &RiskControlService{
		db:     db,
		config: cfg,
	}
}

type RiskAssessment struct {
	IsSafe          bool   `json:"is_safe"`
	RiskLevel       string `json:"risk_level"`
	RiskDescription string `json:"risk_description,omitempty"`
	ErrorCode       string `json:"error_code,omitempty"`
}

func (s *RiskControlService) AssessTransactionRisk(transaction *models.Transaction) *RiskAssessment {
	if !s.config.EnableZeroConf && transaction.Confirmations == 0 {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "high",
			RiskDescription: "0 确认入账已禁用",
			ErrorCode:       models.ZeroConfDisabled.Code,
		}
	}

	if transaction.IsRBF {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "high",
			RiskDescription: "检测到 RBF 风险",
			ErrorCode:       models.RbfRiskDetected.Code,
		}
	}

	if transaction.HasDoubleSpend {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "critical",
			RiskDescription: "检测到双花风险",
			ErrorCode:       models.DoubleSpendRisk.Code,
		}
	}

	if transaction.Confirmations < s.config.ConfirmedBlocks && !s.config.EnableZeroConf {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "medium",
			RiskDescription: fmt.Sprintf("确认数不足，当前: %d，需要: %d", transaction.Confirmations, s.config.ConfirmedBlocks),
			ErrorCode:       models.InsufficientConfirmations.Code,
		}
	}

	if transaction.Status == "suspicious" {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "high",
			RiskDescription: "交易被标记为可疑",
			ErrorCode:       models.InvalidRequest.Code,
		}
	}

	return &RiskAssessment{
		IsSafe:    true,
		RiskLevel: "low",
	}
}

func (s *RiskControlService) AssessUTXORisk(utxo *models.UTXO) *RiskAssessment {
	if utxo.IsDust {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "low",
			RiskDescription: "Dust 输出被过滤",
			ErrorCode:       models.DustOutput.Code,
		}
	}

	if utxo.Status == "suspicious" {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "high",
			RiskDescription: "UTXO 被标记为可疑",
			ErrorCode:       models.InvalidRequest.Code,
		}
	}

	if utxo.Status == "spent" {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "medium",
			RiskDescription: "UTXO 已被花费",
			ErrorCode:       models.ResourceConflict.Code,
		}
	}

	if utxo.Confirmations < s.config.ConfirmedBlocks && !s.config.EnableZeroConf {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "medium",
			RiskDescription: fmt.Sprintf("确认数不足，当前: %d，需要: %d", utxo.Confirmations, s.config.ConfirmedBlocks),
			ErrorCode:       models.InsufficientConfirmations.Code,
		}
	}

	return &RiskAssessment{
		IsSafe:    true,
		RiskLevel: "low",
	}
}

func (s *RiskControlService) CheckCollectionFee(amount int64, estimatedFee int64) *RiskAssessment {
	if amount <= estimatedFee {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "high",
			RiskDescription: fmt.Sprintf("归集金额 %d 不足以支付手续费 %d", amount, estimatedFee),
			ErrorCode:       models.InsufficientFee.Code,
		}
	}

	return &RiskAssessment{
		IsSafe:    true,
		RiskLevel: "low",
	}
}

func (s *RiskControlService) CheckHotWalletLimit(currentBalance int64, incomingAmount int64) *RiskAssessment {
	if currentBalance+incomingAmount > s.config.MaxHotWalletBalance {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "medium",
			RiskDescription: fmt.Sprintf("热钱包余额将超限，当前: %d， incoming: %d，限额: %d", 
				currentBalance, incomingAmount, s.config.MaxHotWalletBalance),
			ErrorCode:       models.HotWalletLimit.Code,
		}
	}

	return &RiskAssessment{
		IsSafe:    true,
		RiskLevel: "low",
	}
}

func (s *RiskControlService) CheckColdWalletMinimum(currentBalance int64) *RiskAssessment {
	if currentBalance < s.config.MinColdWalletBalance {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "medium",
			RiskDescription: fmt.Sprintf("冷钱包余额低于最低限额，当前: %d，最低限额: %d", 
				currentBalance, s.config.MinColdWalletBalance),
			ErrorCode:       models.ColdWalletLimit.Code,
		}
	}

	return &RiskAssessment{
		IsSafe:    true,
		RiskLevel: "low",
	}
}

func (s *RiskControlService) CheckRbfRisk(fee int64, mempoolFee int64) *RiskAssessment {
	riskRatio := float64(mempoolFee) / float64(fee)
	if riskRatio > s.config.RbfRiskLimit && riskRatio < 1.0 {
		return &RiskAssessment{
			IsSafe:          false,
			RiskLevel:       "high",
			RiskDescription: fmt.Sprintf("检测到潜在 RBF 风险，手续费比例: %.2f", riskRatio),
			ErrorCode:       models.RbfRiskDetected.Code,
		}
	}

	return &RiskAssessment{
		IsSafe:    true,
		RiskLevel: "low",
	}
}

func (s *RiskControlService) IsDust(amount int64) bool {
	return amount < s.config.DustThreshold
}

func (s *RiskControlService) CalculateEstimatedFee(inputCount int, outputCount int) int64 {
	baseSize := 10
	inputSize := 148 * inputCount
	outputSize := 34 * outputCount
	totalSize := int64(baseSize + inputSize + outputSize)
	return totalSize * s.config.FeeRate
}

func (s *RiskControlService) GetConfirmedBlocks() int {
	return s.config.ConfirmedBlocks
}

func (s *RiskControlService) GetDustThreshold() int64 {
	return s.config.DustThreshold
}

func (s *RiskControlService) GetFeeRate() int64 {
	return s.config.FeeRate
}
