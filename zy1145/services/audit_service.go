package services

import (
	"btc-recharge-service/config"
	"btc-recharge-service/models"
	"encoding/csv"
	"fmt"
	"strings"
	"time"

	"gorm.io/gorm"
)

type AuditService struct {
	db           *gorm.DB
	config       *config.Config
	utxoSvc      *UTXOService
}

func NewAuditService(db *gorm.DB, cfg *config.Config, utxoSvc *UTXOService) *AuditService {
	return &AuditService{
		db:      db,
		config:  cfg,
		utxoSvc: utxoSvc,
	}
}

type AuditReport struct {
	ReportID         string                  `json:"report_id"`
	GeneratedAt      string                  `json:"generated_at"`
	TimeRangeStart   string                  `json:"time_range_start,omitempty"`
	TimeRangeEnd     string                  `json:"time_range_end,omitempty"`
	
	Statistics       *AuditStatistics       `json:"statistics"`
	UTXOSummary      *UTXOSummary           `json:"utxo_summary"`
	RecentPlans      []CollectionPlanDetail `json:"recent_plans,omitempty"`
	RecentTransactions []TransactionSummary  `json:"recent_transactions,omitempty"`
	SuspiciousItems  []SuspiciousItem       `json:"suspicious_items,omitempty"`
	AuditLogs        []AuditLogEntry        `json:"audit_logs,omitempty"`
}

type AuditStatistics struct {
	TotalAddresses      int     `json:"total_addresses"`
	TotalTransactions   int     `json:"total_transactions"`
	ConfirmedTransactions int   `json:"confirmed_transactions"`
	PendingTransactions int     `json:"pending_transactions"`
	SuspiciousTransactions int  `json:"suspicious_transactions"`
	TotalCollectionPlans int    `json:"total_collection_plans"`
	ExecutedPlans       int     `json:"executed_plans"`
	PendingAuditPlans   int     `json:"pending_audit_plans"`
}

type UTXOSummary struct {
	TotalBalance        int64   `json:"total_balance"`
	ConfirmedBalance    int64   `json:"confirmed_balance"`
	PendingBalance      int64   `json:"pending_balance"`
	SuspiciousBalance   int64   `json:"suspicious_balance"`
	TotalUTXOs          int     `json:"total_utxos"`
	SpendableUTXOs      int     `json:"spendable_utxos"`
	DustUTXOs           int     `json:"dust_utxos"`
}

type TransactionSummary struct {
	TxID          string `json:"tx_id"`
	Status        string `json:"status"`
	Confirmations int    `json:"confirmations"`
	IsRBF         bool   `json:"is_rbf"`
	HasDoubleSpend bool  `json:"has_double_spend"`
	CreatedAt     string `json:"created_at"`
}

type SuspiciousItem struct {
	Type        string `json:"type"`
	ID          string `json:"id"`
	Reason      string `json:"reason"`
	Amount      int64  `json:"amount,omitempty"`
	DetectedAt  string `json:"detected_at"`
}

type AuditLogEntry struct {
	LogID      string `json:"log_id"`
	Action     string `json:"action"`
	Resource   string `json:"resource"`
	ResourceID string `json:"resource_id"`
	UserID     string `json:"user_id"`
	Details    string `json:"details"`
	CreatedAt  string `json:"created_at"`
}

func (s *AuditService) GenerateAuditReport(startTime, endTime *time.Time) (*AuditReport, error) {
	reportID := fmt.Sprintf("report_%s", time.Now().Format("20060102150405"))

	statistics, err := s.getAuditStatistics(startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("获取审计统计失败: %w", err)
	}

	utxoSummary := s.getUTXOSummary()

	recentPlans, err := s.getRecentCollectionPlans(startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("获取归集计划失败: %w", err)
	}

	recentTxns, err := s.getRecentTransactions(startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("获取交易记录失败: %w", err)
	}

	suspiciousItems, err := s.getSuspiciousItems(startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("获取可疑项目失败: %w", err)
	}

	auditLogs, err := s.getAuditLogs(startTime, endTime)
	if err != nil {
		return nil, fmt.Errorf("获取审计日志失败: %w", err)
	}

	report := &AuditReport{
		ReportID:           reportID,
		GeneratedAt:        time.Now().Format(time.RFC3339),
		Statistics:         statistics,
		UTXOSummary:        utxoSummary,
		RecentPlans:        recentPlans,
		RecentTransactions: recentTxns,
		SuspiciousItems:    suspiciousItems,
		AuditLogs:          auditLogs,
	}

	if startTime != nil {
		report.TimeRangeStart = startTime.Format(time.RFC3339)
	}
	if endTime != nil {
		report.TimeRangeEnd = endTime.Format(time.RFC3339)
	}

	return report, nil
}

func (s *AuditService) getAuditStatistics(startTime, endTime *time.Time) (*AuditStatistics, error) {
	stats := &AuditStatistics{}

	var totalAddresses int64
	s.db.Model(&models.RechargeAddress{}).Count(&totalAddresses)
	stats.TotalAddresses = int(totalAddresses)

	txnQuery := s.db.Model(&models.Transaction{})
	if startTime != nil {
		txnQuery = txnQuery.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		txnQuery = txnQuery.Where("created_at <= ?", *endTime)
	}

	var totalTxns int64
	txnQuery.Count(&totalTxns)
	stats.TotalTransactions = int(totalTxns)

	var confirmedTxns int64
	txnQuery.Where("is_confirmed = ?", true).Count(&confirmedTxns)
	stats.ConfirmedTransactions = int(confirmedTxns)

	var pendingTxns int64
	txnQuery.Where("is_confirmed = ? AND status = ?", false, "pending").Count(&pendingTxns)
	stats.PendingTransactions = int(pendingTxns)

	var suspiciousTxns int64
	txnQuery.Where("status = ?", "suspicious").Count(&suspiciousTxns)
	stats.SuspiciousTransactions = int(suspiciousTxns)

	planQuery := s.db.Model(&models.CollectionPlan{})
	if startTime != nil {
		planQuery = planQuery.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		planQuery = planQuery.Where("created_at <= ?", *endTime)
	}

	var totalPlans int64
	planQuery.Count(&totalPlans)
	stats.TotalCollectionPlans = int(totalPlans)

	var executedPlans int64
	planQuery.Where("status IN ?", []string{"executed", "confirmed"}).Count(&executedPlans)
	stats.ExecutedPlans = int(executedPlans)

	var pendingAuditPlans int64
	planQuery.Where("status = ?", "pending_audit").Count(&pendingAuditPlans)
	stats.PendingAuditPlans = int(pendingAuditPlans)

	return stats, nil
}

func (s *AuditService) getUTXOSummary() *UTXOSummary {
	summary := &UTXOSummary{}

	summary.ConfirmedBalance = s.utxoSvc.CalculateTotalConfirmedBalance()
	summary.PendingBalance = s.utxoSvc.CalculateTotalPendingBalance()
	summary.SuspiciousBalance = s.utxoSvc.CalculateTotalSuspiciousBalance()
	summary.TotalBalance = summary.ConfirmedBalance + summary.PendingBalance + summary.SuspiciousBalance

	var totalUTXOs int64
	s.db.Model(&models.UTXO{}).Count(&totalUTXOs)
	summary.TotalUTXOs = int(totalUTXOs)

	var spendableUTXOs int64
	s.db.Model(&models.UTXO{}).
		Where("status = ? AND is_dust = ? AND confirmations >= ?", "unspent", false, s.config.ConfirmedBlocks).
		Count(&spendableUTXOs)
	summary.SpendableUTXOs = int(spendableUTXOs)

	var dustUTXOs int64
	s.db.Model(&models.UTXO{}).Where("is_dust = ?", true).Count(&dustUTXOs)
	summary.DustUTXOs = int(dustUTXOs)

	return summary
}

func (s *AuditService) getRecentCollectionPlans(startTime, endTime *time.Time) ([]CollectionPlanDetail, error) {
	query := s.db.Model(&models.CollectionPlan{}).Order("created_at DESC").Limit(50)
	if startTime != nil {
		query = query.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("created_at <= ?", *endTime)
	}

	var plans []models.CollectionPlan
	if err := query.Find(&plans).Error; err != nil {
		return nil, err
	}

	var details []CollectionPlanDetail
	for _, p := range plans {
		var utxos []CollectionUTXO
		if p.UTXOs != "" {
			// Simple JSON unmarshal is handled in convertToPlanDetail
		}

		details = append(details, CollectionPlanDetail{
			PlanID:            p.PlanID,
			Status:            p.Status,
			TotalAmount:       p.TotalAmount,
			FeeAmount:         p.FeeAmount,
			HotWalletAmount:   p.HotWalletAmount,
			ColdWalletAmount:  p.ColdWalletAmount,
			HotWalletAddress:  p.HotWalletAddress,
			ColdWalletAddress: p.ColdWalletAddress,
			UTXOs:             utxos,
			NeedsAudit:        p.NeedsAudit,
			AuditStatus:       p.AuditStatus,
			CreatedAt:         p.CreatedAt.Format(time.RFC3339),
		})
	}

	return details, nil
}

func (s *AuditService) getRecentTransactions(startTime, endTime *time.Time) ([]TransactionSummary, error) {
	query := s.db.Model(&models.Transaction{}).Order("created_at DESC").Limit(100)
	if startTime != nil {
		query = query.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("created_at <= ?", *endTime)
	}

	var txns []models.Transaction
	if err := query.Find(&txns).Error; err != nil {
		return nil, err
	}

	var summaries []TransactionSummary
	for _, t := range txns {
		summaries = append(summaries, TransactionSummary{
			TxID:          t.TxID,
			Status:        t.Status,
			Confirmations: t.Confirmations,
			IsRBF:         t.IsRBF,
			HasDoubleSpend: t.HasDoubleSpend,
			CreatedAt:     t.CreatedAt.Format(time.RFC3339),
		})
	}

	return summaries, nil
}

func (s *AuditService) getSuspiciousItems(startTime, endTime *time.Time) ([]SuspiciousItem, error) {
	var items []SuspiciousItem

	var suspiciousTxns []models.Transaction
	txnQuery := s.db.Where("status = ? OR is_rbf = ? OR has_double_spend = ?", "suspicious", true, true)
	if startTime != nil {
		txnQuery = txnQuery.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		txnQuery = txnQuery.Where("created_at <= ?", *endTime)
	}
	if err := txnQuery.Find(&suspiciousTxns).Error; err != nil {
		return nil, err
	}

	for _, t := range suspiciousTxns {
		reason := ""
		if t.IsRBF {
			reason = "RBF 风险"
		} else if t.HasDoubleSpend {
			reason = "双花风险"
		} else {
			reason = "标记为可疑"
		}

		items = append(items, SuspiciousItem{
			Type:       "transaction",
			ID:         t.TxID,
			Reason:     reason,
			DetectedAt: t.CreatedAt.Format(time.RFC3339),
		})
	}

	var suspiciousUTXOs []models.UTXO
	utxoQuery := s.db.Where("status = ?", "suspicious")
	if startTime != nil {
		utxoQuery = utxoQuery.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		utxoQuery = utxoQuery.Where("created_at <= ?", *endTime)
	}
	if err := utxoQuery.Find(&suspiciousUTXOs).Error; err != nil {
		return nil, err
	}

	for _, u := range suspiciousUTXOs {
		items = append(items, SuspiciousItem{
			Type:       "utxo",
			ID:         fmt.Sprintf("%s:%d", u.TxID, u.OutputIndex),
			Reason:     "UTXO 标记为可疑",
			Amount:     u.Amount,
			DetectedAt: u.CreatedAt.Format(time.RFC3339),
		})
	}

	return items, nil
}

func (s *AuditService) getAuditLogs(startTime, endTime *time.Time) ([]AuditLogEntry, error) {
	query := s.db.Model(&models.AuditLog{}).Order("created_at DESC").Limit(200)
	if startTime != nil {
		query = query.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("created_at <= ?", *endTime)
	}

	var logs []models.AuditLog
	if err := query.Find(&logs).Error; err != nil {
		return nil, err
	}

	var entries []AuditLogEntry
	for _, l := range logs {
		entries = append(entries, AuditLogEntry{
			LogID:      l.LogID,
			Action:     l.Action,
			Resource:   l.Resource,
			ResourceID: l.ResourceID,
			UserID:     l.UserID,
			Details:    l.Details,
			CreatedAt:  l.CreatedAt.Format(time.RFC3339),
		})
	}

	return entries, nil
}

func (s *AuditService) ExportAuditReportAsCSV(report *AuditReport) (string, error) {
	var builder strings.Builder
	writer := csv.NewWriter(&builder)

	writer.Write([]string{"审计报告", report.ReportID})
	writer.Write([]string{"生成时间", report.GeneratedAt})
	if report.TimeRangeStart != "" {
		writer.Write([]string{"时间范围开始", report.TimeRangeStart})
	}
	if report.TimeRangeEnd != "" {
		writer.Write([]string{"时间范围结束", report.TimeRangeEnd})
	}
	writer.Write([]string{})

	writer.Write([]string{"【统计信息】"})
	writer.Write([]string{"总地址数", fmt.Sprintf("%d", report.Statistics.TotalAddresses)})
	writer.Write([]string{"总交易数", fmt.Sprintf("%d", report.Statistics.TotalTransactions)})
	writer.Write([]string{"已确认交易", fmt.Sprintf("%d", report.Statistics.ConfirmedTransactions)})
	writer.Write([]string{"待确认交易", fmt.Sprintf("%d", report.Statistics.PendingTransactions)})
	writer.Write([]string{"可疑交易", fmt.Sprintf("%d", report.Statistics.SuspiciousTransactions)})
	writer.Write([]string{"总归集计划", fmt.Sprintf("%d", report.Statistics.TotalCollectionPlans)})
	writer.Write([]string{"已执行计划", fmt.Sprintf("%d", report.Statistics.ExecutedPlans)})
	writer.Write([]string{"待审核计划", fmt.Sprintf("%d", report.Statistics.PendingAuditPlans)})
	writer.Write([]string{})

	writer.Write([]string{"【UTXO 汇总】"})
	writer.Write([]string{"总余额", fmt.Sprintf("%d", report.UTXOSummary.TotalBalance)})
	writer.Write([]string{"已确认余额", fmt.Sprintf("%d", report.UTXOSummary.ConfirmedBalance)})
	writer.Write([]string{"待确认余额", fmt.Sprintf("%d", report.UTXOSummary.PendingBalance)})
	writer.Write([]string{"可疑余额", fmt.Sprintf("%d", report.UTXOSummary.SuspiciousBalance)})
	writer.Write([]string{"总 UTXO 数", fmt.Sprintf("%d", report.UTXOSummary.TotalUTXOs)})
	writer.Write([]string{"可花费 UTXO", fmt.Sprintf("%d", report.UTXOSummary.SpendableUTXOs)})
	writer.Write([]string{"Dust UTXO", fmt.Sprintf("%d", report.UTXOSummary.DustUTXOs)})
	writer.Write([]string{})

	writer.Write([]string{"【可疑项目】"})
	writer.Write([]string{"类型", "ID", "原因", "金额", "检测时间"})
	for _, item := range report.SuspiciousItems {
		writer.Write([]string{item.Type, item.ID, item.Reason, fmt.Sprintf("%d", item.Amount), item.DetectedAt})
	}

	writer.Flush()

	return builder.String(), nil
}

func (s *AuditService) GetAuditLogs(startTime, endTime *time.Time, limit int) ([]AuditLogEntry, error) {
	query := s.db.Model(&models.AuditLog{}).Order("created_at DESC")
	if startTime != nil {
		query = query.Where("created_at >= ?", *startTime)
	}
	if endTime != nil {
		query = query.Where("created_at <= ?", *endTime)
	}
	if limit > 0 {
		query = query.Limit(limit)
	}

	var logs []models.AuditLog
	if err := query.Find(&logs).Error; err != nil {
		return nil, err
	}

	var entries []AuditLogEntry
	for _, l := range logs {
		entries = append(entries, AuditLogEntry{
			LogID:      l.LogID,
			Action:     l.Action,
			Resource:   l.Resource,
			ResourceID: l.ResourceID,
			UserID:     l.UserID,
			Details:    l.Details,
			CreatedAt:  l.CreatedAt.Format(time.RFC3339),
		})
	}

	return entries, nil
}
