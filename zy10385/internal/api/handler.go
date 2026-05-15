package api

import (
	"net/http"

	"github.com/gin-gonic/gin"

	"api-admission-check/internal/model"
	"api-admission-check/internal/service"
)

type Handler struct {
	service *service.AdmissionService
}

func NewHandler(s *service.AdmissionService) *Handler {
	return &Handler{service: s}
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func (h *Handler) CreateApplication(c *gin.Context) {
	var req model.CreateApplicationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	app, err := h.service.CreateApplication(&req)
	if err != nil {
		switch err {
		case model.ErrInvalidData:
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		case model.ErrDuplicateSubmission:
			c.JSON(http.StatusConflict, ErrorResponse{Error: err.Error()})
		default:
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		}
		return
	}

	c.JSON(http.StatusCreated, app)
}

func (h *Handler) GetApplication(c *gin.Context) {
	id := c.Param("id")
	app, err := h.service.GetApplication(id)
	if err != nil {
		if err == model.ErrApplicationNotFound {
			c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		}
		return
	}
	c.JSON(http.StatusOK, app)
}

func (h *Handler) ListApplications(c *gin.Context) {
	apps, err := h.service.ListApplications()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}
	c.JSON(http.StatusOK, apps)
}

type StateRequest struct {
	Operator string `json:"operator" binding:"required"`
}

func (h *Handler) SubmitForReview(c *gin.Context) {
	id := c.Param("id")
	var req StateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	app, err := h.service.SubmitForReview(id, req.Operator)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, app)
}

func (h *Handler) StartChecking(c *gin.Context) {
	id := c.Param("id")
	var req StateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	app, err := h.service.StartChecking(id, req.Operator)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, app)
}

type RegisterDependencyRequest struct {
	DependencyID string `json:"dependency_id" binding:"required"`
	Operator     string `json:"operator" binding:"required"`
}

func (h *Handler) RegisterDependency(c *gin.Context) {
	id := c.Param("id")
	var req RegisterDependencyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	result, err := h.service.RegisterDependency(id, req.DependencyID, req.Operator)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) CheckPermissions(c *gin.Context) {
	id := c.Param("id")
	var req model.PermissionCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	result, err := h.service.CheckPermissions(id, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) CheckQuota(c *gin.Context) {
	id := c.Param("id")
	var req model.QuotaCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	result, err := h.service.CheckQuota(id, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) CheckAlerts(c *gin.Context) {
	id := c.Param("id")
	var req model.AlertCheckRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	result, err := h.service.CheckAlerts(id, &req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, result)
}

func (h *Handler) ApproveApplication(c *gin.Context) {
	id := c.Param("id")
	var req StateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	app, err := h.service.ApproveApplication(id, req.Operator)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, app)
}

type RejectRequest struct {
	Operator string `json:"operator" binding:"required"`
	Reason   string `json:"reason" binding:"required"`
}

func (h *Handler) RejectApplication(c *gin.Context) {
	id := c.Param("id")
	var req RejectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	app, err := h.service.RejectApplication(id, req.Operator, req.Reason)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, app)
}

func (h *Handler) CancelApplication(c *gin.Context) {
	id := c.Param("id")
	var req StateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	app, err := h.service.CancelApplication(id, req.Operator)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, app)
}

func (h *Handler) GetHistory(c *gin.Context) {
	id := c.Param("id")
	records, err := h.service.GetHistory(id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, records)
}

func (h *Handler) handleError(c *gin.Context, err error) {
	switch err {
	case model.ErrApplicationNotFound:
		c.JSON(http.StatusNotFound, ErrorResponse{Error: err.Error()})
	case model.ErrInvalidStateTransition:
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
	case model.ErrVersionConflict:
		c.JSON(http.StatusConflict, ErrorResponse{Error: err.Error()})
	case model.ErrCheckIncomplete:
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
	default:
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
	}
}

func SetupRouter(handler *Handler) *gin.Engine {
	r := gin.Default()

	api := r.Group("/api/v1")
	{
		apps := api.Group("/applications")
		{
			apps.POST("", handler.CreateApplication)
			apps.GET("", handler.ListApplications)
			apps.GET("/:id", handler.GetApplication)
			apps.POST("/:id/submit", handler.SubmitForReview)
			apps.POST("/:id/start-checking", handler.StartChecking)
			apps.POST("/:id/register-dependency", handler.RegisterDependency)
			apps.POST("/:id/check-permissions", handler.CheckPermissions)
			apps.POST("/:id/check-quota", handler.CheckQuota)
			apps.POST("/:id/check-alerts", handler.CheckAlerts)
			apps.POST("/:id/approve", handler.ApproveApplication)
			apps.POST("/:id/reject", handler.RejectApplication)
			apps.POST("/:id/cancel", handler.CancelApplication)
			apps.GET("/:id/history", handler.GetHistory)
		}
	}

	return r
}
