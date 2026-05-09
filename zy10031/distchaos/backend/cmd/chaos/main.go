package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"time"
	
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	
	"distchaos/internal/chaos"
	"distchaos/internal/domain"
	"distchaos/internal/event"
	"distchaos/internal/repository"
	"distchaos/internal/service"
)

type App struct {
	orderService  *service.OrderService
	chaosManager  *chaos.ChaosManager
	eventManager  *event.EventManager
	eventStore    *event.MemoryEventStore
}

func main() {
	eventStore := event.NewMemoryEventStore()
	eventManager := event.NewEventManager(eventStore, nil)
	chaosManager := chaos.NewChaosManager(eventManager)
	
	baseInventoryRepo := repository.NewMemoryInventoryRepo()
	orderRepo := repository.NewMemoryOrderRepo()
	paymentRepo := repository.NewMemoryPaymentRepo()
	compensationRepo := repository.NewMemoryCompensationRepo()
	
	orderService := service.NewOrderService(
		baseInventoryRepo,
		orderRepo,
		paymentRepo,
		compensationRepo,
		eventManager,
		chaosManager,
	)
	
	app := &App{
		orderService: orderService,
		chaosManager: chaosManager,
		eventManager: eventManager,
		eventStore:   eventStore,
	}
	
	r := gin.Default()
	
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))
	
	api := r.Group("/api/v1")
	
	api.POST("/orders", app.createOrder)
	api.GET("/orders/:id/trace", app.getOrderTrace)
	api.GET("/events", app.getEvents)
	api.GET("/events/:traceId", app.getEventsByTrace)
	api.POST("/events/:traceId/replay", app.replayEvents)
	
	api.POST("/chaos/inject", app.injectChaos)
	api.POST("/chaos/stop/:type", app.stopChaos)
	api.GET("/chaos/status", app.getChaosStatus)
	
	api.GET("/status", app.getSystemStatus)
	api.GET("/sse/events", app.sseEvents)
	
	log.Println("DistChaos server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func (a *App) createOrder(c *gin.Context) {
	var req domain.CreateOrderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	resp, err := a.orderService.CreateOrder(c.Request.Context(), &req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, resp)
}

func (a *App) getOrderTrace(c *gin.Context) {
	traceID := c.Param("id")
	events, err := a.orderService.GetOrderTrace(c.Request.Context(), traceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"trace_id": traceID,
		"events":   events,
	})
}

func (a *App) getEvents(c *gin.Context) {
	limit := 100
	if l := c.Query("limit"); l != "" {
		if n, err := strconv.Atoi(l); err == nil {
			limit = n
		}
	}
	
	events, err := a.orderService.GetRecentEvents(c.Request.Context(), limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"events": events,
		"count":  len(events),
	})
}

func (a *App) getEventsByTrace(c *gin.Context) {
	traceID := c.Param("traceId")
	events, err := a.eventManager.GetTrace(c.Request.Context(), traceID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"trace_id": traceID,
		"events":   events,
		"count":    len(events),
	})
}

func (a *App) replayEvents(c *gin.Context) {
	traceID := c.Param("traceId")
	if err := a.orderService.ReplayEvents(c.Request.Context(), traceID); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message":   "events replayed successfully",
		"trace_id":  traceID,
		"replay_id": uuid.New().String(),
	})
}

type ChaosRequest struct {
	Type     string                 `json:"type" binding:"required"`
	Duration string                 `json:"duration"`
	Params   map[string]interface{} `json:"params"`
}

func (a *App) injectChaos(c *gin.Context) {
	var req ChaosRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	
	duration := 30 * time.Second
	if req.Duration != "" {
		if d, err := time.ParseDuration(req.Duration); err == nil {
			duration = d
		}
	}
	
	chaosType := chaos.ChaosType(req.Type)
	if err := a.chaosManager.InjectScenario(c.Request.Context(), chaosType, duration, req.Params); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message":  "chaos injected",
		"type":     req.Type,
		"duration": duration.String(),
		"params":   req.Params,
	})
}

func (a *App) stopChaos(c *gin.Context) {
	chaosType := chaos.ChaosType(c.Param("type"))
	if err := a.chaosManager.StopScenario(c.Request.Context(), chaosType); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	
	c.JSON(http.StatusOK, gin.H{
		"message": "chaos stopped",
		"type":    chaosType,
	})
}

func (a *App) getChaosStatus(c *gin.Context) {
	status := a.chaosManager.GetStatus()
	c.JSON(http.StatusOK, status)
}

func (a *App) getSystemStatus(c *gin.Context) {
	status := map[string]interface{}{
		"service": "distchaos",
		"status":  "running",
		"timestamp": time.Now().Unix(),
	}
	c.JSON(http.StatusOK, status)
}

func (a *App) sseEvents(c *gin.Context) {
	c.Writer.Header().Set("Content-Type", "text/event-stream")
	c.Writer.Header().Set("Cache-Control", "no-cache")
	c.Writer.Header().Set("Connection", "keep-alive")
	c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
	
	flusher, ok := c.Writer.(http.Flusher)
	if !ok {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Streaming not supported"})
		return
	}
	
	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()
	
	lastEventCount := 0
	
	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
			events, err := a.eventManager.GetRecent(ctx, 10)
			cancel()
			
			if err != nil {
				continue
			}
			
			if len(events) != lastEventCount {
				lastEventCount = len(events)
				
				data, err := json.Marshal(events)
				if err != nil {
					continue
				}
				
				c.SSEvent("message", string(data))
				flusher.Flush()
			}
		}
	}
}
