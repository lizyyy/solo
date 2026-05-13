package handler

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"

	"api-error-budget-ledger/internal/model"
	"api-error-budget-ledger/internal/service"
	"api-error-budget-ledger/internal/storage"
)

type Handler struct {
	budgetService *service.BudgetService
	exportService *service.ExportService
}

func NewHandler(store storage.Storage) *Handler {
	return &Handler{
		budgetService: service.NewBudgetService(store),
		exportService: service.NewExportService(store),
	}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		budgets := api.Group("/budgets")
		{
			budgets.POST("", h.CreateBudget)
			budgets.GET("/:id", h.GetBudgetStatus)
			budgets.POST("/:id/deduct", h.DeductBudget)
			budgets.GET("/:id/timeline", h.GetTimeline)
			budgets.GET("/:id/export", h.ExportBudget)
		}

		exemptions := api.Group("/exemptions")
		{
			exemptions.POST("", h.CreateExemption)
			exemptions.POST("/review", h.ReviewExemption)
		}

		freezes := api.Group("/freezes")
		{
			freezes.POST("", h.FreezeService)
			freezes.POST("/unfreeze", h.UnfreezeService)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})
}

func (h *Handler) CreateBudget(c *gin.Context) {
	var req model.CreateBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, http.StatusBadRequest, "invalid request", err)
		return
	}

	resp, err := h.budgetService.CreateBudget(&req)
	if err != nil {
		h.handleError(c, http.StatusInternalServerError, "failed to create budget", err)
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) GetBudgetStatus(c *gin.Context) {
	budgetID := c.Param("id")
	if budgetID == "" {
		h.handleError(c, http.StatusBadRequest, "budget id is required", nil)
		return
	}

	resp, err := h.budgetService.GetBudgetStatus(budgetID)
	if err != nil {
		if err == storage.ErrNotFound {
			h.handleError(c, http.StatusNotFound, "budget not found", err)
			return
		}
		h.handleError(c, http.StatusInternalServerError, "failed to get budget status", err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) DeductBudget(c *gin.Context) {
	var req model.DeductBudgetRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, http.StatusBadRequest, "invalid request", err)
		return
	}

	req.BudgetID = c.Param("id")
	if req.BudgetID == "" {
		h.handleError(c, http.StatusBadRequest, "budget id is required", nil)
		return
	}

	resp, err := h.budgetService.DeductBudget(&req)
	if err != nil {
		switch err {
		case storage.ErrNotFound:
			h.handleError(c, http.StatusNotFound, "budget not found", err)
		case service.ErrBudgetFrozen:
			c.JSON(http.StatusConflict, resp)
		case service.ErrBudgetExhausted:
			c.JSON(http.StatusConflict, resp)
		case service.ErrDuplicateRequest:
			c.JSON(http.StatusOK, resp)
		default:
			h.handleError(c, http.StatusInternalServerError, "failed to deduct budget", err)
		}
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetTimeline(c *gin.Context) {
	budgetID := c.Param("id")
	if budgetID == "" {
		h.handleError(c, http.StatusBadRequest, "budget id is required", nil)
		return
	}

	limit := 100
	offset := 0
	if l := c.Query("limit"); l != "" {
		if parsed, err := strconv.Atoi(l); err == nil {
			limit = parsed
		}
	}
	if o := c.Query("offset"); o != "" {
		if parsed, err := strconv.Atoi(o); err == nil {
			offset = parsed
		}
	}

	resp, err := h.budgetService.GetTimeline(budgetID, limit, offset)
	if err != nil {
		h.handleError(c, http.StatusInternalServerError, "failed to get timeline", err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) ExportBudget(c *gin.Context) {
	budgetID := c.Param("id")
	if budgetID == "" {
		h.handleError(c, http.StatusBadRequest, "budget id is required", nil)
		return
	}

	format := c.Query("format")
	if format == "" {
		format = "json"
	}

	resp, err := h.exportService.ExportBudget(budgetID, nil, nil)
	if err != nil {
		if err == storage.ErrNotFound {
			h.handleError(c, http.StatusNotFound, "budget not found", err)
			return
		}
		h.handleError(c, http.StatusInternalServerError, "failed to export budget", err)
		return
	}

	switch format {
	case "json":
		c.JSON(http.StatusOK, resp)
	default:
		c.JSON(http.StatusOK, resp)
	}
}

func (h *Handler) CreateExemption(c *gin.Context) {
	var req model.CreateExemptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, http.StatusBadRequest, "invalid request", err)
		return
	}

	resp, err := h.budgetService.CreateExemption(&req)
	if err != nil {
		if err == storage.ErrNotFound {
			h.handleError(c, http.StatusNotFound, "budget or deduct event not found", err)
			return
		}
		h.handleError(c, http.StatusInternalServerError, "failed to create exemption", err)
		return
	}

	c.JSON(http.StatusCreated, resp)
}

func (h *Handler) ReviewExemption(c *gin.Context) {
	var req model.ReviewExemptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, http.StatusBadRequest, "invalid request", err)
		return
	}

	resp, err := h.budgetService.ReviewExemption(&req)
	if err != nil {
		if err == storage.ErrNotFound {
			h.handleError(c, http.StatusNotFound, "exemption not found", err)
			return
		}
		if err == service.ErrInvalidState {
			h.handleError(c, http.StatusConflict, "invalid exemption state", err)
			return
		}
		h.handleError(c, http.StatusInternalServerError, "failed to review exemption", err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) FreezeService(c *gin.Context) {
	var req model.FreezeServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, http.StatusBadRequest, "invalid request", err)
		return
	}

	resp, err := h.budgetService.FreezeService(&req)
	if err != nil {
		if err == storage.ErrNotFound {
			h.handleError(c, http.StatusNotFound, "budget not found", err)
			return
		}
		if err == storage.ErrAlreadyExists {
			h.handleError(c, http.StatusConflict, "service already frozen", err)
			return
		}
		h.handleError(c, http.StatusInternalServerError, "failed to freeze service", err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) UnfreezeService(c *gin.Context) {
	var req model.UnfreezeServiceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, http.StatusBadRequest, "invalid request", err)
		return
	}

	resp, err := h.budgetService.UnfreezeService(&req)
	if err != nil {
		if err == storage.ErrNotFound {
			h.handleError(c, http.StatusNotFound, "budget or active freeze not found", err)
			return
		}
		h.handleError(c, http.StatusInternalServerError, "failed to unfreeze service", err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) handleError(c *gin.Context, code int, message string, err error) {
	details := ""
	if err != nil {
		details = err.Error()
	}
	c.JSON(code, model.ErrorResponse{
		Code:    code,
		Message: message,
		Details: details,
	})
}
