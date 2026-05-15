package api

import (
	"api-status-aggregator/models"
	"api-status-aggregator/service"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	service *service.Service
	logger  *zap.Logger
}

func NewHandler(service *service.Service, logger *zap.Logger) *Handler {
	return &Handler{
		service: service,
		logger:  logger,
	}
}

func (h *Handler) SetupRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		subscriptions := api.Group("/subscriptions")
		{
			subscriptions.POST("", h.CreateSubscription)
			subscriptions.GET("/:id", h.GetSubscription)
			subscriptions.GET("/:id/snapshots", h.GetSnapshots)
		}

		status := api.Group("/status")
		{
			status.POST("/change", h.ProcessStatusChange)
			status.POST("/history", h.QueryHistory)
		}

		health := api.Group("/health")
		{
			health.GET("", h.HealthCheck)
		}
	}
}

func (h *Handler) CreateSubscription(c *gin.Context) {
	var req models.CreateSubscriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Warn("invalid request", zap.Error(err))
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Code:    400,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	sub, err := h.service.CreateSubscription(&req)
	if err != nil {
		h.logger.Error("create subscription failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Code:    500,
			Message: "Internal server error: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    200,
		Message: "Success",
		Data:    sub,
	})
}

func (h *Handler) GetSubscription(c *gin.Context) {
	subID := c.Param("id")
	if subID == "" {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Code:    400,
			Message: "Subscription ID is required",
		})
		return
	}

	sub, pref, err := h.service.GetSubscription(subID)
	if err != nil {
		h.logger.Error("get subscription failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Code:    500,
			Message: "Internal server error: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    200,
		Message: "Success",
		Data: gin.H{
			"subscription":        sub,
			"delivery_preference": pref,
		},
	})
}

func (h *Handler) GetSnapshots(c *gin.Context) {
	subID := c.Param("id")
	if subID == "" {
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Code:    400,
			Message: "Subscription ID is required",
		})
		return
	}

	snapshots, err := h.service.GetSnapshots(subID, 20)
	if err != nil {
		h.logger.Error("get snapshots failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Code:    500,
			Message: "Internal server error: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    200,
		Message: "Success",
		Data:    snapshots,
	})
}

func (h *Handler) ProcessStatusChange(c *gin.Context) {
	var req models.StatusChangeRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Warn("invalid request", zap.Error(err))
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Code:    400,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	change, err := h.service.ProcessStatusChange(&req)
	if err != nil {
		h.logger.Error("process status change failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Code:    500,
			Message: "Internal server error: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    200,
		Message: "Success",
		Data:    change,
	})
}

func (h *Handler) QueryHistory(c *gin.Context) {
	var req models.QueryHistoryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.logger.Warn("invalid request", zap.Error(err))
		c.JSON(http.StatusBadRequest, models.ApiResponse{
			Code:    400,
			Message: "Invalid request: " + err.Error(),
		})
		return
	}

	result, err := h.service.QueryHistory(&req)
	if err != nil {
		h.logger.Error("query history failed", zap.Error(err))
		c.JSON(http.StatusInternalServerError, models.ApiResponse{
			Code:    500,
			Message: "Internal server error: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    200,
		Message: "Success",
		Data:    result,
	})
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    200,
		Message: "API Status Subscription Aggregator is running",
	})
}
