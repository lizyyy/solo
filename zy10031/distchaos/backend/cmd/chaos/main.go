package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"runtime"
	"strconv"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"

	"distchaos/internal/cache"
	"distchaos/internal/chaos"
	"distchaos/internal/config"
	"distchaos/internal/domain"
	"distchaos/internal/event"
	"distchaos/internal/repository"
	"distchaos/internal/service"
)

type App struct {
	orderService  *service.OrderService
	chaosMgr      *service.ChaosState
	eventMgr      *event.EventManager
	eventStore    *event.MemoryEventStore
	inventoryRepo *repository.MemoryInventoryRepo
	orderRepo     *repository.MemoryOrderRepo
	paymentRepo   *repository.MemoryPaymentRepo
	cacheService  *cache.CacheService
	configService *config.ConfigService

	snapshots  map[string]*SystemSnapshot
	snapshotMu sync.RWMutex
}

type SystemSnapshot struct {
	ID          string
	Timestamp   time.Time
	Inventory   map[int64]*domain.Inventory
	Orders      map[int64]*domain.Order
	Payments    map[int64]*domain.Payment
	Description string
}

func main() {
	eventStore := event.NewMemoryEventStore()
	eventManager := event.NewEventManager(eventStore, nil)
	chaosState := service.NewChaosState()

	baseInventoryRepo := repository.NewMemoryInventoryRepo()
	orderRepo := repository.NewMemoryOrderRepo()
	paymentRepo := repository.NewMemoryPaymentRepo()
	compensationRepo := repository.NewMemoryCompensationRepo()

	cacheService := cache.NewCacheService(chaosState)
	configService := config.NewConfigService(chaosState)

	cacheService.SetProductCache(1, 100.0, 100)

	orderService := service.NewOrderService(
		baseInventoryRepo,
		orderRepo,
		paymentRepo,
		compensationRepo,
		eventManager,
		chaosState,
	)

	app := &App{
		orderService:  orderService,
		chaosMgr:      chaosState,
		eventMgr:      eventManager,
		eventStore:    eventStore,
		inventoryRepo: baseInventoryRepo,
		orderRepo:     orderRepo,
		paymentRepo:   paymentRepo,
		cacheService:  cacheService,
		configService: configService,
		snapshots:     make(map[string]*SystemSnapshot),
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
	api.POST("/chaos/reset", app.resetAllChaos)

	api.POST("/snapshots", app.createSnapshot)
	api.GET("/snapshots", app.listSnapshots)
	api.GET("/snapshots/:id", app.getSnapshot)
	api.POST("/snapshots/:id/restore", app.restoreSnapshot)
	api.DELETE("/snapshots/:id", app.deleteSnapshot)

	api.GET("/inventory", app.getInventoryStatus)
	api.GET("/orders", app.listOrders)
	api.GET("/status", app.getSystemStatus)
	api.GET("/sse/events", app.sseEvents)
	api.GET("/cache", app.getCacheStatus)
	api.GET("/config", app.getConfigStatus)

	log.Println("DistChaos server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

type CreateOrderRequestV2 struct {
	domain.CreateOrderRequest
	FailurePoint        string `json:"failure_point"`
	CompensationFailure string `json:"compensation_failure"`
}

func (a *App) createOrder(c *gin.Context) {
	var req CreateOrderRequestV2
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	extendedReq := &service.CreateOrderRequestExtended{
		CreateOrderRequest:  req.CreateOrderRequest,
		FailurePoint:        service.FailurePoint(req.FailurePoint),
		CompensationFailure: service.CompensationFailureMode(req.CompensationFailure),
	}

	resp, err := a.orderService.CreateOrder(c.Request.Context(), extendedReq)
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
	events, err := a.eventMgr.GetTrace(c.Request.Context(), traceID)
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

	params := req.Params
	if params == nil {
		params = make(map[string]interface{})
	}

	switch chaosType {
	case chaos.ChaosTypeConnectionPool:
		a.injectConnectionPoolChaos(c.Request.Context(), duration, params)
	case chaos.ChaosTypeGoroutineLeak:
		a.injectGoroutineLeakChaos(c.Request.Context(), duration, params)
	case chaos.ChaosTypeMessageBacklog:
		a.injectMessageBacklogChaos(c.Request.Context(), duration, params)
	case chaos.ChaosTypeDBLockWait:
		a.injectDBLockChaos(c.Request.Context(), duration, params)
	case chaos.ChaosTypeCacheDirtyData:
		a.injectCacheDirtyChaos(c.Request.Context(), duration, params)
	case chaos.ChaosTypeConfigDrift:
		a.injectConfigDriftChaos(c.Request.Context(), duration, params)
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown chaos type"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "chaos injected",
		"type":     req.Type,
		"duration": duration.String(),
		"params":   req.Params,
	})
}

func (a *App) injectConnectionPoolChaos(ctx context.Context, duration time.Duration, params map[string]interface{}) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.ConnectionPoolBroken = true

	leakCount := 5
	if val, ok := params["leak_count"].(float64); ok {
		leakCount = int(val)
	}

	maxConns := 10
	if val, ok := params["max_conns"].(float64); ok {
		maxConns = int(val)
	}

	a.chaosMgr.ConnectionPoolMax = maxConns
	a.chaosMgr.ConnectionPoolCurrent = 0
	a.chaosMgr.LeakedConnections = make([]string, 0)

	for i := 0; i < leakCount; i++ {
		connID := fmt.Sprintf("conn-%d-%d", time.Now().UnixNano(), i)
		a.chaosMgr.ConnectionPoolCurrent++
		a.chaosMgr.LeakedConnections = append(a.chaosMgr.LeakedConnections, connID)

		evt := event.Event{
			ID:      uuid.New().String(),
			Type:    event.EventTypeConnectionExhausted,
			Status:  event.EventStatusPending,
			Service: "connection-pool",
			Payload: map[string]interface{}{
				"connection_id":       connID,
				"current_connections": a.chaosMgr.ConnectionPoolCurrent,
				"max_connections":     a.chaosMgr.ConnectionPoolMax,
				"phase":               "leaking",
			},
		}
		a.eventMgr.Record(ctx, evt)

		time.Sleep(100 * time.Millisecond)
	}
	a.chaosMgr.Mu.Unlock()

	a.chaosMgr.Mu.Lock()
	a.chaosMgr.ConnectionPoolCurrent = leakCount
	a.chaosMgr.Mu.Unlock()

	go func() {
		time.Sleep(duration)
		a.stopConnectionPoolChaos(context.Background())
	}()
}

func (a *App) stopConnectionPoolChaos(ctx context.Context) {
	a.chaosMgr.Mu.Lock()
	defer a.chaosMgr.Mu.Unlock()

	a.chaosMgr.ConnectionPoolBroken = false
	a.chaosMgr.ConnectionPoolCurrent = 0
	a.chaosMgr.LeakedConnections = make([]string, 0)

	evt := event.Event{
		ID:      uuid.New().String(),
		Type:    event.EventTypeChaosRecover,
		Status:  event.EventStatusSuccess,
		Service: "connection-pool",
		Payload: map[string]interface{}{
			"type":   "connection_pool",
			"status": "recovered",
			"action": "connections_released",
		},
	}
	a.eventMgr.Record(ctx, evt)
}

func (a *App) injectGoroutineLeakChaos(ctx context.Context, duration time.Duration, params map[string]interface{}) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.GoroutineLeakActive = true

	leakCount := 100
	if val, ok := params["leak_count"].(float64); ok {
		leakCount = int(val)
	}

	initialGoroutines := runtime.NumGoroutine()
	a.chaosMgr.StopGoroutineChans = make([]chan struct{}, 0)
	a.chaosMgr.Mu.Unlock()

	for i := 0; i < leakCount; i++ {
		stopChan := make(chan struct{})
		a.chaosMgr.Mu.Lock()
		a.chaosMgr.StopGoroutineChans = append(a.chaosMgr.StopGoroutineChans, stopChan)
		a.chaosMgr.Mu.Unlock()

		go func(id int) {
			atomic.AddInt32(&a.chaosMgr.LeakedGoroutines, 1)
			for {
				select {
				case <-stopChan:
					atomic.AddInt32(&a.chaosMgr.LeakedGoroutines, -1)
					return
				case <-ctx.Done():
					return
				default:
					time.Sleep(100 * time.Millisecond)
				}
			}
		}(i)

		evt := event.Event{
			ID:      uuid.New().String(),
			Type:    event.EventTypeGoroutineLeak,
			Status:  event.EventStatusPending,
			Service: "goroutine-leak",
			Payload: map[string]interface{}{
				"goroutine_id":     i,
				"leaked_count":     atomic.LoadInt32(&a.chaosMgr.LeakedGoroutines),
				"total_goroutines": runtime.NumGoroutine(),
				"initial_count":    initialGoroutines,
				"phase":            "leaking",
			},
		}
		a.eventMgr.Record(ctx, evt)

		time.Sleep(10 * time.Millisecond)
	}

	go func() {
		time.Sleep(duration)
		a.stopGoroutineLeakChaos(context.Background())
	}()
}

func (a *App) stopGoroutineLeakChaos(ctx context.Context) {
	a.chaosMgr.Mu.Lock()
	defer a.chaosMgr.Mu.Unlock()

	a.chaosMgr.GoroutineLeakActive = false

	for _, ch := range a.chaosMgr.StopGoroutineChans {
		select {
		case ch <- struct{}{}:
		default:
			close(ch)
		}
	}
	a.chaosMgr.StopGoroutineChans = make([]chan struct{}, 0)

	evt := event.Event{
		ID:      uuid.New().String(),
		Type:    event.EventTypeChaosRecover,
		Status:  event.EventStatusSuccess,
		Service: "goroutine-leak",
		Payload: map[string]interface{}{
			"type":   "goroutine_leak",
			"status": "recovered",
			"action": "goroutines_stopped",
		},
	}
	a.eventMgr.Record(ctx, evt)
}

func (a *App) injectMessageBacklogChaos(ctx context.Context, duration time.Duration, params map[string]interface{}) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.MessageBacklogActive = true
	a.chaosMgr.Mu.Unlock()

	backlogSize := 1000
	if val, ok := params["backlog_size"].(float64); ok {
		backlogSize = int(val)
	}

	processDelay := 100 * time.Millisecond
	if val, ok := params["process_delay"].(float64); ok {
		processDelay = time.Duration(val) * time.Millisecond
	}

	for i := 0; i < backlogSize; i++ {
		evt := event.Event{
			ID:      uuid.New().String(),
			Type:    event.EventTypeMessageBacklog,
			Status:  event.EventStatusPending,
			Service: "message-queue",
			Payload: map[string]interface{}{
				"message_id":    i,
				"backlog_size":  i + 1,
				"process_delay": processDelay.String(),
				"phase":         "queued",
			},
		}
		a.eventMgr.Record(ctx, evt)

		if i%100 == 0 {
			time.Sleep(processDelay)
		}
	}

	go func() {
		time.Sleep(duration)
		a.stopMessageBacklogChaos(context.Background())
	}()
}

func (a *App) stopMessageBacklogChaos(ctx context.Context) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.MessageBacklogActive = false
	a.chaosMgr.Mu.Unlock()

	evt := event.Event{
		ID:      uuid.New().String(),
		Type:    event.EventTypeChaosRecover,
		Status:  event.EventStatusSuccess,
		Service: "message-queue",
		Payload: map[string]interface{}{
			"type":   "message_backlog",
			"status": "recovered",
			"action": "messages_processed",
		},
	}
	a.eventMgr.Record(ctx, evt)
}

func (a *App) injectDBLockChaos(ctx context.Context, duration time.Duration, params map[string]interface{}) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.DBLockWaiting = true
	a.chaosMgr.Mu.Unlock()

	lockCount := 5
	if val, ok := params["lock_count"].(float64); ok {
		lockCount = int(val)
	}

	lockDuration := 30 * time.Second
	if val, ok := params["lock_duration"].(float64); ok {
		lockDuration = time.Duration(val) * time.Second
	}

	var wg sync.WaitGroup
	lockChans := make([]chan struct{}, lockCount)

	for i := 0; i < lockCount; i++ {
		lockChans[i] = make(chan struct{})
		wg.Add(1)

		go func(id int, done chan struct{}) {
			defer wg.Done()

			evt := event.Event{
				ID:      uuid.New().String(),
				Type:    event.EventTypeDBLockWait,
				Status:  event.EventStatusPending,
				Service: "database-lock",
				Payload: map[string]interface{}{
					"lock_id":       id,
					"lock_duration": lockDuration.String(),
					"status":        "waiting",
					"phase":         "waiting_for_lock",
				},
			}
			a.eventMgr.Record(ctx, evt)

			select {
			case <-done:
				evt := event.Event{
					ID:      uuid.New().String(),
					Type:    event.EventTypeDBLockWait,
					Status:  event.EventStatusSuccess,
					Service: "database-lock",
					Payload: map[string]interface{}{
						"lock_id": id,
						"status":  "released",
						"phase":   "lock_released",
					},
				}
				a.eventMgr.Record(ctx, evt)
			case <-ctx.Done():
				return
			case <-time.After(lockDuration):
				evt := event.Event{
					ID:      uuid.New().String(),
					Type:    event.EventTypeDBLockWait,
					Status:  event.EventStatusFailed,
					Service: "database-lock",
					Payload: map[string]interface{}{
						"lock_id": id,
						"error":   "lock wait timeout",
						"phase":   "timeout",
					},
				}
				a.eventMgr.Record(ctx, evt)
			}
		}(i, lockChans[i])
	}

	for _, ch := range lockChans {
		close(ch)
	}
	wg.Wait()

	go func() {
		time.Sleep(duration)
		a.stopDBLockChaos(context.Background())
	}()
}

func (a *App) stopDBLockChaos(ctx context.Context) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.DBLockWaiting = false
	a.chaosMgr.Mu.Unlock()

	evt := event.Event{
		ID:      uuid.New().String(),
		Type:    event.EventTypeChaosRecover,
		Status:  event.EventStatusSuccess,
		Service: "database-lock",
		Payload: map[string]interface{}{
			"type":   "db_lock_wait",
			"status": "recovered",
			"action": "locks_released",
		},
	}
	a.eventMgr.Record(ctx, evt)
}

func (a *App) injectCacheDirtyChaos(ctx context.Context, duration time.Duration, params map[string]interface{}) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.CacheDirty = true

	dirtyCount := 50
	if val, ok := params["dirty_count"].(float64); ok {
		dirtyCount = int(val)
	}

	for i := 0; i < dirtyCount; i++ {
		key := fmt.Sprintf("product:%d", i)
		correctValue := map[string]interface{}{
			"id":      i,
			"price":   100.0 + float64(i),
			"stock":   100 - i,
			"version": 1,
		}
		dirtyValue := map[string]interface{}{
			"id":      i,
			"price":   9999.0,
			"stock":   0,
			"version": 999,
		}

		a.chaosMgr.CacheOriginalData[key] = correctValue
		a.chaosMgr.CacheDirtyData[key] = dirtyValue

		evt := event.Event{
			ID:      uuid.New().String(),
			Type:    event.EventTypeCacheDirty,
			Status:  event.EventStatusPending,
			Service: "cache-simulator",
			Payload: map[string]interface{}{
				"cache_key":     key,
				"correct_value": correctValue,
				"dirty_value":   dirtyValue,
				"phase":         "dirty_injected",
			},
		}
		a.eventMgr.Record(ctx, evt)
	}
	a.chaosMgr.Mu.Unlock()

	go func() {
		time.Sleep(duration)
		a.stopCacheDirtyChaos(context.Background())
	}()
}

func (a *App) stopCacheDirtyChaos(ctx context.Context) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.CacheDirty = false

	for key, correctValue := range a.chaosMgr.CacheOriginalData {
		a.chaosMgr.CacheDirtyData[key] = correctValue
	}

	evt := event.Event{
		ID:      uuid.New().String(),
		Type:    event.EventTypeChaosRecover,
		Status:  event.EventStatusSuccess,
		Service: "cache-simulator",
		Payload: map[string]interface{}{
			"type":   "cache_dirty_data",
			"status": "recovered",
			"action": "cache_restored",
		},
	}
	a.eventMgr.Record(ctx, evt)
	a.chaosMgr.Mu.Unlock()
}

func (a *App) injectConfigDriftChaos(ctx context.Context, duration time.Duration, params map[string]interface{}) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.ConfigDrifted = true

	configDrifts := map[string]struct {
		original interface{}
		drifted  interface{}
	}{
		"feature.flag.inventory_check": {
			original: true,
			drifted:  false,
		},
		"order.processing.timeout": {
			original: "1m",
			drifted:  "1ms",
		},
		"service.retry.count": {
			original: 3,
			drifted:  0,
		},
		"cache.ttl.seconds": {
			original: 300,
			drifted:  1,
		},
		"db.connection.timeout": {
			original: "30s",
			drifted:  "1ms",
		},
		"log.level": {
			original: "info",
			drifted:  "panic",
		},
	}

	for key, pair := range configDrifts {
		a.chaosMgr.OriginalConfigs[key] = pair.original
		a.chaosMgr.DriftedConfigs[key] = pair.drifted

		evt := event.Event{
			ID:      uuid.New().String(),
			Type:    event.EventTypeConfigDrift,
			Status:  event.EventStatusPending,
			Service: "config-store",
			Payload: map[string]interface{}{
				"config_key":     key,
				"original_value": pair.original,
				"drifted_value":  pair.drifted,
				"phase":          "drifted",
				"impact":         "配置漂移可能导致业务逻辑异常",
			},
		}
		a.eventMgr.Record(ctx, evt)
	}

	a.chaosMgr.Mu.Unlock()

	go func() {
		time.Sleep(duration)
		a.stopConfigDriftChaos(context.Background())
	}()
}

func (a *App) stopConfigDriftChaos(ctx context.Context) {
	a.chaosMgr.Mu.Lock()
	a.chaosMgr.ConfigDrifted = false

	for key, originalValue := range a.chaosMgr.OriginalConfigs {
		a.chaosMgr.DriftedConfigs[key] = originalValue
	}

	evt := event.Event{
		ID:      uuid.New().String(),
		Type:    event.EventTypeChaosRecover,
		Status:  event.EventStatusSuccess,
		Service: "config-store",
		Payload: map[string]interface{}{
			"type":   "config_drift",
			"status": "recovered",
			"action": "config_restored",
		},
	}
	a.eventMgr.Record(ctx, evt)
	a.chaosMgr.Mu.Unlock()
}

func (a *App) stopChaos(c *gin.Context) {
	chaosType := chaos.ChaosType(c.Param("type"))

	switch chaosType {
	case chaos.ChaosTypeConnectionPool:
		a.stopConnectionPoolChaos(c.Request.Context())
	case chaos.ChaosTypeGoroutineLeak:
		a.stopGoroutineLeakChaos(c.Request.Context())
	case chaos.ChaosTypeMessageBacklog:
		a.stopMessageBacklogChaos(c.Request.Context())
	case chaos.ChaosTypeDBLockWait:
		a.stopDBLockChaos(c.Request.Context())
	case chaos.ChaosTypeCacheDirtyData:
		a.stopCacheDirtyChaos(c.Request.Context())
	case chaos.ChaosTypeConfigDrift:
		a.stopConfigDriftChaos(c.Request.Context())
	default:
		c.JSON(http.StatusBadRequest, gin.H{"error": "unknown chaos type"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "chaos stopped",
		"type":    chaosType,
	})
}

func (a *App) resetAllChaos(c *gin.Context) {
	ctx := c.Request.Context()

	a.stopConnectionPoolChaos(ctx)
	a.stopGoroutineLeakChaos(ctx)
	a.stopMessageBacklogChaos(ctx)
	a.stopDBLockChaos(ctx)
	a.stopCacheDirtyChaos(ctx)
	a.stopConfigDriftChaos(ctx)

	a.chaosMgr.SetOrderFailurePoint(service.FailurePointNone)
	a.chaosMgr.SetCompensationFailure(service.CompensationFailureNone)

	c.JSON(http.StatusOK, gin.H{
		"message": "all chaos scenarios stopped and settings reset",
	})
}

func (a *App) getChaosStatus(c *gin.Context) {
	status := a.orderService.GetFullStatus()
	status["runtime_goroutines"] = runtime.NumGoroutine()
	status["chaos_state"] = map[string]interface{}{
		"connection_pool_broken": a.chaosMgr.ConnectionPoolBroken,
		"goroutine_leak_active":  a.chaosMgr.GoroutineLeakActive,
		"db_lock_waiting":        a.chaosMgr.DBLockWaiting,
		"cache_dirty":            a.chaosMgr.CacheDirty,
		"config_drifted":         a.chaosMgr.ConfigDrifted,
		"message_backlog_active": a.chaosMgr.MessageBacklogActive,
	}
	c.JSON(http.StatusOK, status)
}

func (a *App) getCacheStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"is_dirty":        a.chaosMgr.CacheDirty,
		"dirty_keys":      len(a.chaosMgr.CacheDirtyData),
		"original_keys":   len(a.chaosMgr.CacheOriginalData),
		"effective_cache": a.cacheService.GetAll(),
	})
}

func (a *App) getConfigStatus(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"is_drifted":       a.chaosMgr.ConfigDrifted,
		"drifted_keys":     len(a.chaosMgr.DriftedConfigs),
		"original_keys":    len(a.chaosMgr.OriginalConfigs),
		"effective_config": a.configService.GetAll(),
	})
}

func (a *App) createSnapshot(c *gin.Context) {
	var req struct {
		Description string `json:"description"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		req.Description = "manual snapshot"
	}

	snapshotID := uuid.New().String()

	a.snapshotMu.Lock()
	defer a.snapshotMu.Unlock()

	inventoryCopy := make(map[int64]*domain.Inventory)
	a.inventoryRepo.CopyTo(inventoryCopy)

	ordersCopy := make(map[int64]*domain.Order)
	a.orderRepo.CopyTo(ordersCopy)

	paymentsCopy := make(map[int64]*domain.Payment)
	a.paymentRepo.CopyTo(paymentsCopy)

	snapshot := &SystemSnapshot{
		ID:          snapshotID,
		Timestamp:   time.Now(),
		Inventory:   inventoryCopy,
		Orders:      ordersCopy,
		Payments:    paymentsCopy,
		Description: req.Description,
	}

	a.snapshots[snapshotID] = snapshot

	evt := event.Event{
		ID:      uuid.New().String(),
		Type:    event.EventType("snapshot_created"),
		Status:  event.EventStatusSuccess,
		Service: "snapshot-manager",
		Payload: map[string]interface{}{
			"snapshot_id":     snapshotID,
			"description":     req.Description,
			"inventory_count": len(inventoryCopy),
			"orders_count":    len(ordersCopy),
			"payments_count":  len(paymentsCopy),
		},
	}
	a.eventMgr.Record(c.Request.Context(), evt)

	c.JSON(http.StatusOK, gin.H{
		"snapshot_id": snapshotID,
		"message":     "snapshot created",
	})
}

func (a *App) listSnapshots(c *gin.Context) {
	a.snapshotMu.RLock()
	defer a.snapshotMu.RUnlock()

	snapshots := make([]map[string]interface{}, 0)
	for id, snap := range a.snapshots {
		snapshots = append(snapshots, map[string]interface{}{
			"id":              id,
			"timestamp":       snap.Timestamp,
			"description":     snap.Description,
			"inventory_count": len(snap.Inventory),
			"orders_count":    len(snap.Orders),
		})
	}

	c.JSON(http.StatusOK, gin.H{
		"snapshots": snapshots,
		"count":     len(snapshots),
	})
}

func (a *App) getSnapshot(c *gin.Context) {
	snapshotID := c.Param("id")

	a.snapshotMu.RLock()
	snapshot, exists := a.snapshots[snapshotID]
	a.snapshotMu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "snapshot not found"})
		return
	}

	c.JSON(http.StatusOK, snapshot)
}

func (a *App) restoreSnapshot(c *gin.Context) {
	snapshotID := c.Param("id")

	a.snapshotMu.RLock()
	snapshot, exists := a.snapshots[snapshotID]
	a.snapshotMu.RUnlock()

	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "snapshot not found"})
		return
	}

	a.inventoryRepo.RestoreFrom(snapshot.Inventory)
	a.orderRepo.RestoreFrom(snapshot.Orders)
	a.paymentRepo.RestoreFrom(snapshot.Payments)

	evt := event.Event{
		ID:      uuid.New().String(),
		Type:    event.EventType("snapshot_restored"),
		Status:  event.EventStatusSuccess,
		Service: "snapshot-manager",
		Payload: map[string]interface{}{
			"snapshot_id": snapshotID,
			"description": snapshot.Description,
		},
	}
	a.eventMgr.Record(c.Request.Context(), evt)

	c.JSON(http.StatusOK, gin.H{
		"message":     "system state restored from snapshot",
		"snapshot_id": snapshotID,
	})
}

func (a *App) deleteSnapshot(c *gin.Context) {
	snapshotID := c.Param("id")

	a.snapshotMu.Lock()
	delete(a.snapshots, snapshotID)
	a.snapshotMu.Unlock()

	c.JSON(http.StatusOK, gin.H{
		"message":     "snapshot deleted",
		"snapshot_id": snapshotID,
	})
}

func (a *App) getInventoryStatus(c *gin.Context) {
	status := a.inventoryRepo.GetStatus()
	c.JSON(http.StatusOK, status)
}

func (a *App) listOrders(c *gin.Context) {
	orders := a.orderRepo.GetAll()
	c.JSON(http.StatusOK, gin.H{
		"orders": orders,
		"count":  len(orders),
	})
}

func (a *App) getSystemStatus(c *gin.Context) {
	status := map[string]interface{}{
		"service":    "distchaos",
		"status":     "running",
		"timestamp":  time.Now().Unix(),
		"goroutines": runtime.NumGoroutine(),
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

	ticker := time.NewTicker(2 * time.Second)
	defer ticker.Stop()

	lastEventCount := 0

	for {
		select {
		case <-c.Request.Context().Done():
			return
		case <-ticker.C:
			ctx, cancel := context.WithTimeout(context.Background(), 1*time.Second)
			events, err := a.eventMgr.GetRecent(ctx, 20)
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

				c.Writer.Write([]byte("data: " + string(data) + "\n\n"))
				flusher.Flush()
			}
		}
	}
}
