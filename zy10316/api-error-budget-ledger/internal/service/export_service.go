package service

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"strconv"
	"time"

	"api-error-budget-ledger/internal/model"
	"api-error-budget-ledger/internal/storage"
)

type ExportService struct {
	storage storage.Storage
}

func NewExportService(storage storage.Storage) *ExportService {
	return &ExportService{storage: storage}
}

func (s *ExportService) ExportBudget(budgetID string, startTime, endTime *time.Time) (*model.ExportResponse, error) {
	budget, err := s.storage.GetBudget(budgetID)
	if err != nil {
		return nil, err
	}

	deductEvents := s.storage.ListDeductEvents(budgetID, startTime, endTime)
	exemptions := s.storage.ListExemptions(budgetID)
	freezeActions := s.storage.ListFreezeActions(budgetID)
	windows := s.storage.ListWindows(budgetID)
	timeline := s.storage.ListTimeline(budgetID, 10000, 0)
	compensations := s.storage.ListCompensations(budgetID)

	totalDeducted := 0
	for _, e := range deductEvents {
		totalDeducted += e.Amount
	}

	totalCompensated := 0
	for _, c := range compensations {
		totalCompensated += c.Amount
	}

	approvedCount := 0
	for _, e := range exemptions {
		if e.Status == model.ExemptionStatusApproved {
			approvedCount++
		}
	}

	summary := model.BudgetSummary{
		BudgetID:           budget.ID,
		ServiceID:          budget.ServiceID,
		TotalBudget:        budget.TotalBudget,
		RemainingBudget:    budget.RemainingBudget,
		TotalDeducted:      totalDeducted,
		TotalCompensated:   totalCompensated,
		NetUsed:            totalDeducted - totalCompensated,
		FreezeCount:        len(freezeActions),
		ExemptionCount:     len(exemptions),
		ExemptionApproved:  approvedCount,
		WindowCount:        len(windows),
		Status:             budget.Status,
		ExportTime:         model.Now(),
	}

	deductResult := make([]model.DeductEvent, len(deductEvents))
	for i, e := range deductEvents {
		deductResult[i] = *e
	}

	exemptionResult := make([]model.Exemption, len(exemptions))
	for i, e := range exemptions {
		exemptionResult[i] = *e
	}

	freezeResult := make([]model.FreezeAction, len(freezeActions))
	for i, a := range freezeActions {
		freezeResult[i] = *a
	}

	windowResult := make([]model.RequestWindow, len(windows))
	for i, w := range windows {
		windowResult[i] = *w
	}

	timelineResult := make([]model.TimelineEntry, len(timeline))
	for i, t := range timeline {
		timelineResult[i] = *t
	}

	return &model.ExportResponse{
		Summary:    summary,
		Deducts:    deductResult,
		Exemptions: exemptionResult,
		Freezes:    freezeResult,
		Windows:    windowResult,
		Timeline:   timelineResult,
	}, nil
}

func (s *ExportService) ExportToJSON(budgetID string, filePath string, startTime, endTime *time.Time) error {
	export, err := s.ExportBudget(budgetID, startTime, endTime)
	if err != nil {
		return err
	}

	data, err := json.MarshalIndent(export, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(filePath, data, 0644)
}

func (s *ExportService) ExportToCSV(budgetID string, dirPath string, startTime, endTime *time.Time) error {
	export, err := s.ExportBudget(budgetID, startTime, endTime)
	if err != nil {
		return err
	}

	if err := os.MkdirAll(dirPath, 0755); err != nil {
		return err
	}

	if err := s.writeSummaryCSV(dirPath, export.Summary); err != nil {
		return err
	}

	if err := s.writeDeductsCSV(dirPath, export.Deducts); err != nil {
		return err
	}

	if err := s.writeExemptionsCSV(dirPath, export.Exemptions); err != nil {
		return err
	}

	if err := s.writeFreezesCSV(dirPath, export.Freezes); err != nil {
		return err
	}

	if err := s.writeWindowsCSV(dirPath, export.Windows); err != nil {
		return err
	}

	if err := s.writeTimelineCSV(dirPath, export.Timeline); err != nil {
		return err
	}

	return nil
}

func (s *ExportService) writeSummaryCSV(dirPath string, summary model.BudgetSummary) error {
	file, err := os.Create(fmt.Sprintf("%s/summary.csv", dirPath))
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"BudgetID", "ServiceID", "TotalBudget", "RemainingBudget",
		"TotalDeducted", "TotalCompensated", "NetUsed",
		"FreezeCount", "ExemptionCount", "ExemptionApproved",
		"WindowCount", "Status", "ExportTime",
	}
	if err := writer.Write(headers); err != nil {
		return err
	}

	row := []string{
		summary.BudgetID,
		summary.ServiceID,
		strconv.Itoa(summary.TotalBudget),
		strconv.Itoa(summary.RemainingBudget),
		strconv.Itoa(summary.TotalDeducted),
		strconv.Itoa(summary.TotalCompensated),
		strconv.Itoa(summary.NetUsed),
		strconv.Itoa(summary.FreezeCount),
		strconv.Itoa(summary.ExemptionCount),
		strconv.Itoa(summary.ExemptionApproved),
		strconv.Itoa(summary.WindowCount),
		string(summary.Status),
		summary.ExportTime.Format(time.RFC3339),
	}
	return writer.Write(row)
}

func (s *ExportService) writeDeductsCSV(dirPath string, deducts []model.DeductEvent) error {
	file, err := os.Create(fmt.Sprintf("%s/deducts.csv", dirPath))
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"ID", "BudgetID", "WindowID", "RequestID", "Source",
		"Amount", "ErrorMessage", "Endpoint", "Timestamp",
		"IsCompensated", "CompensationID",
	}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, d := range deducts {
		compensationID := ""
		if d.CompensationID != nil {
			compensationID = *d.CompensationID
		}
		exemptionID := ""
		if d.ExemptionID != nil {
			exemptionID = *d.ExemptionID
		}
		row := []string{
			d.ID, d.BudgetID, d.WindowID, d.RequestID, string(d.Source),
			strconv.Itoa(d.Amount), d.ErrorMessage, d.Endpoint,
			d.Timestamp.Format(time.RFC3339),
			strconv.FormatBool(d.IsCompensated), compensationID, exemptionID,
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}
	return nil
}

func (s *ExportService) writeExemptionsCSV(dirPath string, exemptions []model.Exemption) error {
	file, err := os.Create(fmt.Sprintf("%s/exemptions.csv", dirPath))
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"ID", "DeductEventID", "BudgetID", "Reason", "RequestedBy",
		"ApprovedBy", "Status", "CompensateAmount", "RequestedAt", "ReviewedAt",
	}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, e := range exemptions {
		approvedBy := ""
		if e.ApprovedBy != nil {
			approvedBy = *e.ApprovedBy
		}
		reviewedAt := ""
		if e.ReviewedAt != nil {
			reviewedAt = e.ReviewedAt.Format(time.RFC3339)
		}
		row := []string{
			e.ID, e.DeductEventID, e.BudgetID, e.Reason, e.RequestedBy,
			approvedBy, string(e.Status), strconv.Itoa(e.CompensateAmount),
			e.RequestedAt.Format(time.RFC3339), reviewedAt,
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}
	return nil
}

func (s *ExportService) writeFreezesCSV(dirPath string, freezes []model.FreezeAction) error {
	file, err := os.Create(fmt.Sprintf("%s/freezes.csv", dirPath))
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"ID", "BudgetID", "Reason", "Description", "FrozenBy",
		"UnfrozenBy", "IsFrozen", "FrozenAt", "UnfrozenAt",
	}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, f := range freezes {
		unfrozenBy := ""
		if f.UnfrozenBy != nil {
			unfrozenBy = *f.UnfrozenBy
		}
		unfrozenAt := ""
		if f.UnfrozenAt != nil {
			unfrozenAt = f.UnfrozenAt.Format(time.RFC3339)
		}
		row := []string{
			f.ID, f.BudgetID, string(f.Reason), f.Description, f.FrozenBy,
			unfrozenBy, strconv.FormatBool(f.IsFrozen),
			f.FrozenAt.Format(time.RFC3339), unfrozenAt,
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}
	return nil
}

func (s *ExportService) writeWindowsCSV(dirPath string, windows []model.RequestWindow) error {
	file, err := os.Create(fmt.Sprintf("%s/windows.csv", dirPath))
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"ID", "BudgetID", "StartTime", "EndTime",
		"TotalCalls", "ErrorCount", "Deducted", "IsActive",
	}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, w := range windows {
		row := []string{
			w.ID, w.BudgetID, w.StartTime.Format(time.RFC3339),
			w.EndTime.Format(time.RFC3339), strconv.Itoa(w.TotalCalls),
			strconv.Itoa(w.ErrorCount), strconv.Itoa(w.Deducted),
			strconv.FormatBool(w.IsActive),
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}
	return nil
}

func (s *ExportService) writeTimelineCSV(dirPath string, timeline []model.TimelineEntry) error {
	file, err := os.Create(fmt.Sprintf("%s/timeline.csv", dirPath))
	if err != nil {
		return err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"ID", "BudgetID", "Action", "EntityID", "EntityType", "CreatedAt",
	}
	if err := writer.Write(headers); err != nil {
		return err
	}

	for _, t := range timeline {
		row := []string{
			t.ID, t.BudgetID, string(t.Action), t.EntityID, t.EntityType,
			t.CreatedAt.Format(time.RFC3339),
		}
		if err := writer.Write(row); err != nil {
			return err
		}
	}
	return nil
}
