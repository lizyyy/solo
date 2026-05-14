package handler

import (
	"batch-notification-dedup/internal/model"
	"batch-notification-dedup/internal/service"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	service *service.DedupService
}

func NewHandler(svc *service.DedupService) *Handler {
	return &Handler{service: svc}
}

func (h *Handler) SetupRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		api.POST("/notifications", h.CreateNotification)
		api.GET("/notifications/:request_id", h.GetNotification)
		api.PUT("/notifications/:request_id/status", h.UpdateStatus)
		api.GET("/notifications", h.ListNotifications)
		api.GET("/skip-records", h.ListSkipRecords)
		api.GET("/statistics", h.GetStatistics)
		api.GET("/export/notifications", h.ExportNotifications)
		api.POST("/scenes", h.CreateScene)
	}
}

type CreateNotificationRequest struct {
	RequestID   string      `json:"request_id"`
	Scene       string      `json:"scene" binding:"required"`
	User        UserInfo    `json:"user" binding:"required"`
	Content     string      `json:"content"`
	DedupWindow int64       `json:"dedup_window"`
	Credential  string      `json:"credential,omitempty"`
}

type UserInfo struct {
	UserID   string `json:"user_id" binding:"required"`
	DeviceID string `json:"device_id"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
}

func (h *Handler) CreateNotification(c *gin.Context) {
	var req CreateNotificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid request body",
			"details": err.Error(),
		})
		return
	}

	svcReq := &service.CreateRequest{
		RequestID: req.RequestID,
		Scene:     req.Scene,
		User: model.UserIdentifier{
			UserID:   req.User.UserID,
			DeviceID: req.User.DeviceID,
			Email:    req.User.Email,
			Phone:    req.User.Phone,
		},
		Content:     req.Content,
		DedupWindow: req.DedupWindow,
		Credential:  req.Credential,
	}

	resp, err := h.service.CreateNotification(svcReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetNotification(c *gin.Context) {
	requestID := c.Param("request_id")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request_id is required"})
		return
	}

	notification, err := h.service.GetNotification(requestID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	if notification == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "notification not found"})
		return
	}

	c.JSON(http.StatusOK, notification)
}

type UpdateStatusRequest struct {
	Status string `json:"status" binding:"required"`
}

func (h *Handler) UpdateStatus(c *gin.Context) {
	requestID := c.Param("request_id")
	if requestID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "request_id is required"})
		return
	}

	var req UpdateStatusRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid request body",
			"details": err.Error(),
		})
		return
	}

	status := model.NotificationStatus(req.Status)
	if status != model.StatusSent && status != model.StatusFailed && status != model.StatusAllowed && status != model.StatusSkipped {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid status value"})
		return
	}

	svcReq := &service.UpdateStatusRequest{
		RequestID: requestID,
		Status:    status,
	}

	if err := h.service.UpdateNotificationStatus(svcReq); err != nil {
		if err.Error() == "request not found" {
			c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		} else {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		}
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "status updated successfully"})
}

func (h *Handler) ListNotifications(c *gin.Context) {
	query := &service.QueryRequest{
		Scene:     c.Query("scene"),
		UserHash:  c.Query("user_hash"),
		Status:    model.NotificationStatus(c.Query("status")),
		StartTime: c.Query("start_time"),
		EndTime:   c.Query("end_time"),
		Offset:    parseQueryInt(c, "offset", 0),
		Limit:     parseQueryInt(c, "limit", 20),
	}

	notifications, total, err := h.service.ListNotifications(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  notifications,
		"total": total,
		"offset": query.Offset,
		"limit":  query.Limit,
	})
}

func (h *Handler) ListSkipRecords(c *gin.Context) {
	query := &service.QueryRequest{
		Scene:     c.Query("scene"),
		UserHash:  c.Query("user_hash"),
		StartTime: c.Query("start_time"),
		EndTime:   c.Query("end_time"),
		Offset:    parseQueryInt(c, "offset", 0),
		Limit:     parseQueryInt(c, "limit", 20),
	}

	records, total, err := h.service.ListSkipRecords(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  records,
		"total": total,
		"offset": query.Offset,
		"limit":  query.Limit,
	})
}

func (h *Handler) GetStatistics(c *gin.Context) {
	scene := c.Query("scene")
	startTime := c.Query("start_time")
	endTime := c.Query("end_time")

	stats, err := h.service.GetStatistics(scene, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func (h *Handler) ExportNotifications(c *gin.Context) {
	query := &service.QueryRequest{
		Scene:     c.Query("scene"),
		UserHash:  c.Query("user_hash"),
		Status:    model.NotificationStatus(c.Query("status")),
		StartTime: c.Query("start_time"),
		EndTime:   c.Query("end_time"),
		Offset:    0,
		Limit:     10000,
	}

	notifications, _, err := h.service.ListNotifications(query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"notifications_%s.csv\"", time.Now().Format("20060102_150405")))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"RequestID", "Scene", "UserID", "UserHash", "Status", "SkipReason", "DedupWindow", "CreatedAt", "UpdatedAt"})

	for _, n := range notifications {
		writer.Write([]string{
			n.RequestID,
			n.Scene,
			n.UserIdentifier.UserID,
			n.UserHash,
			string(n.Status),
			string(n.SkipReason),
			strconv.FormatInt(n.DedupWindow, 10),
			n.CreatedAt.Format(time.RFC3339),
			n.UpdatedAt.Format(time.RFC3339),
		})
	}
}

type CreateSceneRequest struct {
	Scene         string `json:"scene" binding:"required"`
	Description   string `json:"description"`
	DefaultWindow int64  `json:"default_window"`
	Enabled       bool   `json:"enabled"`
}

func (h *Handler) CreateScene(c *gin.Context) {
	var req CreateSceneRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid request body",
			"details": err.Error(),
		})
		return
	}

	if req.DefaultWindow <= 0 {
		req.DefaultWindow = 300
	}

	scene, err := h.service.CreateBusinessScene(req.Scene, req.Description, req.DefaultWindow, req.Enabled)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, scene)
}

func parseQueryInt(c *gin.Context, key string, defaultValue int) int {
	val := c.Query(key)
	if val == "" {
		return defaultValue
	}
	if i, err := strconv.Atoi(val); err == nil {
		return i
	}
	return defaultValue
}
