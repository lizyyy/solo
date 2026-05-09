package api

import (
	"net/http"

	"fundservice/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

type createAccountReq struct {
	Code        string `json:"code" binding:"required"`
	Name        string `json:"name" binding:"required"`
	ParentCode  string `json:"parent_code"`
	CompanyType string `json:"company_type" binding:"required"`
}

func (h *Handler) CreateAccount(c *gin.Context) {
	var req createAccountReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	acc, err := service.CreateAccount(&service.CreateAccountRequest{
		Code:        req.Code,
		Name:        req.Name,
		ParentCode:  req.ParentCode,
		CompanyType: req.CompanyType,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "account created successfully",
		"data":    acc,
	})
}

func (h *Handler) GetAccountTree(c *gin.Context) {
	tree, err := service.GetAccountTree()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": tree})
}

type createTaskReq struct {
	TaskDate      string `json:"task_date" binding:"required"`
	SourceCode    string `json:"source_code" binding:"required"`
	TargetCode    string `json:"target_code" binding:"required"`
	Amount        int64  `json:"amount" binding:"required"`
	IdempotencyID string `json:"idempotency_id"`
}

func (h *Handler) CreateAggregationTask(c *gin.Context) {
	var req createTaskReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := service.CreateAggregationTask(&service.CreateAggregationTaskRequest{
		TaskDate:      req.TaskDate,
		SourceCode:    req.SourceCode,
		TargetCode:    req.TargetCode,
		Amount:        req.Amount,
		IdempotencyID: req.IdempotencyID,
	})
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if result.IsDuplicate {
		c.JSON(http.StatusConflict, gin.H{
			"message": result.DuplicateMsg,
			"data":    result.Task,
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "task created successfully",
		"data":    result.Task,
	})
}

func (h *Handler) ExecuteTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "task id is required"})
		return
	}

	if err := service.ExecuteTask(taskID); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, _ := service.GetTaskByID(taskID)
	c.JSON(http.StatusOK, gin.H{
		"message": "task executed successfully",
		"data":    task,
	})
}

func (h *Handler) GetTasks(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date is required"})
		return
	}

	tasks, err := service.GetTasksByDate(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": tasks})
}

func (h *Handler) RetryFailedTasks(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date is required"})
		return
	}

	retried, err := service.RetryFailedTasks(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "retry completed",
		"retried_count": len(retried),
		"data":          retried,
	})
}

func (h *Handler) PerformReconciliation(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date is required"})
		return
	}

	result, err := service.PerformReconciliation(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "reconciliation completed",
		"data":    result,
	})
}

func (h *Handler) GetDailyReport(c *gin.Context) {
	date := c.Query("date")
	if date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "date is required"})
		return
	}

	report, err := service.GetDailyReport(date)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if report == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "report not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": report})
}

func (h *Handler) GetDailyReportRange(c *gin.Context) {
	startDate := c.Query("start_date")
	endDate := c.Query("end_date")
	if startDate == "" || endDate == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "start_date and end_date are required"})
		return
	}

	reports, err := service.GetDailyReportRange(startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": reports})
}

func (h *Handler) GetPendingDiscrepancies(c *gin.Context) {
	discrepancies, err := service.GetPendingDiscrepancies()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": discrepancies})
}

type resolveDiscrepancyReq struct {
	ID         string `json:"id" binding:"required"`
	Status     string `json:"status" binding:"required"`
	ResolvedBy string `json:"resolved_by" binding:"required"`
}

func (h *Handler) ResolveDiscrepancy(c *gin.Context) {
	var req resolveDiscrepancyReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.ResolveDiscrepancy(req.ID, req.Status, req.ResolvedBy); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "discrepancy resolved"})
}

type setInitialBalanceReq struct {
	AccountCode string `json:"account_code" binding:"required"`
	Balance     int64  `json:"balance" binding:"required"`
	Date        string `json:"date" binding:"required"`
}

func (h *Handler) SetInitialBalance(c *gin.Context) {
	var req setInitialBalanceReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := service.SetInitialBalance(req.AccountCode, req.Balance, req.Date); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "initial balance set"})
}

func (h *Handler) GetAccountBalance(c *gin.Context) {
	code := c.Query("account_code")
	date := c.Query("date")
	if code == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account_code and date are required"})
		return
	}

	balance, err := service.GetAccountBalance(code, date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"account_code": code,
		"date":         date,
		"balance":      balance,
	})
}

func (h *Handler) GetAccountTransactions(c *gin.Context) {
	code := c.Query("account_code")
	date := c.Query("date")
	if code == "" || date == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "account_code and date are required"})
		return
	}

	transactions, err := service.GetAccountTransactions(code, date)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"data": transactions})
}
