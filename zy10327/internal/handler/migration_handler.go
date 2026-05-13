package handler

import (
	"tenant-migration-api/internal/models"
	"tenant-migration-api/internal/service"
	"tenant-migration-api/pkg/logger"
	"net/http"

	"github.com/gin-gonic/gin"
)

type MigrationHandler struct {
	migrationService service.MigrationService
}

func NewMigrationHandler(migrationService service.MigrationService) *MigrationHandler {
	return &MigrationHandler{
		migrationService: migrationService,
	}
}

func (h *MigrationHandler) CreateMigration(c *gin.Context) {
	var req models.CreateMigrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		logger.Errorf("Invalid request: %v", err)
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    string(models.ErrInvalidRequest),
			Message: "请求参数错误",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := h.migrationService.CreateMigration(&req)
	if err != nil {
		if businessErr, ok := err.(*models.BusinessError); ok {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    string(businessErr.Code),
				Message: businessErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    string(models.ErrInternalError),
			Message: "内部服务器错误",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *MigrationHandler) ValidateMigration(c *gin.Context) {
	var req models.ValidateMigrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    string(models.ErrInvalidRequest),
			Message: "请求参数错误",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := h.migrationService.ValidateMigration(&req)
	if err != nil {
		if businessErr, ok := err.(*models.BusinessError); ok {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    string(businessErr.Code),
				Message: businessErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    string(models.ErrInternalError),
			Message: "内部服务器错误",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *MigrationHandler) AdvanceStatus(c *gin.Context) {
	var req models.AdvanceStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    string(models.ErrInvalidRequest),
			Message: "请求参数错误",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := h.migrationService.AdvanceStatus(&req)
	if err != nil {
		if businessErr, ok := err.(*models.BusinessError); ok {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    string(businessErr.Code),
				Message: businessErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    string(models.ErrInternalError),
			Message: "内部服务器错误",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *MigrationHandler) RollbackMigration(c *gin.Context) {
	var req models.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    string(models.ErrInvalidRequest),
			Message: "请求参数错误",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := h.migrationService.RollbackMigration(&req)
	if err != nil {
		if businessErr, ok := err.(*models.BusinessError); ok {
			c.JSON(http.StatusBadRequest, models.ErrorResponse{
				Code:    string(businessErr.Code),
				Message: businessErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    string(models.ErrInternalError),
			Message: "内部服务器错误",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *MigrationHandler) GetMigrationTask(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    string(models.ErrInvalidRequest),
			Message: "任务ID不能为空",
		})
		return
	}

	resp, err := h.migrationService.GetMigrationTask(taskID)
	if err != nil {
		if businessErr, ok := err.(*models.BusinessError); ok {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Code:    string(businessErr.Code),
				Message: businessErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    string(models.ErrInternalError),
			Message: "内部服务器错误",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *MigrationHandler) ListMigrationTasks(c *gin.Context) {
	var req models.ListMigrationTasksRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		req.TenantID = c.Query("tenant_id")
		req.Status = c.Query("status")
	}

	resp, err := h.migrationService.ListMigrationTasks(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    string(models.ErrInternalError),
			Message: "查询失败",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *MigrationHandler) GetMigrationHistory(c *gin.Context) {
	taskID := c.Param("id")
	if taskID == "" {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{
			Code:    string(models.ErrInvalidRequest),
			Message: "任务ID不能为空",
		})
		return
	}

	resp, err := h.migrationService.GetMigrationHistory(taskID)
	if err != nil {
		if businessErr, ok := err.(*models.BusinessError); ok {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Code:    string(businessErr.Code),
				Message: businessErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    string(models.ErrInternalError),
			Message: "内部服务器错误",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *MigrationHandler) GetValidationReport(c *gin.Context) {
	taskID := c.Param("id")
	reportType := c.DefaultQuery("type", "validation")

	resp, err := h.migrationService.GetValidationReport(taskID, reportType)
	if err != nil {
		if businessErr, ok := err.(*models.BusinessError); ok {
			c.JSON(http.StatusNotFound, models.ErrorResponse{
				Code:    string(businessErr.Code),
				Message: businessErr.Message,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{
			Code:    string(models.ErrInternalError),
			Message: "内部服务器错误",
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *MigrationHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "tenant-migration-api",
		"version": "1.0.0",
	})
}
