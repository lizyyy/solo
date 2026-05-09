package service

import (
	"fmt"
	"time"

	"fundservice/internal/db"
	"fundservice/internal/model"
)

type ReconciliationResult struct {
	Date              string                          `json:"date"`
	TotalTasks        int                             `json:"total_tasks"`
	SuccessfulTasks   int                             `json:"successful_tasks"`
	FailedTasks       int                             `json:"failed_tasks"`
	VerifiedTasks     int                             `json:"verified_tasks"`
	DiscrepantCount   int                             `json:"discrepant_count"`
	DiscrepantAmount  int64                           `json:"discrepant_amount"`
	Discrepancies     []*DiscrepancyDetail            `json:"discrepancies"`
	ReportID          string                          `json:"report_id"`
}

type DiscrepancyDetail struct {
	TaskID          string `json:"task_id,omitempty"`
	AccountID       string `json:"account_id,omitempty"`
	AccountCode     string `json:"account_code,omitempty"`
	AccountName     string `json:"account_name,omitempty"`
	ExpectedAmount  int64  `json:"expected_amount"`
	ActualAmount    int64  `json:"actual_amount"`
	DiffAmount      int64  `json:"diff_amount"`
	IssueType       string `json:"issue_type"`
	Description     string `json:"description"`
}

func PerformReconciliation(date string) (*ReconciliationResult, error) {
	accounts, err := db.GetAllAccounts()
	if err != nil {
		return nil, fmt.Errorf("failed to get accounts: %w", err)
	}

	accountMap := make(map[string]*model.Account)
	accountCodeMap := make(map[string]string)
	for _, acc := range accounts {
		accountMap[acc.ID] = acc
		accountCodeMap[acc.ID] = acc.Code
	}

	result := &ReconciliationResult{
		Date: date,
	}

	tasks, err := db.GetAllTasksByDate(date)
	if err != nil {
		return nil, fmt.Errorf("failed to get tasks: %w", err)
	}

	result.TotalTasks = len(tasks)
	var discrepancies []*DiscrepancyDetail
	var totalDiscrepancy int64
	var discrepantAccountCodes []string

	successCount := 0
	failedCount := 0
	verifiedCount := 0

	for _, task := range tasks {
		if task.Status == model.TaskStatusSuccess {
			successCount++
			
			issues, err := verifyTaskTransactions(task, accountMap)
			if err != nil {
				return nil, err
			}
			
			if len(issues) == 0 {
				verifiedCount++
			} else {
				for _, issue := range issues {
					discrepancies = append(discrepancies, issue)
					totalDiscrepancy += issue.DiffAmount
					
					if issue.AccountCode != "" {
						found := false
						for _, code := range discrepantAccountCodes {
							if code == issue.AccountCode {
								found = true
								break
							}
						}
						if !found {
							discrepantAccountCodes = append(discrepantAccountCodes, issue.AccountCode)
						}
					}
					
					existingDiscrepancies, err := db.GetDiscrepanciesByDate(date)
					if err != nil {
						return nil, err
					}
					
					found := false
					for _, d := range existingDiscrepancies {
						if d.AccountID == issue.AccountID {
							found = true
							break
						}
					}
					
					if !found && issue.AccountID != "" {
						dr := &model.DiscrepancyRecord{
							ID:              model.NewUUID(),
							AccountID:       issue.AccountID,
							RecordDate:      date,
							ExpectedBalance: issue.ExpectedAmount,
							ActualBalance:   issue.ActualAmount,
							DiffAmount:      issue.DiffAmount,
							Status:          model.DiscrepancyStatusPending,
						}
						if err := db.CreateDiscrepancyRecord(dr); err != nil {
							return nil, fmt.Errorf("failed to create discrepancy record: %w", err)
						}
					}
				}
			}
		} else if task.Status == model.TaskStatusFailed {
			failedCount++
		}
	}

	result.SuccessfulTasks = successCount
	result.FailedTasks = failedCount
	result.VerifiedTasks = verifiedCount
	result.Discrepancies = discrepancies
	result.DiscrepantCount = len(discrepancies)
	result.DiscrepantAmount = totalDiscrepancy

	report := &model.DailyReport{
		ID:                 model.NewUUID(),
		ReportDate:         date,
		Status:             model.ReportStatusCompleted,
		TotalTasks:         result.TotalTasks,
		SuccessfulTasks:    result.SuccessfulTasks,
		FailedTasks:        result.FailedTasks,
		DiscrepancyCount:   result.DiscrepantCount,
		DiscrepancyAmount:  totalDiscrepancy,
		DiscrepantAccounts: discrepantAccountCodes,
		GeneratedAt:        time.Now(),
	}

	existingReport, err := db.GetDailyReport(date)
	if err != nil {
		return nil, err
	}
	if existingReport != nil {
		report.ID = existingReport.ID
		if err := db.UpdateDailyReport(report); err != nil {
			return nil, fmt.Errorf("failed to update daily report: %w", err)
		}
	} else {
		if err := db.CreateDailyReport(report); err != nil {
			return nil, fmt.Errorf("failed to create daily report: %w", err)
		}
	}

	result.ReportID = report.ID

	return result, nil
}

func verifyTaskTransactions(task *model.AggregationTask, accountMap map[string]*model.Account) ([]*DiscrepancyDetail, error) {
	var issues []*DiscrepancyDetail
	
	sourceTrans, err := db.GetTransactionsByAccountAndDate(task.SourceAccount, task.TaskDate)
	if err != nil {
		return nil, err
	}
	
	targetTrans, err := db.GetTransactionsByAccountAndDate(task.TargetAccount, task.TaskDate)
	if err != nil {
		return nil, err
	}
	
	var sourceDebit *model.Transaction
	for _, tx := range sourceTrans {
		if tx.TaskID == task.ID && tx.TransactionType == model.TransTypeDebit {
			sourceDebit = tx
			break
		}
	}
	
	var targetCredit *model.Transaction
	for _, tx := range targetTrans {
		if tx.TaskID == task.ID && tx.TransactionType == model.TransTypeCredit {
			targetCredit = tx
			break
		}
	}
	
	sourceAccount := accountMap[task.SourceAccount]
	targetAccount := accountMap[task.TargetAccount]
	
	if sourceDebit == nil {
		issues = append(issues, &DiscrepancyDetail{
			TaskID:         task.ID,
			AccountID:      task.SourceAccount,
			AccountCode:    sourceAccount.Code,
			AccountName:    sourceAccount.Name,
			ExpectedAmount: task.Amount,
			ActualAmount:   0,
			DiffAmount:     task.Amount,
			IssueType:      "MISSING_DEBIT",
			Description:    fmt.Sprintf("源账户缺少借方交易记录，应扣减 %d", task.Amount),
		})
	} else if sourceDebit.Amount != task.Amount {
		issues = append(issues, &DiscrepancyDetail{
			TaskID:         task.ID,
			AccountID:      task.SourceAccount,
			AccountCode:    sourceAccount.Code,
			AccountName:    sourceAccount.Name,
			ExpectedAmount: task.Amount,
			ActualAmount:   sourceDebit.Amount,
			DiffAmount:     task.Amount - sourceDebit.Amount,
			IssueType:      "AMOUNT_MISMATCH",
			Description:    fmt.Sprintf("源账户借方交易金额不匹配，预期 %d，实际 %d", task.Amount, sourceDebit.Amount),
		})
	}
	
	if targetCredit == nil {
		issues = append(issues, &DiscrepancyDetail{
			TaskID:         task.ID,
			AccountID:      task.TargetAccount,
			AccountCode:    targetAccount.Code,
			AccountName:    targetAccount.Name,
			ExpectedAmount: task.Amount,
			ActualAmount:   0,
			DiffAmount:     task.Amount,
			IssueType:      "MISSING_CREDIT",
			Description:    fmt.Sprintf("目标账户缺少贷方交易记录，应增加 %d", task.Amount),
		})
	} else if targetCredit.Amount != task.Amount {
		issues = append(issues, &DiscrepancyDetail{
			TaskID:         task.ID,
			AccountID:      task.TargetAccount,
			AccountCode:    targetAccount.Code,
			AccountName:    targetAccount.Name,
			ExpectedAmount: task.Amount,
			ActualAmount:   targetCredit.Amount,
			DiffAmount:     task.Amount - targetCredit.Amount,
			IssueType:      "AMOUNT_MISMATCH",
			Description:    fmt.Sprintf("目标账户贷方交易金额不匹配，预期 %d，实际 %d", task.Amount, targetCredit.Amount),
		})
	}
	
	return issues, nil
}

func GetDailyReport(date string) (*model.DailyReport, error) {
	return db.GetDailyReport(date)
}

func GetDailyReportRange(startDate, endDate string) ([]*model.DailyReport, error) {
	return db.GetDailyReports(startDate, endDate)
}

func GetPendingDiscrepancies() ([]*model.DiscrepancyRecord, error) {
	return db.GetPendingDiscrepancies()
}

func GetDiscrepanciesByDate(date string) ([]*model.DiscrepancyRecord, error) {
	return db.GetDiscrepanciesByDate(date)
}

func ResolveDiscrepancy(discrepancyID string, status string, resolvedBy string) error {
	if status != model.DiscrepancyStatusResolved && status != model.DiscrepancyStatusInvestigating {
		return fmt.Errorf("invalid status: %s", status)
	}

	existing, err := db.GetPendingDiscrepancies()
	if err != nil {
		return err
	}

	found := false
	for _, d := range existing {
		if d.ID == discrepancyID {
			found = true
			break
		}
	}
	if !found {
		return fmt.Errorf("discrepancy not found or already resolved: %s", discrepancyID)
	}

	return db.UpdateDiscrepancyStatus(discrepancyID, status, resolvedBy)
}

func GetAccountTransactions(accountCode string, date string) ([]*model.Transaction, error) {
	account, err := db.GetAccountByCode(accountCode)
	if err != nil {
		return nil, err
	}
	if account == nil {
		return nil, fmt.Errorf("account not found: %s", accountCode)
	}

	return db.GetTransactionsByAccountAndDate(account.ID, date)
}

func GetAccountBalance(accountCode string, date string) (int64, error) {
	account, err := db.GetAccountByCode(accountCode)
	if err != nil {
		return 0, err
	}
	if account == nil {
		return 0, fmt.Errorf("account not found: %s", accountCode)
	}

	return db.GetLatestBalance(account.ID, date)
}
