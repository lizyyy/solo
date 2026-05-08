package api

import (
	"chaos-payment/internal/eventbus"
	"chaos-payment/internal/models"
	"chaos-payment/internal/service"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type Handler struct {
	orderService    *service.OrderService
	chaosEngine     *service.ChaosEngine
	recoveryService *service.RecoveryService
	bus             *eventbus.EventBus
	upgrader        websocket.Upgrader
}

func NewHandler(os *service.OrderService, ce *service.ChaosEngine, rs *service.RecoveryService, bus *eventbus.EventBus) *Handler {
	return &Handler{
		orderService:    os,
		chaosEngine:     ce,
		recoveryService: rs,
		bus:             bus,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
	}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		orders := api.Group("/orders")
		{
			orders.POST("", h.CreateOrder)
			orders.GET("", h.ListOrders)
			orders.GET("/:id", h.GetOrder)
			orders.POST("/:id/callback", h.ProcessCallback)
			orders.POST("/:id/simulate-duplicate", h.SimulateDuplicateCallback)
			orders.GET("/:id/verify", h.VerifyOrderConsistency)
			orders.GET("/:id/callbacks", h.GetCallbacks)
			orders.GET("/:id/snapshots", h.GetSnapshots)
		}

		chaos := api.Group("/chaos")
		{
			chaos.GET("/status", h.GetChaosStatus)
			chaos.POST("/scenarios/:name/toggle", h.ToggleScenario)
			chaos.POST("/inject/connection-pool", h.InjectConnectionPoolExhaustion)
			chaos.POST("/inject/message-backlog", h.InjectMessageBacklog)
			chaos.POST("/inject/goroutine-leak", h.InjectGoroutineLeak)
			chaos.POST("/inject/db-lock/:orderID", h.InjectDatabaseLockWait)
			chaos.POST("/inject/cache-dirty/:orderID", h.InjectCacheDirtyData)
			chaos.GET("/metrics", h.GetChaosMetrics)
		}

		recovery := api.Group("/recovery")
		{
			recovery.POST("/replay/:orderID", h.ReplayEvents)
			recovery.POST("/revert/:orderID", h.RevertToSnapshot)
			recovery.POST("/fix-duplicates/:orderID", h.FixDuplicateCallback)
			recovery.POST("/fix-cache/:orderID", h.FixCacheDirtyData)
			recovery.GET("/anomalies", h.AnalyzeAnomalies)
			recovery.GET("/history/:orderID", h.GetRecoveryHistory)
		}

		events := api.Group("/events")
		{
			events.GET("/timeline", h.GetTimeline)
			events.GET("/ws", h.WebSocketEvents)
		}
	}

	r.StaticFS("/static", http.Dir("./web/static"))
	r.GET("/", func(c *gin.Context) {
		c.File("./web/index.html")
	})
}

type CreateOrderRequest struct {
	Amount        float64 `json:"amount"`
	PaymentMethod string  `json:"payment_method"`
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var req CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	order, err := h.orderService.CreateOrder(c.Request.Context(), req.Amount, req.PaymentMethod)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, order)
}

func (h *Handler) ListOrders(c *gin.Context) {
	limit := 20
	offset := 0

	orders, total, err := h.orderService.ListOrders(c.Request.Context(), limit, offset)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"total":  total,
	})
}

func (h *Handler) GetOrder(c *gin.Context) {
	orderID := c.Param("id")

	order, err := h.orderService.GetOrder(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}

	c.JSON(http.StatusOK, order)
}

func (h *Handler) ProcessCallback(c *gin.Context) {
	orderID := c.Param("id")

	var req service.PaymentCallbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	req.OrderID = orderID

	if err := h.orderService.ProcessPaymentCallback(c.Request.Context(), req); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "processed"})
}

func (h *Handler) SimulateDuplicateCallback(c *gin.Context) {
	orderID := c.Param("id")

	if err := h.orderService.SimulateDuplicateCallback(c.Request.Context(), orderID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "simulation_started"})
}

func (h *Handler) VerifyOrderConsistency(c *gin.Context) {
	orderID := c.Param("id")

	isConsistent, details, err := h.orderService.VerifyOrderConsistency(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"is_consistent": false,
			"error":         err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"is_consistent": isConsistent,
		"details":       details,
	})
}

func (h *Handler) GetCallbacks(c *gin.Context) {
	orderID := c.Param("id")

	callbacks, err := h.orderService.GetCallbacks(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, callbacks)
}

func (h *Handler) GetSnapshots(c *gin.Context) {
	orderID := c.Param("id")

	snapshots, err := h.orderService.GetStateManager().ListSnapshots("order", orderID, 20)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, snapshots)
}

func (h *Handler) GetChaosStatus(c *gin.Context) {
	c.JSON(http.StatusOK, h.chaosEngine.GetScenarioStatus())
}

func (h *Handler) ToggleScenario(c *gin.Context) {
	scenarioName := c.Param("name")

	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.chaosEngine.ToggleScenario(scenarioName, req.Enabled); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}

type InjectRequest struct {
	DurationMs      int64   `json:"duration_ms"`
	QueueSize       int     `json:"queue_size"`
	ProcessingDelay int64   `json:"processing_delay_ms"`
	LeakRate        float64 `json:"leak_rate"`
	LockHoldTimeMs  int64   `json:"lock_hold_time_ms"`
	DirtyRate       float64 `json:"dirty_rate"`
}

func (h *Handler) InjectConnectionPoolExhaustion(c *gin.Context) {
	var req InjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	duration := 30 * time.Second
	if req.DurationMs > 0 {
		duration = time.Duration(req.DurationMs) * time.Millisecond
	}

	if err := h.chaosEngine.InjectConnectionPoolExhaustion(c.Request.Context(), duration); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "injected", "duration_ms": duration.Milliseconds()})
}

func (h *Handler) InjectMessageBacklog(c *gin.Context) {
	var req InjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var delay time.Duration
	if req.ProcessingDelay > 0 {
		delay = time.Duration(req.ProcessingDelay) * time.Millisecond
	}

	if err := h.chaosEngine.InjectMessageBacklog(req.QueueSize, delay); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "injected"})
}

func (h *Handler) InjectGoroutineLeak(c *gin.Context) {
	var req InjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.chaosEngine.InjectGoroutineLeak(req.LeakRate); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "injected"})
}

func (h *Handler) InjectDatabaseLockWait(c *gin.Context) {
	orderID := c.Param("orderID")

	var req InjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	var holdTime time.Duration
	if req.LockHoldTimeMs > 0 {
		holdTime = time.Duration(req.LockHoldTimeMs) * time.Millisecond
	}

	if err := h.chaosEngine.InjectDatabaseLockWait(orderID, holdTime); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "injected"})
}

func (h *Handler) InjectCacheDirtyData(c *gin.Context) {
	orderID := c.Param("orderID")

	var req InjectRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.chaosEngine.InjectCacheDirtyData(c.Request.Context(), orderID, req.DirtyRate); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "injected"})
}

func (h *Handler) GetChaosMetrics(c *gin.Context) {
	c.JSON(http.StatusOK, h.chaosEngine.GetMetrics())
}

type ReplayRequest struct {
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
}

func (h *Handler) ReplayEvents(c *gin.Context) {
	orderID := c.Param("orderID")

	var req ReplayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startTime, _ := time.Parse(time.RFC3339, req.StartTime)
	endTime, _ := time.Parse(time.RFC3339, req.EndTime)

	if startTime.IsZero() {
		startTime = time.Now().Add(-24 * time.Hour)
	}
	if endTime.IsZero() {
		endTime = time.Now()
	}

	result, err := h.recoveryService.ReplayEvents(c.Request.Context(), orderID, startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

type RevertRequest struct {
	SnapshotTime string `json:"snapshot_time"`
}

func (h *Handler) RevertToSnapshot(c *gin.Context) {
	orderID := c.Param("orderID")

	var req RevertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	snapshotTime, err := time.Parse(time.RFC3339, req.SnapshotTime)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid snapshot_time format"})
		return
	}

	if err := h.recoveryService.RevertToSnapshot(c.Request.Context(), "order", orderID, snapshotTime); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": "reverted"})
}

func (h *Handler) FixDuplicateCallback(c *gin.Context) {
	orderID := c.Param("orderID")

	fixed, err := h.recoveryService.FixDuplicateCallback(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"fixed": fixed})
}

func (h *Handler) FixCacheDirtyData(c *gin.Context) {
	orderID := c.Param("orderID")

	fixed, err := h.recoveryService.FixCacheDirtyData(c.Request.Context(), orderID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"fixed": fixed})
}

type AnomalyRequest struct {
	StartTime string `form:"start_time"`
	EndTime   string `form:"end_time"`
}

func (h *Handler) AnalyzeAnomalies(c *gin.Context) {
	var req AnomalyRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startTime, _ := time.Parse(time.RFC3339, req.StartTime)
	endTime, _ := time.Parse(time.RFC3339, req.EndTime)

	if startTime.IsZero() {
		startTime = time.Now().Add(-24 * time.Hour)
	}
	if endTime.IsZero() {
		endTime = time.Now()
	}

	anomalies, err := h.recoveryService.AnalyzeAnomalies(c.Request.Context(), startTime, endTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, anomalies)
}

func (h *Handler) GetRecoveryHistory(c *gin.Context) {
	orderID := c.Param("orderID")

	history, err := h.recoveryService.GetRecoveryHistory(orderID, 20)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, history)
}

type TimelineRequest struct {
	StartTime string `form:"start_time"`
	EndTime   string `form:"end_time"`
	Limit     int    `form:"limit"`
}

func (h *Handler) GetTimeline(c *gin.Context) {
	var req TimelineRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	startTime, _ := time.Parse(time.RFC3339, req.StartTime)
	endTime, _ := time.Parse(time.RFC3339, req.EndTime)
	limit := req.Limit

	if startTime.IsZero() {
		startTime = time.Now().Add(-1 * time.Hour)
	}
	if endTime.IsZero() {
		endTime = time.Now()
	}
	if limit == 0 {
		limit = 100
	}

	events, err := h.bus.GetTimeline(startTime, endTime, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, events)
}

func (h *Handler) WebSocketEvents(c *gin.Context) {
	conn, err := h.upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	h.bus.Subscribe("*", func(event *models.Event) {
		data, _ := json.Marshal(event)
		conn.WriteMessage(websocket.TextMessage, data)
	})

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}
