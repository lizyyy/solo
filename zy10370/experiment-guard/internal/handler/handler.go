package handler

import (
	"experiment-guard/internal/service"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *service.ExperimentService
}

func NewHandler(svc *service.ExperimentService) *Handler {
	return &Handler{service: svc}
}

type ErrorResponse struct {
	Error string `json:"error"`
}

func (h *Handler) CreateExperiment(c *gin.Context) {
	var req service.CreateExperimentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	exp, err := h.service.CreateExperiment(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusCreated, exp)
}

func (h *Handler) StartExperiment(c *gin.Context) {
	experimentID := c.Param("id")

	exp, err := h.service.StartExperiment(experimentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, exp)
}

func (h *Handler) CheckBucket(c *gin.Context) {
	experimentID := c.Param("id")
	userID := c.Query("user_id")

	if userID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: "user_id is required"})
		return
	}

	inBucket, err := h.service.CheckBucket(experimentID, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"in_experiment": inBucket,
	})
}

func (h *Handler) RecordMetric(c *gin.Context) {
	experimentID := c.Param("id")

	var req service.RecordMetricRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	resp, err := h.service.RecordMetric(experimentID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) CheckPaused(c *gin.Context) {
	experimentID := c.Param("id")

	paused, reason, err := h.service.CheckPaused(experimentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"paused": paused,
		"reason": reason,
	})
}

func (h *Handler) ConfirmRollback(c *gin.Context) {
	experimentID := c.Param("id")

	var req service.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Error: err.Error()})
		return
	}

	exp, err := h.service.ConfirmRollback(experimentID, &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, exp)
}

func (h *Handler) ResumeExperiment(c *gin.Context) {
	experimentID := c.Param("id")

	exp, err := h.service.ResumeExperiment(experimentID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, exp)
}

func (h *Handler) GetExperiment(c *gin.Context) {
	experimentID := c.Param("id")

	exp, err := h.service.GetExperiment(experimentID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{Error: "Experiment not found"})
		return
	}

	c.JSON(http.StatusOK, exp)
}

func (h *Handler) ListExperiments(c *gin.Context) {
	exps, err := h.service.ListExperiments()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, exps)
}

func (h *Handler) ExportObservations(c *gin.Context) {
	experimentID := c.Param("id")

	var startTime, endTime time.Time
	var err error

	if startStr := c.Query("start_time"); startStr != "" {
		startTime, err = time.Parse(time.RFC3339, startStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid start_time format"})
			return
		}
	}

	if endStr := c.Query("end_time"); endStr != "" {
		endTime, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, ErrorResponse{Error: "Invalid end_time format"})
			return
		}
	}

	result, err := h.service.ExportObservations(experimentID, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{Error: err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func SetupRoutes(r *gin.Engine, h *Handler) {
	api := r.Group("/api/v1")
	{
		experiments := api.Group("/experiments")
		{
			experiments.POST("", h.CreateExperiment)
			experiments.GET("", h.ListExperiments)
			experiments.GET("/:id", h.GetExperiment)
			experiments.POST("/:id/start", h.StartExperiment)
			experiments.GET("/:id/bucket", h.CheckBucket)
			experiments.POST("/:id/metrics", h.RecordMetric)
			experiments.GET("/:id/paused", h.CheckPaused)
			experiments.POST("/:id/rollback", h.ConfirmRollback)
			experiments.POST("/:id/resume", h.ResumeExperiment)
			experiments.GET("/:id/export", h.ExportObservations)
		}
	}
}
