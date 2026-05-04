package services

import (
	"fmt"
	"strings"
	"time"

	"saga-demo/internal/models"
	"saga-demo/internal/utils"
)

type ReportService struct {
	orderService     *OrderService
	inventoryService *InventoryService
	balanceService   *BalanceService
	couponService    *CouponService
	sagaService      *SagaService
	manualService    *ManualHandlingService
}

func NewReportService(
	orderService *OrderService,
	inventoryService *InventoryService,
	balanceService *BalanceService,
	couponService *CouponService,
	sagaService *SagaService,
	manualService *ManualHandlingService,
) *ReportService {
	return &ReportService{
		orderService:     orderService,
		inventoryService: inventoryService,
		balanceService:   balanceService,
		couponService:    couponService,
		sagaService:      sagaService,
		manualService:    manualService,
	}
}

func (s *ReportService) GenerateConsistencyReport(timeRange time.Duration) (*models.ConsistencyReport, error) {
	report := &models.ConsistencyReport{
		ReportID:    "RPT-" + utils.GenerateID(),
		GeneratedAt: time.Now(),
		TimeRange: models.TimeRange{
			From: time.Now().Add(-timeRange),
			To:   time.Now(),
		},
	}

	orders, err := s.orderService.ListOrders("")
	if err != nil {
		return nil, err
	}

	filteredOrders := make([]models.Order, 0)
	for _, order := range orders {
		if order.CreatedAt.After(report.TimeRange.From) && order.CreatedAt.Before(report.TimeRange.To) {
			filteredOrders = append(filteredOrders, order)
		}
	}

	report.Summary.TotalOrders = len(filteredOrders)
	report.Orders = make([]models.OrderReport, 0, len(filteredOrders))
	report.Inconsistents = make([]models.InconsistentItem, 0)

	for _, order := range filteredOrders {
		orderReport := s.checkOrderConsistency(&order)
		report.Orders = append(report.Orders, orderReport)

		switch order.Status {
		case models.OrderStatusPaid, models.OrderStatusCreated:
			report.Summary.SuccessfulOrders++
		case models.OrderStatusFailed:
			report.Summary.FailedOrders++
		case models.OrderStatusCompensated, models.OrderStatusCancelled:
			report.Summary.CompensatedOrders++
		}

		if !orderReport.IsConsistent {
			report.Summary.InconsistentCount++
		}
	}

	report.Inconsistents = s.collectInconsistencies(report.Orders)

	pendingManual, err := s.manualService.GetTasksByStatus(models.ManualHandlingStatusPending)
	if err != nil {
		return nil, err
	}
	report.Summary.PendingManual = len(pendingManual)

	report.ManualTasks = make([]models.ManualTaskReport, 0, len(pendingManual))
	for _, task := range pendingManual {
		report.ManualTasks = append(report.ManualTasks, models.ManualTaskReport{
			TaskID:      task.ID,
			OrderID:     task.OrderID,
			IssueType:   task.IssueType,
			Status:      task.Status,
			Description: task.Description,
			CreatedAt:   task.CreatedAt,
		})
	}

	return report, nil
}

func (s *ReportService) checkOrderConsistency(order *models.Order) models.OrderReport {
	report := models.OrderReport{
		OrderID:      order.ID,
		OrderStatus:  order.Status,
		IsConsistent: true,
	}

	inconsistencyReasons := make([]string, 0)

	inventoryStatus := s.getInventoryStatus(order)
	report.InventoryStatus = inventoryStatus

	balanceStatus := s.getBalanceStatus(order)
	report.BalanceStatus = balanceStatus

	couponStatus := s.getCouponStatus(order)
	report.CouponStatus = couponStatus

	saga, err := s.sagaService.GetSagaByOrderID(order.ID)
	if err == nil {
		report.SagaStatus = saga.Status
	} else {
		report.SagaStatus = models.SagaStatus("unknown")
	}

	switch order.Status {
	case models.OrderStatusPaid, models.OrderStatusCreated:
		if report.InventoryStatus != "deducted" {
			report.IsConsistent = false
			inconsistencyReasons = append(inconsistencyReasons,
				fmt.Sprintf("Inventory should be deducted but is %s", report.InventoryStatus))
		}
		if report.BalanceStatus != "deducted" {
			report.IsConsistent = false
			inconsistencyReasons = append(inconsistencyReasons,
				fmt.Sprintf("Balance should be deducted but is %s", report.BalanceStatus))
		}
		if order.CouponID != "" && report.CouponStatus != "used" {
			report.IsConsistent = false
			inconsistencyReasons = append(inconsistencyReasons,
				fmt.Sprintf("Coupon should be used but is %s", report.CouponStatus))
		}

	case models.OrderStatusCompensated, models.OrderStatusCancelled:
		if report.InventoryStatus == "locked" || report.InventoryStatus == "deducted" {
			report.IsConsistent = false
			inconsistencyReasons = append(inconsistencyReasons,
				fmt.Sprintf("Inventory should be released but is %s", report.InventoryStatus))
		}
		if report.BalanceStatus == "frozen" || report.BalanceStatus == "deducted" {
			report.IsConsistent = false
			inconsistencyReasons = append(inconsistencyReasons,
				fmt.Sprintf("Balance should be released but is %s", report.BalanceStatus))
		}
		if order.CouponID != "" && (report.CouponStatus == "locked" || report.CouponStatus == "used") {
			report.IsConsistent = false
			inconsistencyReasons = append(inconsistencyReasons,
				fmt.Sprintf("Coupon should be released but is %s", report.CouponStatus))
		}

	case models.OrderStatusPending:
		if report.InventoryStatus != "available" {
			report.IsConsistent = false
			inconsistencyReasons = append(inconsistencyReasons,
				fmt.Sprintf("Inventory should be available but is %s", report.InventoryStatus))
		}
		if report.BalanceStatus != "available" {
			report.IsConsistent = false
			inconsistencyReasons = append(inconsistencyReasons,
				fmt.Sprintf("Balance should be available but is %s", report.BalanceStatus))
		}
	}

	if len(inconsistencyReasons) > 0 {
		report.InconsistencyReason = strings.Join(inconsistencyReasons, "; ")
	}

	return report
}

func (s *ReportService) getInventoryStatus(order *models.Order) string {
	logs, err := s.inventoryService.GetInventoryLogs(order.ID)
	if err != nil || len(logs) == 0 {
		return "unknown"
	}

	lastLog := logs[len(logs)-1]
	return string(lastLog.Status)
}

func (s *ReportService) getBalanceStatus(order *models.Order) string {
	logs, err := s.balanceService.GetBalanceLogs(order.ID)
	if err != nil || len(logs) == 0 {
		return "unknown"
	}

	lastLog := logs[len(logs)-1]
	return string(lastLog.Status)
}

func (s *ReportService) getCouponStatus(order *models.Order) string {
	if order.CouponID == "" {
		return "none"
	}

	coupon, err := s.couponService.GetCoupon(order.CouponID)
	if err != nil {
		return "unknown"
	}

	return string(coupon.Status)
}

func (s *ReportService) collectInconsistencies(orderReports []models.OrderReport) []models.InconsistentItem {
	inconsistents := make([]models.InconsistentItem, 0)

	for _, report := range orderReports {
		if report.IsConsistent {
			continue
		}

		if strings.Contains(report.InconsistencyReason, "Inventory") {
			expectedState := "deducted"
			if report.OrderStatus == models.OrderStatusCompensated || report.OrderStatus == models.OrderStatusCancelled {
				expectedState = "released"
			}
			if report.OrderStatus == models.OrderStatusPending {
				expectedState = "available"
			}

			inconsistents = append(inconsistents, models.InconsistentItem{
				OrderID:       report.OrderID,
				ResourceType:  "inventory",
				ExpectedState: expectedState,
				ActualState:   report.InventoryStatus,
				Severity:      s.getSeverity(report.OrderStatus),
				Description:   fmt.Sprintf("Inventory inconsistency for order %s", report.OrderID),
			})
		}

		if strings.Contains(report.InconsistencyReason, "Balance") {
			expectedState := "deducted"
			if report.OrderStatus == models.OrderStatusCompensated || report.OrderStatus == models.OrderStatusCancelled {
				expectedState = "released"
			}
			if report.OrderStatus == models.OrderStatusPending {
				expectedState = "available"
			}

			inconsistents = append(inconsistents, models.InconsistentItem{
				OrderID:       report.OrderID,
				ResourceType:  "balance",
				ExpectedState: expectedState,
				ActualState:   report.BalanceStatus,
				Severity:      s.getSeverity(report.OrderStatus),
				Description:   fmt.Sprintf("Balance inconsistency for order %s", report.OrderID),
			})
		}

		if strings.Contains(report.InconsistencyReason, "Coupon") {
			expectedState := "used"
			if report.OrderStatus == models.OrderStatusCompensated || report.OrderStatus == models.OrderStatusCancelled {
				expectedState = "released"
			}
			if report.OrderStatus == models.OrderStatusPending {
				expectedState = "available"
			}

			inconsistents = append(inconsistents, models.InconsistentItem{
				OrderID:       report.OrderID,
				ResourceType:  "coupon",
				ExpectedState: expectedState,
				ActualState:   report.CouponStatus,
				Severity:      s.getSeverity(report.OrderStatus),
				Description:   fmt.Sprintf("Coupon inconsistency for order %s", report.OrderID),
			})
		}
	}

	return inconsistents
}

func (s *ReportService) getSeverity(orderStatus models.OrderStatus) string {
	switch orderStatus {
	case models.OrderStatusPaid:
		return "critical"
	case models.OrderStatusCreated, models.OrderStatusFailed:
		return "high"
	case models.OrderStatusCompensated, models.OrderStatusCancelled:
		return "medium"
	default:
		return "low"
	}
}

func (s *ReportService) ExportToMarkdown(report *models.ConsistencyReport) (string, error) {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("# 一致性审计报告\n\n"))
	sb.WriteString(fmt.Sprintf("**报告ID**: %s\n\n", report.ReportID))
	sb.WriteString(fmt.Sprintf("**生成时间**: %s\n\n", report.GeneratedAt.Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("**时间范围**: %s 至 %s\n\n",
		report.TimeRange.From.Format("2006-01-02 15:04:05"),
		report.TimeRange.To.Format("2006-01-02 15:04:05")))

	sb.WriteString("## 摘要\n\n")
	sb.WriteString("| 指标 | 数值 |\n")
	sb.WriteString("|------|------|\n")
	sb.WriteString(fmt.Sprintf("| 总订单数 | %d |\n", report.Summary.TotalOrders))
	sb.WriteString(fmt.Sprintf("| 成功订单 | %d |\n", report.Summary.SuccessfulOrders))
	sb.WriteString(fmt.Sprintf("| 失败订单 | %d |\n", report.Summary.FailedOrders))
	sb.WriteString(fmt.Sprintf("| 已补偿订单 | %d |\n", report.Summary.CompensatedOrders))
	sb.WriteString(fmt.Sprintf("| 不一致数量 | %d |\n", report.Summary.InconsistentCount))
	sb.WriteString(fmt.Sprintf("| 待处理人工任务 | %d |\n", report.Summary.PendingManual))
	sb.WriteString("\n")

	if report.Summary.InconsistentCount > 0 {
		sb.WriteString("## ⚠️ 不一致项目\n\n")
		sb.WriteString("| 订单ID | 资源类型 | 期望状态 | 实际状态 | 严重程度 | 描述 |\n")
		sb.WriteString("|--------|----------|----------|----------|----------|------|\n")
		for _, item := range report.Inconsistents {
			sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s | %s |\n",
				item.OrderID, item.ResourceType, item.ExpectedState,
				item.ActualState, item.Severity, item.Description))
		}
		sb.WriteString("\n")
	}

	if len(report.ManualTasks) > 0 {
		sb.WriteString("## 📋 待处理人工任务\n\n")
		sb.WriteString("| 任务ID | 订单ID | 问题类型 | 状态 | 创建时间 |\n")
		sb.WriteString("|--------|--------|----------|------|----------|\n")
		for _, task := range report.ManualTasks {
			sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s |\n",
				task.TaskID, task.OrderID, task.IssueType,
				task.Status, task.CreatedAt.Format("2006-01-02 15:04:05")))
		}
		sb.WriteString("\n")
	}

	sb.WriteString("## 订单详情\n\n")
	sb.WriteString("| 订单ID | 订单状态 | 库存状态 | 余额状态 | 优惠券状态 | Saga状态 | 一致性 |\n")
	sb.WriteString("|--------|----------|----------|----------|------------|----------|--------|\n")
	for _, order := range report.Orders {
		consistent := "✅ 一致"
		if !order.IsConsistent {
			consistent = "❌ 不一致"
		}
		sb.WriteString(fmt.Sprintf("| %s | %s | %s | %s | %s | %s | %s |\n",
			order.OrderID, order.OrderStatus, order.InventoryStatus,
			order.BalanceStatus, order.CouponStatus, order.SagaStatus, consistent))
	}

	return sb.String(), nil
}
