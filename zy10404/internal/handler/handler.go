package handler

import (
	"encoding/csv"
	"fmt"
	"grayscale-backfill/internal/service"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

type CreateBatchRequest struct {
	BatchID     string `json:"batch_id" binding:"required"`
	BatchName   string `json:"batch_name" binding:"required"`
	Description string `json:"description"`
}

type CreateWindowRequest struct {
	WindowID    string    `json:"window_id" binding:"required"`
	BatchID     string    `json:"batch_id" binding:"required"`
	StartTime   time.Time `json:"start_time" binding:"required"`
	EndTime     time.Time `json:"end_time" binding:"required"`
	MetricTypes []string  `json:"metric_types" binding:"required"`
	Granularity string    `json:"granularity" default:"5m"`
}

type StatusTransitionRequest struct {
	Operator string `json:"operator" binding:"required"`
	Comment  string `json:"comment"`
}

type CompleteTaskRequest struct {
	SuccessRecords int64                  `json:"success_records" binding:"required,min=0"`
	FailedRecords  int64                  `json:"failed_records" binding:"min=0"`
	Result         map[string]interface{} `json:"result"`
}

type FailTaskRequest struct {
	FailureReason string                 `json:"failure_reason" binding:"required"`
	ErrorDetails  map[string]interface{} `json:"error_details"`
}

type ManualCorrectRequest struct {
	Operator string                 `json:"operator" binding:"required"`
	Updates  map[string]interface{} `json:"updates" binding:"required"`
}

func (h *Handler) CreateBatch(c *gin.Context) {
	var req CreateBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	batch, err := h.svc.CreateBatch(req.BatchID, req.BatchName, req.Description)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, batch)
}

func (h *Handler) CreateWindow(c *gin.Context) {
	var req CreateWindowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	window, err := h.svc.CreateWindow(req.BatchID, req.WindowID, req.StartTime, req.EndTime, req.MetricTypes, req.Granularity)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, window)
}

func (h *Handler) CreateBackfillTask(c *gin.Context) {
	var req service.CreateBackfillRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.svc.CreateBackfillTask(&req)
	if err != nil {
		if err.Error() == "duplicate backfill task detected" {
			c.JSON(http.StatusConflict, gin.H{
				"error":   err.Error(),
				"existing_task": task,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, task)
}

func (h *Handler) GetBackfillTask(c *gin.Context) {
	backfillID := c.Param("id")
	if backfillID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "backfill_id is required"})
		return
	}

	details, err := h.svc.GetTaskWithDetails(backfillID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	c.JSON(http.StatusOK, details)
}

func (h *Handler) ListBackfillTasks(c *gin.Context) {
	batchID := c.Query("batch_id")
	status := c.Query("status")
	offsetStr := c.DefaultQuery("offset", "0")
	limitStr := c.DefaultQuery("limit", "20")

	offset, _ := strconv.Atoi(offsetStr)
	limit, _ := strconv.Atoi(limitStr)

	tasks, total, err := h.svc.ListTasks(batchID, status, offset, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  tasks,
		"total": total,
		"offset": offset,
		"limit":  limit,
	})
}

func (h *Handler) SubmitForReview(c *gin.Context) {
	backfillID := c.Param("id")
	var req StatusTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.svc.SubmitForReview(backfillID, req.Operator, req.Comment)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *Handler) ApproveTask(c *gin.Context) {
	backfillID := c.Param("id")
	var req StatusTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.svc.ApproveTask(backfillID, req.Operator, req.Comment)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *Handler) RejectTask(c *gin.Context) {
	backfillID := c.Param("id")
	var req StatusTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.svc.RejectTask(backfillID, req.Operator, req.Comment)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *Handler) StartProcessing(c *gin.Context) {
	backfillID := c.Param("id")
	var req StatusTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.svc.StartProcessing(backfillID, req.Operator)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *Handler) CompleteTask(c *gin.Context) {
	backfillID := c.Param("id")
	var req CompleteTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.svc.CompleteTask(backfillID, req.SuccessRecords, req.FailedRecords, req.Result)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *Handler) FailTask(c *gin.Context) {
	backfillID := c.Param("id")
	var req FailTaskRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.svc.FailTask(backfillID, req.FailureReason, req.ErrorDetails)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *Handler) CancelTask(c *gin.Context) {
	backfillID := c.Param("id")
	var req StatusTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.svc.CancelTask(backfillID, req.Operator, req.Comment)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *Handler) ManualCorrect(c *gin.Context) {
	backfillID := c.Param("id")
	var req ManualCorrectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	task, err := h.svc.ManualCorrect(backfillID, req.Operator, req.Updates)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, task)
}

func (h *Handler) ExportTask(c *gin.Context) {
	backfillID := c.Param("id")
	format := c.DefaultQuery("format", "json")

	exportData, err := h.svc.GetExportData(backfillID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "task not found"})
		return
	}

	if format == "csv" {
		c.Header("Content-Type", "text/csv")
		c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=backfill-%s.csv", backfillID))

		writer := csv.NewWriter(c.Writer)
		defer writer.Flush()

		writer.Write([]string{"Field", "Value"})

		flattenMap("", exportData, writer)
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=backfill-%s.json", backfillID))
	c.JSON(http.StatusOK, exportData)
}

func flattenMap(prefix string, m map[string]interface{}, writer *csv.Writer) {
	for k, v := range m {
		key := k
		if prefix != "" {
			key = prefix + "." + k
		}

		switch val := v.(type) {
		case map[string]interface{}:
			flattenMap(key, val, writer)
		case []interface{}:
			for i, item := range val {
				if itemMap, ok := item.(map[string]interface{}); ok {
					flattenMap(fmt.Sprintf("%s[%d]", key, i), itemMap, writer)
				} else {
					writer.Write([]string{fmt.Sprintf("%s[%d]", key, i), fmt.Sprintf("%v", item)})
				}
			}
		default:
			writer.Write([]string{key, fmt.Sprintf("%v", v)})
		}
	}
}

func (h *Handler) CreateSnapshot(c *gin.Context) {
	backfillID := c.Param("id")
	var req struct {
		SnapshotType string                 `json:"snapshot_type" binding:"required"`
		Content      map[string]interface{} `json:"content" binding:"required"`
		RecordCount  int64                  `json:"record_count"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	snapshot, err := h.svc.CreateSnapshot(backfillID, req.SnapshotType, req.Content, req.RecordCount)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, snapshot)
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"time":   time.Now(),
	})
}

func (h *Handler) GetStatusTransitions(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"DRAFT": []string{
			"PENDING_REVIEW (submit)",
			"CANCELLED (cancel)",
		},
		"PENDING_REVIEW": []string{
			"APPROVED (approve)",
			"REJECTED (reject)",
			"CANCELLED (cancel)",
		},
		"APPROVED": []string{
			"PROCESSING (start)",
			"CANCELLED (cancel)",
		},
		"PROCESSING": []string{
			"COMPLETED (complete)",
			"FAILED (fail)",
			"CANCELLED (cancel)",
		},
		"COMPLETED": []string{},
		"FAILED":    []string{"DRAFT (manual correction)"},
		"REJECTED":  []string{},
		"CANCELLED": []string{},
	})
}
