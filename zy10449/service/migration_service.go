package service

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
	"webhook-migration/model"
	"webhook-migration/repository"
)

const SuccessThreshold = 0.95

type CreateMigrationRequest struct {
	SupplierID       string   `json:"supplier_id"`
	SupplierName     string   `json:"supplier_name"`
	OldWebhook       string   `json:"old_webhook"`
	NewWebhook       string   `json:"new_webhook"`
	EventTypes       []string `json:"event_types"`
	DualSendDuration int      `json:"dual_send_duration_hours"`
	Operator         string   `json:"operator"`
}

type MigrationService struct {
	migrationRepo *repository.MigrationRepository
	eventRepo     *repository.EventRecordRepository
	stateMachine  *StateMachineService
}

func NewMigrationService() *MigrationService {
	return &MigrationService{
		migrationRepo: repository.NewMigrationRepository(),
		eventRepo:     repository.NewEventRecordRepository(),
		stateMachine:  NewStateMachineService(),
	}
}

func (s *MigrationService) CreateMigration(req *CreateMigrationRequest) (*model.Migration, error) {
	rawInput, _ := json.Marshal(req)

	migration := &model.Migration{
		SupplierID:       req.SupplierID,
		SupplierName:     req.SupplierName,
		OldWebhook:       req.OldWebhook,
		NewWebhook:       req.NewWebhook,
		EventTypes:       req.EventTypes,
		DualSendStartAt:  time.Now(),
		DualSendEndAt:    time.Now().Add(time.Duration(req.DualSendDuration) * time.Hour),
		Status:           model.StatusCreated,
		RawInputSnapshot: string(rawInput),
	}

	if err := s.migrationRepo.Create(migration); err != nil {
		return nil, err
	}

	return migration, nil
}

func (s *MigrationService) StartDualSend(migrationID, operator string) error {
	return s.stateMachine.Transition(
		migrationID,
		model.StatusDualSend,
		operator,
		"开始双投验证",
		nil,
	)
}

func (s *MigrationService) StartReconciliation(migrationID, operator string) error {
	return s.stateMachine.Transition(
		migrationID,
		model.StatusReconciling,
		operator,
		"开始事件对账",
		nil,
	)
}

func (s *MigrationService) ReconcileEvents(migrationID string) error {
	total, matched, mismatched, missing, err := s.eventRepo.GetStatsByMigrationID(migrationID)
	if err != nil {
		return err
	}

	var successRate float64
	if total > 0 {
		successRate = float64(matched) / float64(total)
	}

	if err := s.migrationRepo.UpdateStats(migrationID, total, matched, mismatched, missing, successRate); err != nil {
		return err
	}

	if successRate >= SuccessThreshold {
		return s.stateMachine.Transition(
			migrationID,
			model.StatusVerified,
			"system",
			fmt.Sprintf("对账完成，成功率%.2f%%，达到阈值要求", successRate*100),
			map[string]interface{}{
				"total":      total,
				"matched":    matched,
				"mismatched": mismatched,
				"missing":    missing,
			},
		)
	} else {
		return s.stateMachine.Transition(
			migrationID,
			model.StatusFailed,
			"system",
			fmt.Sprintf("对账失败，成功率%.2f%%，未达到阈值%.2f%%要求", successRate*100, SuccessThreshold*100),
			map[string]interface{}{
				"total":      total,
				"matched":    matched,
				"mismatched": mismatched,
				"missing":    missing,
			},
		)
	}
}

func (s *MigrationService) ConfirmSwitch(migrationID, operator string) error {
	return s.stateMachine.Transition(
		migrationID,
		model.StatusSwitched,
		operator,
		"人工确认切换到新地址",
		nil,
	)
}

func (s *MigrationService) Rollback(migrationID, operator, reason string) error {
	return s.stateMachine.Transition(
		migrationID,
		model.StatusRolledBack,
		operator,
		reason,
		nil,
	)
}

func (s *MigrationService) ManualFix(migrationID, operator string, updates map[string]interface{}) error {
	if err := s.migrationRepo.UpdateMigration(migrationID, updates); err != nil {
		return err
	}
	return nil
}

func (s *MigrationService) GetMigration(migrationID string) (*model.Migration, error) {
	return s.migrationRepo.GetByID(migrationID)
}

func (s *MigrationService) ListMigrations(page, pageSize int) ([]model.Migration, int64, error) {
	return s.migrationRepo.List(page, pageSize)
}

func (s *MigrationService) GetTransitions(migrationID string) ([]model.StatusTransition, error) {
	return s.stateMachine.GetTransitions(migrationID)
}

func (s *MigrationService) ExportToCSV(migrationID string, filename string) error {
	migration, err := s.migrationRepo.GetByID(migrationID)
	if err != nil {
		return err
	}

	events, err := s.eventRepo.GetAllByMigrationID(migrationID)
	if err != nil {
		return err
	}

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{"===== 迁移主记录 ====="})
	writer.Write([]string{"字段", "值"})
	writer.Write([]string{"迁移ID", migration.ID})
	writer.Write([]string{"供应商名称", migration.SupplierName})
	writer.Write([]string{"旧Webhook地址", migration.OldWebhook})
	writer.Write([]string{"新Webhook地址", migration.NewWebhook})
	writer.Write([]string{"事件类型", strings.Join(migration.EventTypes, ", ")})
	writer.Write([]string{"双投窗口", fmt.Sprintf("%s ~ %s", migration.DualSendStartAt.Format("2006-01-02 15:04:05"), migration.DualSendEndAt.Format("2006-01-02 15:04:05"))})
	writer.Write([]string{"当前状态", string(migration.Status)})
	writer.Write([]string{"总事件数", strconv.Itoa(migration.TotalEvents)})
	writer.Write([]string{"匹配事件数", strconv.Itoa(migration.MatchedEvents)})
	writer.Write([]string{"不匹配事件数", strconv.Itoa(migration.MismatchedEvents)})
	writer.Write([]string{"缺失事件数", strconv.Itoa(migration.MissingEvents)})
	writer.Write([]string{"成功率", fmt.Sprintf("%.2f%%", migration.SuccessRate*100)})
	writer.Write([]string{"切换结论", migration.SwitchConclusion})
	writer.Write([]string{"失败原因", migration.FailureReason})
	writer.Write([]string{"创建时间", migration.CreatedAt.Format("2006-01-02 15:04:05")})
	if migration.CompletedAt != nil {
		writer.Write([]string{"完成时间", migration.CompletedAt.Format("2006-01-02 15:04:05")})
	}

	writer.Write([]string{})
	writer.Write([]string{"===== 状态流转历史 ====="})
	transitions, _ := s.stateMachine.GetTransitions(migrationID)
	writer.Write([]string{"序号", "从状态", "到状态", "触发人", "原因", "原始输入", "时间"})
	for i, t := range transitions {
		writer.Write([]string{
			strconv.Itoa(i + 1),
			string(t.FromStatus),
			string(t.ToStatus),
			t.TriggeredBy,
			t.Reason,
			t.RawInput,
			t.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	writer.Write([]string{})
	writer.Write([]string{"===== 事件详情记录 ====="})
	writer.Write([]string{"事件ID", "事件类型", "比对结果", "比对详情", "旧地址响应", "新地址响应", "创建时间"})
	for _, e := range events {
		writer.Write([]string{
			e.EventID,
			e.EventType,
			string(e.CompareResult),
			e.CompareDetail,
			strconv.Itoa(e.OldResponseStatus),
			strconv.Itoa(e.NewResponseStatus),
			e.CreatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	return nil
}

func (s *MigrationService) ExportAllToCSV(filename string) error {
	migrations := s.migrationRepo.GetAllForExport()

	file, err := os.Create(filename)
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	writer.Write([]string{
		"迁移ID", "供应商名称", "旧Webhook", "新Webhook", "事件类型",
		"双投窗口", "最终状态", "总事件数", "匹配数", "不匹配数", "缺失数",
		"成功率", "切换结论", "失败原因", "完成时间",
	})

	for _, m := range migrations {
		completedAt := ""
		if m.CompletedAt != nil {
			completedAt = m.CompletedAt.Format("2006-01-02 15:04:05")
		}
		writer.Write([]string{
			m.ID,
			m.SupplierName,
			m.OldWebhook,
			m.NewWebhook,
			strings.Join(m.EventTypes, ", "),
			fmt.Sprintf("%s ~ %s", m.DualSendStartAt.Format("2006-01-02 15:04:05"), m.DualSendEndAt.Format("2006-01-02 15:04:05")),
			string(m.Status),
			strconv.Itoa(m.TotalEvents),
			strconv.Itoa(m.MatchedEvents),
			strconv.Itoa(m.MismatchedEvents),
			strconv.Itoa(m.MissingEvents),
			fmt.Sprintf("%.2f%%", m.SuccessRate*100),
			m.SwitchConclusion,
			m.FailureReason,
			completedAt,
		})
	}

	return nil
}
