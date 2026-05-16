package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"

	"config-drift-exemption/models"
	"config-drift-exemption/store"

	"github.com/gin-gonic/gin"
)

type DriftHandler struct {
	store *store.DriftStore
}

func NewDriftHandler(s *store.DriftStore) *DriftHandler {
	return &DriftHandler{store: s}
}

func successResponse(c *gin.Context, code models.ApiResultCode, message string, data interface{}) {
	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    code,
		Message: message,
		Data:    data,
	})
}

func errorResponse(c *gin.Context, code models.ApiResultCode, message string, err error) {
	c.JSON(http.StatusOK, models.ApiResponse{
		Code:    code,
		Message: fmt.Sprintf("%s: %v", message, err),
	})
}

func (h *DriftHandler) CreateDrift(c *gin.Context) {
	var req models.CreateDriftRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, models.ResultBlocked, "参数验证失败", err)
		return
	}

	rawInput, _ := json.Marshal(req)
	req.RawInput = string(rawInput)

	record, resultCode, err := h.store.CreateDrift(&req)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "创建失败", err)
		return
	}

	msg := "创建成功"
	if resultCode == models.ResultPendingReview {
		msg = "创建成功，等待复核"
	} else if record.ProcessingNote != "" {
		msg = record.ProcessingNote
	}

	successResponse(c, resultCode, msg, record)
}

func (h *DriftHandler) GetDrift(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "无效的ID", err)
		return
	}

	record, err := h.store.GetDriftByID(id)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "查询失败", err)
		return
	}

	successResponse(c, models.ResultSuccess, "查询成功", record)
}

func (h *DriftHandler) QueryDrifts(c *gin.Context) {
	var filter models.QueryFilter

	if v := c.Query("service_name"); v != "" {
		filter.ServiceName = v
	}
	if v := c.Query("config_key"); v != "" {
		filter.ConfigKey = v
	}
	if v := c.Query("status"); v != "" {
		filter.Status = models.DriftStatus(v)
	}
	if v := c.Query("reporter"); v != "" {
		filter.Reporter = v
	}
	if v := c.Query("reviewer"); v != "" {
		filter.Reviewer = v
	}
	if v := c.Query("is_expired"); v != "" {
		expired := v == "true" || v == "1"
		filter.IsExpired = &expired
	}
	if v := c.Query("page"); v != "" {
		if page, err := strconv.Atoi(v); err == nil {
			filter.Page = page
		}
	}
	if v := c.Query("page_size"); v != "" {
		if size, err := strconv.Atoi(v); err == nil {
			filter.PageSize = size
		}
	}

	records, total, err := h.store.QueryDrifts(&filter)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "查询失败", err)
		return
	}

	result := map[string]interface{}{
		"records": records,
		"total":   total,
		"page":    filter.Page,
		"size":    filter.PageSize,
	}

	successResponse(c, models.ResultSuccess, "查询成功", result)
}

func (h *DriftHandler) ReviewDrift(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "无效的ID", err)
		return
	}

	var req models.ReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, models.ResultBlocked, "参数验证失败", err)
		return
	}

	record, resultCode, err := h.store.ReviewDrift(id, &req)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "复核失败", err)
		return
	}

	msg := "复核成功"
	if req.Status == models.StatusApproved {
		msg = "已批准豁免"
	} else if req.Status == models.StatusRejected {
		msg = "已拒绝豁免"
	}

	successResponse(c, resultCode, msg, record)
}

func (h *DriftHandler) ManualFix(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "无效的ID", err)
		return
	}

	var req models.ManualFixRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, models.ResultBlocked, "参数验证失败", err)
		return
	}

	record, resultCode, err := h.store.ManualFix(id, &req)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "人工修正失败", err)
		return
	}

	successResponse(c, resultCode, "人工修正完成，状态已更新为已补偿", record)
}

func (h *DriftHandler) ExportDrifts(c *gin.Context) {
	var filter models.QueryFilter

	if v := c.Query("service_name"); v != "" {
		filter.ServiceName = v
	}
	if v := c.Query("config_key"); v != "" {
		filter.ConfigKey = v
	}
	if v := c.Query("status"); v != "" {
		filter.Status = models.DriftStatus(v)
	}

	data, err := h.store.ExportDrifts(&filter)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "导出失败", err)
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=drift_export.json")
	c.Data(http.StatusOK, "application/json", data)
}

func (h *DriftHandler) GetDriftHistory(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "无效的ID", err)
		return
	}

	history, err := h.store.GetDriftHistory(id)
	if err != nil {
		errorResponse(c, models.ResultBlocked, "查询历史失败", err)
		return
	}

	successResponse(c, models.ResultSuccess, "查询成功", history)
}

func (h *DriftHandler) CheckExpired(c *gin.Context) {
	expiredIDs, err := h.store.CheckAndMarkExpired()
	if err != nil {
		errorResponse(c, models.ResultBlocked, "过期检查失败", err)
		return
	}

	successResponse(c, models.ResultSuccess,
		fmt.Sprintf("已标记 %d 条过期记录", len(expiredIDs)),
		map[string]interface{}{"expired_ids": expiredIDs})
}

func (h *DriftHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "config-drift-exemption-api",
	})
}

func SetupRoutes(r *gin.Engine, store *store.DriftStore) {
	handler := NewDriftHandler(store)

	api := r.Group("/api/v1")
	{
		drifts := api.Group("/drifts")
		{
			drifts.POST("", handler.CreateDrift)
			drifts.GET("", handler.QueryDrifts)
			drifts.GET("/export", handler.ExportDrifts)
			drifts.GET("/:id", handler.GetDrift)
			drifts.POST("/:id/review", handler.ReviewDrift)
			drifts.POST("/:id/fix", handler.ManualFix)
			drifts.GET("/:id/history", handler.GetDriftHistory)
		}

		api.POST("/maintenance/check-expired", handler.CheckExpired)
		api.GET("/health", handler.HealthCheck)
	}
}
