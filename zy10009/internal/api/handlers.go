package api

import (
	"encoding/json"
	"io"
	"net/http"
	"runtime"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"chaos-demo/internal/eventstore"
	"chaos-demo/internal/messagequeue"
	"chaos-demo/internal/replay"
	"chaos-demo/internal/services"
	"chaos-demo/internal/types"
)

type Handler struct {
	inventory  *services.InventoryService
	order      *services.OrderService
	chaos      *services.ChaosService
	eventStore *eventstore.EventStore
	replay     *replay.ReplayService
	queue      *messagequeue.MessageQueue
}

func NewHandler(inventory *services.InventoryService, order *services.OrderService, chaos *services.ChaosService, eventStore *eventstore.EventStore, replayService *replay.ReplayService, queue *messagequeue.MessageQueue) *Handler {
	return &Handler{
		inventory:  inventory,
		order:      order,
		chaos:      chaos,
		eventStore: eventStore,
		replay:     replayService,
		queue:      queue,
	}
}

func (h *Handler) RegisterRoutes(r *gin.Engine) {
	api := r.Group("/api")
	{
		api.POST("/orders", h.CreateOrder)
		api.GET("/orders", h.ListOrders)
		api.GET("/orders/:id", h.GetOrder)

		api.GET("/inventory", h.ListInventory)
		api.GET("/inventory/:product_id", h.GetInventory)
		api.POST("/inventory/:product_id/add", h.AddInventory)

		api.POST("/chaos/enable", h.EnableChaos)
		api.POST("/chaos/disable", h.DisableChaos)
		api.GET("/chaos/config", h.GetChaosConfig)
		api.PUT("/chaos/config", h.SetChaosConfig)
		api.POST("/chaos/toggle/:fault_type", h.ToggleFault)

		api.GET("/events", h.ListEvents)
		api.GET("/events/timeline", h.GetTimeline)
		api.GET("/events/stats", h.GetEventStats)

		api.POST("/replay/start", h.StartReplay)
		api.POST("/replay/stop", h.StopReplay)
		api.GET("/replay/status", h.GetReplayStatus)
		api.GET("/replay/state/:sequence", h.GetStateAtSequence)

		api.GET("/system/metrics", h.GetSystemMetrics)
		api.GET("/system/state", h.GetCurrentState)
	}

	r.StaticFile("/", "./web/index.html")
	r.Static("/static", "./web/static")
}

func (h *Handler) CreateOrder(c *gin.Context) {
	var req struct {
		ProductID string                 `json:"product_id" binding:"required"`
		Quantity  int                    `json:"quantity" binding:"required,gt=0"`
		Payload   map[string]interface{} `json:"payload"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	order, err := h.order.CreateOrder(c.Request.Context(), req.ProductID, req.Quantity, req.Payload)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
			"order": order,
		})
		return
	}

	c.JSON(http.StatusOK, order)
}

func (h *Handler) ListOrders(c *gin.Context) {
	orders := h.order.GetAllOrders()
	c.JSON(http.StatusOK, orders)
}

func (h *Handler) GetOrder(c *gin.Context) {
	id := c.Param("id")
	order, exists := h.order.GetOrder(id)
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}
	c.JSON(http.StatusOK, order)
}

func (h *Handler) ListInventory(c *gin.Context) {
	stocks := h.inventory.GetAllStocks()
	c.JSON(http.StatusOK, stocks)
}

func (h *Handler) GetInventory(c *gin.Context) {
	productID := c.Param("product_id")
	stock, err := h.inventory.GetStock(c.Request.Context(), productID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stock)
}

func (h *Handler) AddInventory(c *gin.Context) {
	productID := c.Param("product_id")
	var req struct {
		Quantity int `json:"quantity" binding:"required,gt=0"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.inventory.AddStock(productID, req.Quantity)
	stock, _ := h.inventory.GetStock(c.Request.Context(), productID)
	c.JSON(http.StatusOK, stock)
}

func (h *Handler) EnableChaos(c *gin.Context) {
	h.chaos.Enable()
	c.JSON(http.StatusOK, gin.H{"status": "enabled"})
}

func (h *Handler) DisableChaos(c *gin.Context) {
	h.chaos.Disable()
	c.JSON(http.StatusOK, gin.H{"status": "disabled"})
}

func (h *Handler) GetChaosConfig(c *gin.Context) {
	config := h.chaos.GetConfig()
	c.JSON(http.StatusOK, config)
}

func (h *Handler) SetChaosConfig(c *gin.Context) {
	var config types.FaultConfig
	if err := c.ShouldBindJSON(&config); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	h.chaos.SetConfig(config)
	c.JSON(http.StatusOK, config)
}

func (h *Handler) ToggleFault(c *gin.Context) {
	faultType := c.Param("fault_type")
	var req struct {
		Enabled bool `json:"enabled"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	h.chaos.ToggleFault(faultType, req.Enabled)
	c.JSON(http.StatusOK, gin.H{
		"fault_type": faultType,
		"enabled":    req.Enabled,
	})
}

func (h *Handler) ListEvents(c *gin.Context) {
	limit := 100
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			limit = n
		}
	}

	offset := 0
	if o := c.Query("offset"); o != "" {
		if n, err := strconv.Atoi(o); err == nil && n >= 0 {
			offset = n
		}
	}

	req := types.TimelineRequest{
		Limit:  limit,
		Offset: offset,
	}

	if orderID := c.Query("order_id"); orderID != "" {
		req.OrderID = &orderID
	}

	resp, err := h.eventStore.GetEvents(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetTimeline(c *gin.Context) {
	req := types.TimelineRequest{}

	if startTime := c.Query("start_time"); startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			req.StartTime = &t
		}
	}

	if endTime := c.Query("end_time"); endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			req.EndTime = &t
		}
	}

	if eventTypes := c.QueryArray("event_types"); len(eventTypes) > 0 {
		for _, et := range eventTypes {
			req.EventTypes = append(req.EventTypes, types.EventType(et))
		}
	}

	if orderID := c.Query("order_id"); orderID != "" {
		req.OrderID = &orderID
	}

	req.Limit = 100
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil && n > 0 {
			req.Limit = n
		}
	}

	resp, err := h.eventStore.GetEvents(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, resp)
}

func (h *Handler) GetEventStats(c *gin.Context) {
	stats := h.replay.GetEventStats()
	c.JSON(http.StatusOK, stats)
}

func (h *Handler) StartReplay(c *gin.Context) {
	var req types.ReplayRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if req.Speed <= 0 {
		req.Speed = 1.0
	}

	err := h.replay.StartReplay(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":        "started",
		"start_seq":     req.StartSequence,
		"end_seq":       req.EndSequence,
		"speed":         req.Speed,
	})
}

func (h *Handler) StopReplay(c *gin.Context) {
	h.replay.StopReplay()
	c.JSON(http.StatusOK, gin.H{"status": "stopped"})
}

func (h *Handler) GetReplayStatus(c *gin.Context) {
	startSeq, endSeq := h.replay.GetSequenceRange()
	c.JSON(http.StatusOK, gin.H{
		"is_replaying": h.replay.IsReplaying(),
		"current_seq":  h.replay.GetReplayProgress(),
		"start_seq":    startSeq,
		"end_seq":      endSeq,
	})
}

func (h *Handler) GetStateAtSequence(c *gin.Context) {
	seqStr := c.Param("sequence")
	seq, err := strconv.ParseInt(seqStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid sequence"})
		return
	}

	state, err := h.replay.GetSystemStateAtSequence(seq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, state)
}

func (h *Handler) GetSystemMetrics(c *gin.Context) {
	queueState := h.queue.GetState()
	goroutineCount := runtime.NumGoroutine()
	cacheHits, cacheMisses := h.inventory.GetCacheStats()

	c.JSON(http.StatusOK, gin.H{
		"goroutine_count": goroutineCount,
		"message_queue":   queueState,
		"cache_stats": gin.H{
			"hits":   cacheHits,
			"misses": cacheMisses,
		},
		"active_locks":    h.chaos.GetActiveLocks(),
		"config_version":  h.chaos.GetConfigVersion(),
		"current_sequence": h.eventStore.GetCurrentSequence(),
	})
}

func (h *Handler) GetCurrentState(c *gin.Context) {
	stocks := h.inventory.GetAllStocks()
	orders := h.order.GetAllOrders()
	queueState := h.queue.GetState()
	goroutineCount := runtime.NumGoroutine()
	cacheHits, cacheMisses := h.inventory.GetCacheStats()

	c.JSON(http.StatusOK, types.SystemState{
		Timestamp:     time.Now(),
		StockSnapshot: stocks,
		OrderSnapshot: orders,
		MessageQueue:  queueState,
		GoroutineCount: goroutineCount,
		CacheHits:     cacheHits,
		CacheMisses:   cacheMisses,
		ActiveLocks:   h.chaos.GetActiveLocks(),
		ConfigVersion: h.chaos.GetConfigVersion(),
	})
}

func (h *Handler) EventStream(c *gin.Context) {
	listenerID := "stream-" + strconv.FormatInt(time.Now().UnixNano(), 10)
	eventChan := h.eventStore.Subscribe(listenerID)
	defer h.eventStore.Unsubscribe(listenerID)

	c.Stream(func(w io.Writer) bool {
		encoder := json.NewEncoder(w)
		for event := range eventChan {
			encoder.Encode(event)
			if f, ok := w.(http.Flusher); ok {
				f.Flush()
			}
		}
		return false
	})
}
