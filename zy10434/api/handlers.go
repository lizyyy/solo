package api

import (
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"export-quota-api/models"
	"export-quota-api/service"
	"export-quota-api/storage"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	storage      *storage.SQLiteStorage
	quotaManager *service.QuotaManager
}

func NewHandler(storage *storage.SQLiteStorage, quotaManager *service.QuotaManager) *Handler {
	return &Handler{
		storage:      storage,
		quotaManager: quotaManager,
	}
}

type CreateTenantRequest struct {
	Name             string `json:"name" binding:"required"`
	MaxConcurrent    int    `json:"max_concurrent"`
	MaxDailySize     int64  `json:"max_daily_size"`
	MaxQueueSize     int    `json:"max_queue_size"`
}

func (h *Handler) CreateTenant(c *gin.Context) {
	var req CreateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.MaxConcurrent <= 0 {
		req.MaxConcurrent = 3
	}
	if req.MaxDailySize <= 0 {
		req.MaxDailySize = 1073741824
	}
	if req.MaxQueueSize <= 0 {
		req.MaxQueueSize = 10
	}

	tenant := models.NewTenant(req.Name, req.MaxConcurrent, req.MaxDailySize, req.MaxQueueSize)
	if err := h.storage.CreateTenant(tenant); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, tenant)
}

func (h *Handler) GetTenant(c *gin.Context) {
	tenantID := c.Param("id")
	tenant, err := h.storage.GetTenant(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return
	}

	c.JSON(http.StatusOK, tenant)
}

func (h *Handler) GetAllTenants(c *gin.Context) {
	tenants, err := h.storage.GetAllTenants()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tenants)
}

func (h *Handler) UpdateTenant(c *gin.Context) {
	tenantID := c.Param("id")
	tenant, err := h.storage.GetTenant(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if tenant == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "tenant not found"})
		return
	}

	var req CreateTenantRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	tenant.Name = req.Name
	if req.MaxConcurrent > 0 {
		tenant.MaxConcurrent = req.MaxConcurrent
	}
	if req.MaxDailySize > 0 {
		tenant.MaxDailySize = req.MaxDailySize
	}
	if req.MaxQueueSize > 0 {
		tenant.MaxQueueSize = req.MaxQueueSize
	}

	if err := h.storage.UpdateTenant(tenant); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tenant)
}

func (h *Handler) CreateTask(c *gin.Context) {
	var req service.CreateTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.TenantID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "tenant_id is required"})
		return
	}
	if req.FileName == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file_name is required"})
		return
	}
	if req.FileSize <= 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file_size must be positive"})
		return
	}
	if req.FileType == "" {
		req.FileType = "unknown"
	}

	result, err := h.quotaManager.CreateTask(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if result.Rejected {
		c.JSON(http.StatusTooManyRequests, gin.H{
			"task":          result.Task,
			"rejected":      true,
			"reject_reason": result.RejectReason,
			"reject_detail": result.RejectDetail,
		})
		return
	}

	c.JSON(http.StatusCreated, result)
}

func (h *Handler) GetTask(c *gin.Context) {
	taskID := c.Param("id")
	task, history, err := h.quotaManager.GetTaskWithHistory(taskID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if task == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"task":     task,
		"history":  history,
	})
}

func (h *Handler) GetTenantTasks(c *gin.Context) {
	tenantID := c.Param("tenant_id")
	statusParam := c.Query("status")
	limitParam := c.DefaultQuery("limit", "50")
	offsetParam := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitParam)
	if err != nil || limit <= 0 {
		limit = 50
	}
	offset, err := strconv.Atoi(offsetParam)
	if err != nil || offset < 0 {
		offset = 0
	}

	var status *models.ExportTaskStatus
	if statusParam != "" {
		s := models.ExportTaskStatus(statusParam)
		status = &s
	}

	tasks, err := h.storage.GetTasksByTenant(tenantID, status, limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, tasks)
}

func (h *Handler) GetTenantStatus(c *gin.Context) {
	tenantID := c.Param("tenant_id")
	status, err := h.quotaManager.GetTenantStatus(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, status)
}

type CompleteTaskRequest struct {
	DownloadURL string `json:"download_url" binding:"required"`
}

func (h *Handler) CompleteTask(c *gin.Context) {
	taskID := c.Param("id")
	var req CompleteTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.quotaManager.CompleteTask(taskID, req.DownloadURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

type FailTaskRequest struct {
	Reason string `json:"reason" binding:"required"`
}

func (h *Handler) FailTask(c *gin.Context) {
	taskID := c.Param("id")
	var req FailTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.quotaManager.FailTask(taskID, req.Reason)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

type ManualRetryRequest struct {
	Operator string `json:"operator" binding:"required"`
}

func (h *Handler) ManualRetry(c *gin.Context) {
	taskID := c.Param("id")
	var req ManualRetryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.quotaManager.ManualRetry(taskID, req.Operator)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

type AdjustQuotaRequest struct {
	AdditionalSize int64  `json:"additional_size" binding:"required"`
	Operator       string `json:"operator" binding:"required"`
}

func (h *Handler) AdjustQuota(c *gin.Context) {
	tenantID := c.Param("tenant_id")
	var req AdjustQuotaRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	window, err := h.quotaManager.ManualAdjustQuota(tenantID, req.AdditionalSize, req.Operator)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, window)
}

func (h *Handler) ProcessNextTasks(c *gin.Context) {
	tenantID := c.Param("tenant_id")
	tasks, err := h.quotaManager.ProcessNextTasks(tenantID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"started_tasks": tasks,
		"count":         len(tasks),
	})
}

func (h *Handler) ExportTasksCSV(c *gin.Context) {
	tenantID := c.Param("tenant_id")
	startDateParam := c.Query("start_date")
	endDateParam := c.Query("end_date")

	var startDate, endDate time.Time
	var err error

	if startDateParam != "" {
		startDate, err = time.Parse(time.RFC3339, startDateParam)
		if err != nil {
			startDate = time.Now().AddDate(0, 0, -30)
		}
	} else {
		startDate = time.Now().AddDate(0, 0, -30)
	}

	if endDateParam != "" {
		endDate, err = time.Parse(time.RFC3339, endDateParam)
		if err != nil {
			endDate = time.Now()
		}
	} else {
		endDate = time.Now()
	}

	tasks, err := h.storage.GetAllTasksForReport(startDate, endDate)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	var filteredTasks []*models.ExportTask
	for _, task := range tasks {
		if task.TenantID == tenantID {
			filteredTasks = append(filteredTasks, task)
		}
	}

	c.Header("Content-Type", "text/csv")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=export_tasks_%s.csv", time.Now().Format("20060102")))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	headers := []string{"Task ID", "File Name", "File Size", "Status", "Created At", "Started At", "Completed At", "Reject Reason", "Reject Detail", "Priority", "Download URL"}
	if err := writer.Write(headers); err != nil {
		return
	}

	for _, task := range filteredTasks {
		startedAt := ""
		if task.StartedAt != nil {
			startedAt = task.StartedAt.Format(time.RFC3339)
		}
		completedAt := ""
		if task.CompletedAt != nil {
			completedAt = task.CompletedAt.Format(time.RFC3339)
		}
		rejectReason := ""
		if task.RejectReason != nil {
			rejectReason = string(*task.RejectReason)
		}
		rejectDetail := ""
		if task.RejectDetail != nil {
			rejectDetail = *task.RejectDetail
		}
		downloadURL := ""
		if task.DownloadURL != nil {
			downloadURL = *task.DownloadURL
		}

		record := []string{
			task.ID,
			task.FileName,
			fmt.Sprintf("%d", task.FileSize),
			string(task.Status),
			task.CreatedAt.Format(time.RFC3339),
			startedAt,
			completedAt,
			rejectReason,
			rejectDetail,
			fmt.Sprintf("%d", task.Priority),
			downloadURL,
		}
		if err := writer.Write(record); err != nil {
			return
		}
	}
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":    "healthy",
		"timestamp": time.Now().Format(time.RFC3339),
	})
}

func (h *Handler) SeedSampleData(c *gin.Context) {
	tenant := models.NewTenant("Demo Tenant", 2, 536870912, 5)
	if err := h.storage.CreateTenant(tenant); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	sampleTasks := []struct {
		fileName string
		fileSize int64
		fileType string
		priority int
	}{
		{"report_2024.csv", 10485760, "csv", 1},
		{"customer_data.xlsx", 52428800, "xlsx", 2},
		{"sales_q1.pdf", 2097152, "pdf", 0},
		{"inventory_full.csv", 262144000, "csv", 3},
		{"user_logs.json", 104857600, "json", 1},
	}

	for _, st := range sampleTasks {
		req := &service.CreateTaskRequest{
			TenantID: tenant.ID,
			FileName: st.fileName,
			FileSize: st.fileSize,
			FileType: st.fileType,
			Priority: st.priority,
		}
		h.quotaManager.CreateTask(req)
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":      "Sample data created successfully",
		"tenant_id":    tenant.ID,
		"tenant_name":  tenant.Name,
		"tasks_created": len(sampleTasks),
	})
}
