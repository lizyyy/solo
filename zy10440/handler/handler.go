package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gpu-queue-api/models"
	"gpu-queue-api/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	queueService *service.QueueService
}

func NewHandler(queueService *service.QueueService) *Handler {
	return &Handler{queueService: queueService}
}

func (h *Handler) respondSuccess(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func (h *Handler) respondError(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    code,
		Message: message,
	})
}

func (h *Handler) CreateJob(c *gin.Context) {
	var req models.CreateJobRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		rawInput, _ := json.Marshal(c.Request.Body)
		h.queueService.LogException(req.RequestID, "CreateJob", string(rawInput), "ValidationError", err.Error(), "请求参数验证失败")
		h.respondError(c, 400, "Invalid request: "+err.Error())
		return
	}

	rawInput, _ := json.Marshal(req)
	job, err := h.queueService.CreateJob(&req)
	if err != nil {
		h.queueService.LogException(req.RequestID, "CreateJob", string(rawInput), "ServiceError", err.Error(), "作业创建失败")
		h.respondError(c, 500, err.Error())
		return
	}

	h.respondSuccess(c, job)
}

func (h *Handler) GetJob(c *gin.Context) {
	id := c.Param("id")
	job, err := h.queueService.GetJob(id)
	if err != nil {
		h.respondError(c, 404, "Job not found")
		return
	}
	h.respondSuccess(c, job)
}

func (h *Handler) ListJobs(c *gin.Context) {
	status := c.Query("status")
	gpuModel := c.Query("gpu_model")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	result, err := h.queueService.ListJobs(status, gpuModel, offset, limit)
	if err != nil {
		h.respondError(c, 500, err.Error())
		return
	}
	h.respondSuccess(c, result)
}

func (h *Handler) UpdateJobStatus(c *gin.Context) {
	jobID := c.Param("id")
	var req models.UpdateJobStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, 400, "Invalid request: "+err.Error())
		return
	}

	job, err := h.queueService.UpdateJobStatus(jobID, &req)
	if err != nil {
		h.respondError(c, 500, err.Error())
		return
	}
	h.respondSuccess(c, job)
}

func (h *Handler) ManualCorrection(c *gin.Context) {
	var req models.ManualCorrectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.respondError(c, 400, "Invalid request: "+err.Error())
		return
	}

	resources, err := h.queueService.ManualCorrection(&req)
	if err != nil {
		h.respondError(c, 500, err.Error())
		return
	}
	h.respondSuccess(c, resources)
}

func (h *Handler) GetQueueSummary(c *gin.Context) {
	summary, err := h.queueService.GetQueueSummary()
	if err != nil {
		h.respondError(c, 500, err.Error())
		return
	}
	h.respondSuccess(c, summary)
}

func (h *Handler) GetGPUResources(c *gin.Context) {
	resources, err := h.queueService.GetGPUResources()
	if err != nil {
		h.respondError(c, 500, err.Error())
		return
	}
	h.respondSuccess(c, resources)
}

func (h *Handler) GetExceptionLogs(c *gin.Context) {
	requestID := c.Query("request_id")
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	result, err := h.queueService.GetExceptionLogs(requestID, offset, limit)
	if err != nil {
		h.respondError(c, 500, err.Error())
		return
	}
	h.respondSuccess(c, result)
}

func (h *Handler) GetReleaseEvents(c *gin.Context) {
	jobID := c.Query("job_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))

	events, err := h.queueService.GetReleaseEvents(jobID, limit)
	if err != nil {
		h.respondError(c, 500, err.Error())
		return
	}
	h.respondSuccess(c, events)
}

func (h *Handler) ExportReport(c *gin.Context) {
	format := c.DefaultQuery("format", "json")
	report, err := h.queueService.ExportQueueReport()
	if err != nil {
		h.respondError(c, 500, err.Error())
		return
	}

	if strings.ToLower(format) == "json" {
		c.Header("Content-Type", "application/json")
		c.Header("Content-Disposition", "attachment; filename=queue_report.json")
		c.JSON(http.StatusOK, report)
	} else {
		h.respondSuccess(c, report)
	}
}

func (h *Handler) HealthCheck(c *gin.Context) {
	h.respondSuccess(c, gin.H{"status": "ok"})
}
