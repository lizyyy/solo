package handler

import (
	"encoding/csv"
	"net/http"
	"read-write-split-api/internal/model"
	"read-write-split-api/internal/service"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *service.SplitService
}

func NewHandler(service *service.SplitService) *Handler {
	return &Handler{service: service}
}

func (h *Handler) SetupRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		strategies := api.Group("/strategies")
		{
			strategies.POST("", h.CreateStrategy)
			strategies.GET("", h.ListStrategies)
			strategies.GET("/:id", h.GetStrategy)
			strategies.PUT("/:id/status", h.UpdateStrategyStatus)
		}

		process := api.Group("/process")
		{
			process.POST("", h.ProcessRequest)
		}

		records := api.Group("/records")
		{
			records.GET("", h.QueryHitRecords)
			records.GET("/:id", h.GetHitRecord)
			records.PUT("/:id/status", h.AdvanceStatus)
			records.PUT("/:id/correction", h.ApplyCorrection)
			records.DELETE("/:id", h.RevokeHitRecord)
		}

		report := api.Group("/report")
		{
			report.GET("", h.GetReport)
			report.GET("/export", h.ExportHitRecords)
		}
	}
}

func (h *Handler) CreateStrategy(c *gin.Context) {
	var req model.CreateStrategyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{
			Code:    http.StatusBadRequest,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	strategy, err := h.service.CreateStrategy(&req)
	if err != nil {
		if err.Error() == "strategy already exists" {
			c.JSON(http.StatusConflict, model.Response{
				Code:    http.StatusConflict,
				Message: err.Error(),
				Data:    strategy,
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, model.Response{
		Code:    http.StatusCreated,
		Message: "strategy created successfully",
		Data:    strategy,
	})
}

func (h *Handler) ListStrategies(c *gin.Context) {
	strategies, err := h.service.ListStrategies()
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    http.StatusOK,
		Message: "success",
		Data:    strategies,
	})
}

func (h *Handler) GetStrategy(c *gin.Context) {
	id := c.Param("id")
	strategy, err := h.service.GetStrategy(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	if strategy == nil {
		c.JSON(http.StatusNotFound, model.Response{
			Code:    http.StatusNotFound,
			Message: "strategy not found",
		})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    http.StatusOK,
		Message: "success",
		Data:    strategy,
	})
}

func (h *Handler) UpdateStrategyStatus(c *gin.Context) {
	id := c.Param("id")
	var req model.UpdateStrategyStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{
			Code:    http.StatusBadRequest,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	if err := h.service.UpdateStrategyStatus(id, req.Status); err != nil {
		if err.Error() == "strategy not found" {
			c.JSON(http.StatusNotFound, model.Response{
				Code:    http.StatusNotFound,
				Message: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    http.StatusOK,
		Message: "strategy status updated successfully",
	})
}

func (h *Handler) ProcessRequest(c *gin.Context) {
	var req model.ProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{
			Code:    http.StatusBadRequest,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	result, err := h.service.ProcessRequest(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	statusCode := http.StatusOK
	if result.Message == "duplicate request, returned existing result" {
		statusCode = http.StatusConflict
	}

	c.JSON(statusCode, model.Response{
		Code:    statusCode,
		Message: result.Message,
		Data:    result,
	})
}

func (h *Handler) QueryHitRecords(c *gin.Context) {
	var req model.QueryHitRecordsRequest

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	req.Page = page
	req.PageSize = pageSize
	req.StrategyID = c.Query("strategy_id")
	req.Status = model.HitStatus(c.Query("status"))
	req.Path = c.Query("path")

	if startTimeStr := c.Query("start_time"); startTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
			req.StartTime = &t
		}
	}
	if endTimeStr := c.Query("end_time"); endTimeStr != "" {
		if t, err := time.Parse(time.RFC3339, endTimeStr); err == nil {
			req.EndTime = &t
		}
	}

	records, total, err := h.service.QueryHitRecords(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    http.StatusOK,
		Message: "success",
		Data: model.PaginatedResponse{
			Data:       records,
			Total:      total,
			Page:       page,
			PageSize:   pageSize,
			TotalPages: int((total + int64(pageSize) - 1) / int64(pageSize)),
		},
	})
}

func (h *Handler) GetHitRecord(c *gin.Context) {
	id := c.Param("id")
	record, err := h.service.GetHitRecord(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	if record == nil {
		c.JSON(http.StatusNotFound, model.Response{
			Code:    http.StatusNotFound,
			Message: "hit record not found",
		})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    http.StatusOK,
		Message: "success",
		Data:    record,
	})
}

func (h *Handler) AdvanceStatus(c *gin.Context) {
	id := c.Param("id")
	var req model.AdvanceStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{
			Code:    http.StatusBadRequest,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	if err := h.service.AdvanceStatus(id, &req); err != nil {
		if err.Error() == "hit record not found" {
			c.JSON(http.StatusNotFound, model.Response{
				Code:    http.StatusNotFound,
				Message: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    http.StatusOK,
		Message: "status advanced successfully",
	})
}

func (h *Handler) ApplyCorrection(c *gin.Context) {
	id := c.Param("id")
	var req model.CorrectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.Response{
			Code:    http.StatusBadRequest,
			Message: "invalid request body: " + err.Error(),
		})
		return
	}

	if err := h.service.ApplyCorrection(id, &req); err != nil {
		if err.Error() == "hit record not found" {
			c.JSON(http.StatusNotFound, model.Response{
				Code:    http.StatusNotFound,
				Message: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    http.StatusOK,
		Message: "correction applied successfully",
	})
}

func (h *Handler) RevokeHitRecord(c *gin.Context) {
	id := c.Param("id")
	userID := c.GetHeader("X-User-ID")
	if userID == "" {
		userID = "anonymous"
	}

	if err := h.service.RevokeHitRecord(id, userID); err != nil {
		if err.Error() == "hit record not found" {
			c.JSON(http.StatusNotFound, model.Response{
				Code:    http.StatusNotFound,
				Message: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    http.StatusOK,
		Message: "hit record revoked successfully",
	})
}

func (h *Handler) GetReport(c *gin.Context) {
	var startTime, endTime time.Time

	if startTimeStr := c.Query("start_time"); startTimeStr != "" {
		startTime, _ = time.Parse(time.RFC3339, startTimeStr)
	}
	if endTimeStr := c.Query("end_time"); endTimeStr != "" {
		endTime, _ = time.Parse(time.RFC3339, endTimeStr)
	}

	report, err := h.service.GetReport(startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, model.Response{
		Code:    http.StatusOK,
		Message: "success",
		Data:    report,
	})
}

func (h *Handler) ExportHitRecords(c *gin.Context) {
	var startTime, endTime time.Time

	if startTimeStr := c.Query("start_time"); startTimeStr != "" {
		startTime, _ = time.Parse(time.RFC3339, startTimeStr)
	}
	if endTimeStr := c.Query("end_time"); endTimeStr != "" {
		endTime, _ = time.Parse(time.RFC3339, endTimeStr)
	}

	records, err := h.service.ExportHitRecords(startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.Response{
			Code:    http.StatusInternalServerError,
			Message: err.Error(),
		})
		return
	}

	c.Writer.Header().Set("Content-Type", "text/csv")
	c.Writer.Header().Set("Content-Disposition", "attachment; filename=hit_records.csv")

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	headers := []string{"ID", "Request ID", "Strategy ID", "Path", "Method", "Matched Operation", "DB Role", "Status", "Correction Action", "Created At"}
	writer.Write(headers)

	for _, record := range records {
		row := []string{
			record.ID,
			record.RequestID,
			record.StrategyID,
			record.Path,
			record.Method,
			string(record.MatchedOperation),
			record.DBRoleUsed,
			string(record.Status),
			string(record.CorrectionAction),
			record.CreatedAt.Format(time.RFC3339),
		}
		writer.Write(row)
	}
}
