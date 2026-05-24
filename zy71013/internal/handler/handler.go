package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"lab-reagent-api/internal/model"
	"lab-reagent-api/internal/service"
)

type Handler struct {
	reagentService *service.ReagentService
	orderService   *service.OrderService
	reportService  *service.ReportService
}

func NewHandler(reagentService *service.ReagentService, orderService *service.OrderService, reportService *service.ReportService) *Handler {
	return &Handler{
		reagentService: reagentService,
		orderService:   orderService,
		reportService:  reportService,
	}
}

func (h *Handler) ThawReagent(c *gin.Context) {
	var req model.ThawRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "请求参数错误",
			Details: err.Error(),
		})
		return
	}

	reagent, apiErr := h.reagentService.ThawReagent(&req)
	if apiErr != nil {
		status := http.StatusBadRequest
		switch apiErr.Code {
		case model.ErrCodeDuplicate:
			status = http.StatusConflict
		case model.ErrCodeDiscarded, model.ErrCodeInvalidStatus:
			status = http.StatusConflict
		}
		c.JSON(status, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    reagent,
	})
}

func (h *Handler) UseReagent(c *gin.Context) {
	var req model.UsageRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "请求参数错误",
			Details: err.Error(),
		})
		return
	}

	record, apiErr := h.reagentService.UseReagent(&req)
	if apiErr != nil {
		status := http.StatusBadRequest
		switch apiErr.Code {
		case model.ErrCodeDuplicate:
			status = http.StatusConflict
		case model.ErrCodeDiscarded, model.ErrCodeInvalidStatus, model.ErrCodeExpired:
			status = http.StatusConflict
		}
		c.JSON(status, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    record,
	})
}

func (h *Handler) DiscardReagent(c *gin.Context) {
	var req model.DiscardRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "请求参数错误",
			Details: err.Error(),
		})
		return
	}

	reagent, apiErr := h.reagentService.DiscardReagent(&req)
	if apiErr != nil {
		status := http.StatusBadRequest
		switch apiErr.Code {
		case model.ErrCodeInvalidStatus:
			status = http.StatusConflict
		}
		c.JSON(status, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    reagent,
	})
}

func (h *Handler) GetReagent(c *gin.Context) {
	batchNo := c.Param("batchNo")
	if batchNo == "" {
		c.JSON(http.StatusBadRequest, model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "缺少批号参数",
		})
		return
	}

	reagent, usageRecords, apiErr := h.reagentService.GetReagent(batchNo)
	if apiErr != nil {
		c.JSON(http.StatusNotFound, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success":       true,
		"reagent":       reagent,
		"usage_records": usageRecords,
	})
}

func (h *Handler) ListReagents(c *gin.Context) {
	reagents, apiErr := h.reagentService.ListReagents()
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    reagents,
	})
}

func (h *Handler) GetSharedProjects(c *gin.Context) {
	batchNo := c.Param("batchNo")
	if batchNo == "" {
		c.JSON(http.StatusBadRequest, model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "缺少批号参数",
		})
		return
	}

	projects, apiErr := h.reagentService.GetSharedProjects(batchNo)
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    projects,
	})
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var req struct {
		RequestID   string `json:"request_id" binding:"required"`
		BatchNo     string `json:"batch_no" binding:"required"`
		Type        string `json:"type" binding:"required"`
		CreatedBy   string `json:"created_by" binding:"required"`
		NeedsReview bool   `json:"needs_review"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "请求参数错误",
			Details: err.Error(),
		})
		return
	}

	order, apiErr := h.orderService.CreateOrder(req.Type, req.BatchNo, req.CreatedBy, req.RequestID, req.NeedsReview)
	if apiErr != nil {
		status := http.StatusBadRequest
		if apiErr.Code == model.ErrCodeDuplicate {
			status = http.StatusConflict
		}
		c.JSON(status, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    order,
	})
}

func (h *Handler) ProcessJudgment(c *gin.Context) {
	var req model.JudgmentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "请求参数错误",
			Details: err.Error(),
		})
		return
	}

	order, apiErr := h.orderService.ProcessJudgment(&req)
	if apiErr != nil {
		status := http.StatusBadRequest
		if apiErr.Code == model.ErrCodeInvalidStatus {
			status = http.StatusConflict
		}
		c.JSON(status, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    order,
	})
}

func (h *Handler) ProcessSupplement(c *gin.Context) {
	var req model.SupplementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "请求参数错误",
			Details: err.Error(),
		})
		return
	}

	order, apiErr := h.orderService.ProcessSupplement(&req)
	if apiErr != nil {
		status := http.StatusBadRequest
		if apiErr.Code == model.ErrCodeInvalidStatus {
			status = http.StatusConflict
		}
		c.JSON(status, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    order,
	})
}

func (h *Handler) GetOrder(c *gin.Context) {
	orderNo := c.Param("orderNo")
	if orderNo == "" {
		c.JSON(http.StatusBadRequest, model.APIError{
			Code:    model.ErrCodeMissingMaterial,
			Message: "缺少处理单号参数",
		})
		return
	}

	order, apiErr := h.orderService.GetOrder(orderNo)
	if apiErr != nil {
		c.JSON(http.StatusNotFound, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    order,
	})
}

func (h *Handler) ListOrders(c *gin.Context) {
	orders, apiErr := h.orderService.ListOrders()
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, apiErr)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"data":    orders,
	})
}

func (h *Handler) ExportReportJSON(c *gin.Context) {
	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=reagent_report.json")

	apiErr := h.reportService.ExportJSON(c.Writer)
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, apiErr)
		return
	}
}

func (h *Handler) ExportReportCSV(c *gin.Context) {
	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=reagent_report.csv")

	apiErr := h.reportService.ExportCSV(c.Writer)
	if apiErr != nil {
		c.JSON(http.StatusBadRequest, apiErr)
		return
	}
}
