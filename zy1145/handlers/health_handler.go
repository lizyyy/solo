package handlers

import (
	"btc-recharge-service/models"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type HealthHandler struct {
}

func NewHealthHandler() *HealthHandler {
	return &HealthHandler{}
}

type HealthResponse struct {
	Code      string `json:"code"`
	Message   string `json:"message"`
	Status    string `json:"status"`
	Timestamp string `json:"timestamp"`
	Version   string `json:"version"`
}

type ReadinessResponse struct {
	Code      string            `json:"code"`
	Message   string            `json:"message"`
	Status    string            `json:"status"`
	Timestamp string            `json:"timestamp"`
	Checks    map[string]string `json:"checks,omitempty"`
}

func (h *HealthHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{
		Code:      models.Success.Code,
		Message:   models.Success.Message,
		Status:    "healthy",
		Timestamp: time.Now().Format(time.RFC3339),
		Version:   "1.0.0",
	})
}

func (h *HealthHandler) ReadinessCheck(c *gin.Context) {
	checks := map[string]string{
		"database": "ready",
		"api":      "ready",
	}

	c.JSON(http.StatusOK, ReadinessResponse{
		Code:      models.Success.Code,
		Message:   models.Success.Message,
		Status:    "ready",
		Timestamp: time.Now().Format(time.RFC3339),
		Checks:    checks,
	})
}
