package service

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"time"

	"fundservice/internal/db"
	"fundservice/internal/model"
)

type CreateAggregationTaskRequest struct {
	TaskDate      string `json:"task_date" binding:"required"`
	SourceCode    string `json:"source_code" binding:"required"`
	TargetCode    string `json:"target_code" binding:"required"`
	Amount        int64  `json:"amount" binding:"required"`
	IdempotencyID string `json:"idempotency_id"`
}

type AggregationResult struct {
	Task         *model.AggregationTask `json:"task"`
	IsDuplicate  bool                   `json:"is_duplicate"`
	DuplicateMsg string                 `json:"duplicate_msg"`
}

func generateIdempotencyKey(req *CreateAggregationTaskRequest) string {
	if req.IdempotencyID != "" {
		return req.IdempotencyID
	}

	hash := sha256.New()
	hash.Write([]byte(fmt.Sprintf("%s|%s|%s|%d", req.TaskDate, req.SourceCode, req.TargetCode, req.Amount)))
	return hex.EncodeToString(hash.Sum(nil))
}

func CreateAggregationTask(req *CreateAggregationTaskRequest) (*AggregationResult, error) {
	if req.Amount <= 0 {
		return nil, fmt.Errorf("amount must be positive")
	}

	idempotencyKey := generateIdempotencyKey(req)

	existingTask, err := db.GetTaskByIdempotencyKey(idempotencyKey)
	if err != nil {
		return nil, err
	}
	if existingTask != nil {
		msg := fmt.Sprintf("duplicate request detected. task_id=%s, status=%s", existingTask.ID, existingTask.Status)
		return &AggregationResult{
			Task:         existingTask,
			IsDuplicate:  true,
			DuplicateMsg: msg,
		}, nil
	}

	source, err := db.GetAccountByCode(req.SourceCode)
	if err != nil {
		return nil, err
	}
	if source == nil {
		return nil, fmt.Errorf("source account not found: %s", req.SourceCode)
	}

	target, err := db.GetAccountByCode(req.TargetCode)
	if err != nil {
		return nil, err
	}
	if target == nil {
		return nil, fmt.Errorf("target account not found: %s", req.TargetCode)
	}

	sourceParentID := source.GetParentID()
	targetParentID := target.GetParentID()

	hasRelation := (sourceParentID == target.ID) || (targetParentID == source.ID)
	if !hasRelation {
		return nil, fmt.Errorf("source and target accounts must have a parent-child relationship")
	}

	task := &model.AggregationTask{
		ID:             model.NewUUID(),
		TaskDate:       req.TaskDate,
		IDEMPOTENCYKEY: idempotencyKey,
		SourceAccount:  source.ID,
		TargetAccount:  target.ID,
		Amount:         req.Amount,
		Status:         model.TaskStatusPending,
		RetryCount:     0,
		MaxRetries:     3,
	}

	if err := db.CreateTask(task); err != nil {
		return nil, err
	}

	return &AggregationResult{
		Task:        task,
		IsDuplicate: false,
	}, nil
}

func ExecuteTask(taskID string) error {
	task, err := db.GetTaskByID(taskID)
	if err != nil {
		return err
	}
	if task == nil {
		return fmt.Errorf("task not found")
	}

	if task.Status == model.TaskStatusSuccess {
		return fmt.Errorf("task already executed successfully")
	}

	if task.Status != model.TaskStatusPending && task.Status != model.TaskStatusFailed && task.Status != model.TaskStatusRetrying {
		return fmt.Errorf("task is not executable, current status: %s", task.Status)
	}

	if task.Status == model.TaskStatusRetrying {
		task.RetryCount++
	}

	task.Status = model.TaskStatusProcessing
	if err := db.UpdateTaskStatus(task); err != nil {
		return err
	}

	if err := performFundTransfer(task); err != nil {
		task.Status = model.TaskStatusFailed
		task.LastError = err.Error()
		if updateErr := db.UpdateTaskStatus(task); updateErr != nil {
			return fmt.Errorf("failed to update task status: %w, original error: %v", updateErr, err)
		}
		return err
	}

	task.Status = model.TaskStatusSuccess
	task.LastError = ""
	if err := db.UpdateTaskStatus(task); err != nil {
		return err
	}

	return nil
}

func performFundTransfer(task *model.AggregationTask) error {
	sourceBalance, err := db.GetLatestBalance(task.SourceAccount, task.TaskDate)
	if err != nil {
		return fmt.Errorf("failed to get source balance: %w", err)
	}

	if sourceBalance < task.Amount {
		return fmt.Errorf("insufficient balance: source has %d, need %d", sourceBalance, task.Amount)
	}

	sourceTx := &model.Transaction{
		ID:              model.NewUUID(),
		AccountID:       task.SourceAccount,
		TransactionDate: task.TaskDate,
		TransactionType: model.TransTypeDebit,
		Amount:          task.Amount,
		Balance:         sourceBalance - task.Amount,
		ReferenceID:     task.ID,
		TaskID:          task.ID,
	}
	if err := db.CreateTransaction(sourceTx); err != nil {
		return fmt.Errorf("failed to create source transaction: %w", err)
	}

	targetBalance, err := db.GetLatestBalance(task.TargetAccount, task.TaskDate)
	if err != nil {
		return fmt.Errorf("failed to get target balance: %w", err)
	}

	targetTx := &model.Transaction{
		ID:              model.NewUUID(),
		AccountID:       task.TargetAccount,
		TransactionDate: task.TaskDate,
		TransactionType: model.TransTypeCredit,
		Amount:          task.Amount,
		Balance:         targetBalance + task.Amount,
		ReferenceID:     task.ID,
		TaskID:          task.ID,
	}
	if err := db.CreateTransaction(targetTx); err != nil {
		return fmt.Errorf("failed to create target transaction: %w", err)
	}

	return nil
}

func RetryFailedTasks(date string) ([]*model.AggregationTask, error) {
	failedTasks, err := db.GetFailedTasksForRetry(date)
	if err != nil {
		return nil, err
	}

	var retriedTasks []*model.AggregationTask
	for _, task := range failedTasks {
		task.Status = model.TaskStatusRetrying
		if err := db.UpdateTaskStatus(task); err != nil {
			continue
		}

		if err := ExecuteTask(task.ID); err != nil {
			continue
		}

		updatedTask, _ := db.GetTaskByID(task.ID)
		retriedTasks = append(retriedTasks, updatedTask)
	}

	return retriedTasks, nil
}

func SetInitialBalance(accountCode string, balance int64, date string) error {
	account, err := db.GetAccountByCode(accountCode)
	if err != nil {
		return err
	}
	if account == nil {
		return fmt.Errorf("account not found: %s", accountCode)
	}

	existingBalance, err := db.GetLatestBalance(account.ID, date)
	if err != nil {
		return err
	}
	if existingBalance > 0 {
		return fmt.Errorf("account already has a balance of %d, cannot set initial balance", existingBalance)
	}

	tx := &model.Transaction{
		ID:              model.NewUUID(),
		AccountID:       account.ID,
		TransactionDate: date,
		TransactionType: model.TransTypeCredit,
		Amount:          balance,
		Balance:         balance,
		ReferenceID:     "INITIAL_SETUP",
		TaskID:          "",
		CreatedAt:       time.Now(),
	}

	return db.CreateTransaction(tx)
}

func GetTasksByDate(date string) ([]*model.AggregationTask, error) {
	return db.GetAllTasksByDate(date)
}

func GetTaskByID(id string) (*model.AggregationTask, error) {
	return db.GetTaskByID(id)
}
