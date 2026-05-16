package handler

import (
	"consumer-ownership-api/internal/model"
	"consumer-ownership-api/internal/service"
	"consumer-ownership-api/pkg/database"
	"io"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type ConsumerHandler struct {
	service *service.ConsumerService
}

func NewConsumerHandler() *ConsumerHandler {
	return &ConsumerHandler{
		service: service.NewConsumerService(),
	}
}

func successResponse(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func errorResponse(c *gin.Context, code int, message string) {
	c.JSON(code, model.Response{
		Code:    code,
		Message: message,
	})
}

func (h *ConsumerHandler) errorMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		body, _ := io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(io.MultiReader(io.NopCloser(&errorRecorder{body: body}), c.Request.Body))

		c.Next()

		if len(c.Errors) > 0 {
			err := c.Errors.Last()
			rawInput := string(body)
			database.RecordError(
				c.Request.URL.Path,
				c.Request.Method,
				rawInput,
				err.Error(),
				"",
			)
		}
	}
}

type errorRecorder struct {
	body []byte
}

func (r *errorRecorder) Read(p []byte) (n int, err error) {
	return 0, io.EOF
}

func (h *ConsumerHandler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	api.Use(h.errorMiddleware())
	{
		consumers := api.Group("/consumers")
		{
			consumers.POST("", h.RegisterConsumer)
			consumers.GET("", h.QueryConsumers)
			consumers.GET("/:id", h.GetConsumer)
			consumers.PUT("/status", h.UpdateStatus)
			consumers.POST("/transfer", h.TransferOwner)
			consumers.POST("/manual-fix", h.ManualFix)
			consumers.GET("/:id/transfers", h.GetTransferRecords)
		}

		reports := api.Group("/reports")
		{
			reports.POST("", h.GenerateReport)
			reports.GET("", h.GetReports)
		}

		exports := api.Group("/exports")
		{
			exports.GET("/csv", h.ExportCSV)
		}

		errors := api.Group("/errors")
		{
			errors.GET("", h.GetErrorRecords)
			errors.POST("/resolve", h.ResolveError)
		}
	}
}

func (h *ConsumerHandler) RegisterConsumer(c *gin.Context) {
	var req model.RegisterConsumerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	consumer, err := h.service.RegisterConsumer(&req)
	if err != nil {
		c.Error(err)
		errorResponse(c, http.StatusConflict, err.Error())
		return
	}

	successResponse(c, consumer)
}

func (h *ConsumerHandler) QueryConsumers(c *gin.Context) {
	var req model.QueryConsumerRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	consumers, total, err := h.service.QueryConsumers(&req)
	if err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	successResponse(c, gin.H{
		"list":  consumers,
		"total": total,
		"page":  req.Page,
		"size":  req.PageSize,
	})
}

func (h *ConsumerHandler) GetConsumer(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.Error(err)
		errorResponse(c, http.StatusBadRequest, "无效的ID")
		return
	}

	consumer, err := h.service.GetConsumerByID(uint(id))
	if err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	if consumer == nil {
		errorResponse(c, http.StatusNotFound, "消费者不存在")
		return
	}

	successResponse(c, consumer)
}

func (h *ConsumerHandler) UpdateStatus(c *gin.Context) {
	var req model.UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	if err := h.service.UpdateStatus(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	successResponse(c, nil)
}

func (h *ConsumerHandler) TransferOwner(c *gin.Context) {
	var req model.TransferOwnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	if err := h.service.TransferOwner(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	successResponse(c, nil)
}

func (h *ConsumerHandler) ManualFix(c *gin.Context) {
	var req model.ManualFixRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	if err := h.service.ManualFix(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	successResponse(c, nil)
}

func (h *ConsumerHandler) GetTransferRecords(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.Error(err)
		errorResponse(c, http.StatusBadRequest, "无效的ID")
		return
	}

	records, err := h.service.GetTransferRecords(uint(id))
	if err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	successResponse(c, records)
}

func (h *ConsumerHandler) GenerateReport(c *gin.Context) {
	var req model.GenerateReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	report, err := h.service.GenerateReport(&req)
	if err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	successResponse(c, report)
}

func (h *ConsumerHandler) GetReports(c *gin.Context) {
	queueName := c.Query("queue_name")
	limitStr := c.DefaultQuery("limit", "20")
	limit, _ := strconv.Atoi(limitStr)

	reports, err := h.service.GetReports(queueName, limit)
	if err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	successResponse(c, reports)
}

func (h *ConsumerHandler) ExportCSV(c *gin.Context) {
	filePath := "data/export_consumers.csv"
	if err := h.service.ExportToCSV(filePath); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	c.File(filePath)
}

func (h *ConsumerHandler) GetErrorRecords(c *gin.Context) {
	handledStr := c.Query("handled")
	limitStr := c.DefaultQuery("limit", "50")
	limit, _ := strconv.Atoi(limitStr)

	var handled *bool
	if handledStr != "" {
		h := handledStr == "true"
		handled = &h
	}

	records, err := h.service.GetErrorRecords(handled, limit)
	if err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	successResponse(c, records)
}

func (h *ConsumerHandler) ResolveError(c *gin.Context) {
	var req model.ErrorRecordResolveRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	if err := h.service.ResolveErrorRecord(&req); err != nil {
		c.Error(err)
		errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	successResponse(c, nil)
}
