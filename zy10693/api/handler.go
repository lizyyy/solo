package api

import (
	"fmt"
	"grayscale-pause-recovery/models"
	"grayscale-pause-recovery/storage"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	store storage.Storage
}

func NewHandler(store storage.Storage) *Handler {
	return &Handler{store: store}
}

func RegisterRoutes(r *gin.Engine, h *Handler) {
	batch := r.Group("/api/v1/batch")
	{
		batch.POST("/create", h.CreateBatch)
		batch.POST("/pause", h.PauseBatch)
		batch.POST("/resume", h.ResumeBatch)
		batch.POST("/rollback", h.RollbackBatch)
		batch.POST("/machine-progress", h.UpdateMachineProgress)
		batch.GET("/:app_name/:batch_no", h.GetBatch)
		batch.GET("/:app_name", h.ListBatches)
	}
}

func (h *Handler) CreateBatch(c *gin.Context) {
	var req struct {
		AppName  string   `json:"app_name" binding:"required"`
		BatchNo  int      `json:"batch_no" binding:"required,min=1"`
		Machines []string `json:"machines" binding:"required,min=1"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.BatchResponse{
			Success: false,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	batch := models.NewBatch(req.AppName, req.BatchNo, req.Machines)
	if err := h.store.CreateBatch(batch); err != nil {
		c.JSON(http.StatusConflict, models.BatchResponse{
			Success: false,
			Message: "Failed to create batch: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.BatchResponse{
		Success: true,
		Message: "Batch created successfully",
		Data:    batch,
	})
}

func (h *Handler) PauseBatch(c *gin.Context) {
	var req models.PauseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.BatchResponse{
			Success: false,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	batch, err := h.store.GetBatch(req.AppName, req.BatchNo)
	if err != nil {
		c.JSON(http.StatusNotFound, models.BatchResponse{
			Success: false,
			Message: "Batch not found",
		})
		return
	}

	if !batch.CanPause() {
		c.JSON(http.StatusBadRequest, models.BatchResponse{
			Success: false,
			Message: "Cannot pause batch in current status: " + string(batch.Status),
			Data:    batch,
		})
		return
	}

	now := time.Now()
	batch.Status = models.BatchStatusPaused
	batch.PauseReason = req.PauseReason
	batch.ResumeCondition = req.ResumeCondition
	batch.PausedAt = &now

	if err := h.store.UpdateBatch(batch); err != nil {
		c.JSON(http.StatusInternalServerError, models.BatchResponse{
			Success: false,
			Message: "Failed to pause batch: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.BatchResponse{
		Success: true,
		Message: "Batch paused successfully",
		Data:    batch,
	})
}

func (h *Handler) ResumeBatch(c *gin.Context) {
	var req models.ResumeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.BatchResponse{
			Success: false,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	batch, err := h.store.GetBatch(req.AppName, req.BatchNo)
	if err != nil {
		c.JSON(http.StatusNotFound, models.BatchResponse{
			Success: false,
			Message: "Batch not found",
		})
		return
	}

	if !batch.CanResume() {
		c.JSON(http.StatusBadRequest, models.BatchResponse{
			Success: false,
			Message: "Cannot resume batch in current status: " + string(batch.Status),
			Data:    batch,
		})
		return
	}

	if batch.Status == models.BatchStatusFrozen {
		c.JSON(http.StatusConflict, models.BatchResponse{
			Success: false,
			Message: "Batch is frozen due to conflict: " + batch.ConflictReason,
			Data:    batch,
		})
		return
	}

	now := time.Now()
	batch.Status = models.BatchStatusResumed
	batch.ResumedAt = &now

	if err := h.store.UpdateBatch(batch); err != nil {
		c.JSON(http.StatusInternalServerError, models.BatchResponse{
			Success: false,
			Message: "Failed to resume batch: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.BatchResponse{
		Success: true,
		Message: "Batch resumed successfully",
		Data:    batch,
	})
}

func (h *Handler) RollbackBatch(c *gin.Context) {
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.BatchResponse{
			Success: false,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	batch, err := h.store.GetBatch(req.AppName, req.BatchNo)
	if err != nil {
		c.JSON(http.StatusNotFound, models.BatchResponse{
			Success: false,
			Message: "Batch not found",
		})
		return
	}

	if !batch.CanRollback() {
		c.JSON(http.StatusBadRequest, models.BatchResponse{
			Success: false,
			Message: "Cannot rollback batch in current status: " + string(batch.Status),
			Data:    batch,
		})
		return
	}

	batch.Status = models.BatchStatusRollback

	if err := h.store.UpdateBatch(batch); err != nil {
		c.JSON(http.StatusInternalServerError, models.BatchResponse{
			Success: false,
			Message: "Failed to rollback batch: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.BatchResponse{
		Success: true,
		Message: "Batch rollback initiated",
		Data:    batch,
	})
}

func (h *Handler) UpdateMachineProgress(c *gin.Context) {
	var req models.MachineProgressRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.BatchResponse{
			Success: false,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	batch, err := h.store.GetBatch(req.AppName, req.BatchNo)
	if err != nil {
		c.JSON(http.StatusNotFound, models.BatchResponse{
			Success: false,
			Message: "Batch not found",
		})
		return
	}

	if batch.IsPausedOrFrozen() && batch.Status != models.BatchStatusResumed {
		now := time.Now()
		batch.Status = models.BatchStatusFrozen
		batch.FrozenAt = &now
		batch.ConflictReason = string(models.ConflictReasonMachineProgress)

		if err := h.store.UpdateBatch(batch); err != nil {
			c.JSON(http.StatusInternalServerError, models.BatchResponse{
				Success: false,
				Message: "Failed to freeze batch: " + err.Error(),
			})
			return
		}

		c.JSON(http.StatusConflict, models.BatchResponse{
			Success: false,
			Message: "Batch is paused/frozen, machine progress update not allowed. Batch has been frozen.",
			Data:    batch,
		})
		return
	}

	machineFound := false
	now := time.Now()
	for i := range batch.Machines {
		if batch.Machines[i].Hostname == req.Hostname {
			machineFound = true
			batch.Machines[i].Progress = req.Progress
			
			if batch.Machines[i].Status == models.MachineStatusPending && req.Progress > 0 {
				batch.Machines[i].StartedAt = &now
				batch.Machines[i].Status = models.MachineStatusRunning
			}
			
			if req.Completed {
				batch.Machines[i].Status = models.MachineStatusSuccess
				batch.Machines[i].FinishedAt = &now
				batch.Machines[i].Progress = 100
			} else if req.Failed {
				batch.Machines[i].Status = models.MachineStatusFailed
				batch.Machines[i].FinishedAt = &now
			}
			break
		}
	}

	if !machineFound {
		c.JSON(http.StatusNotFound, models.BatchResponse{
			Success: false,
			Message: "Machine not found in batch",
		})
		return
	}

	if err := h.store.UpdateBatch(batch); err != nil {
		c.JSON(http.StatusInternalServerError, models.BatchResponse{
			Success: false,
			Message: "Failed to update machine progress: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.BatchResponse{
		Success: true,
		Message: "Machine progress updated successfully",
		Data:    batch,
	})
}

func (h *Handler) GetBatch(c *gin.Context) {
	appName := c.Param("app_name")
	batchNoStr := c.Param("batch_no")
	
	var batchNo int
	if _, err := fmt.Sscanf(batchNoStr, "%d", &batchNo); err != nil {
		c.JSON(http.StatusBadRequest, models.BatchResponse{
			Success: false,
			Message: "Invalid batch number",
		})
		return
	}

	batch, err := h.store.GetBatch(appName, batchNo)
	if err != nil {
		c.JSON(http.StatusNotFound, models.BatchResponse{
			Success: false,
			Message: "Batch not found",
		})
		return
	}

	c.JSON(http.StatusOK, models.BatchResponse{
		Success: true,
		Data:    batch,
	})
}

func (h *Handler) ListBatches(c *gin.Context) {
	appName := c.Param("app_name")
	
	batches, err := h.store.ListBatches(appName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.BatchResponse{
			Success: false,
			Message: "Failed to list batches: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    batches,
	})
}
