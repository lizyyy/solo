package server

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"

	"system-chaos-visualizer/backend/pkg/eventbus"
	"system-chaos-visualizer/backend/pkg/recovery"
	"system-chaos-visualizer/backend/pkg/scenarios"
	"system-chaos-visualizer/backend/pkg/statemanager"
	"system-chaos-visualizer/backend/pkg/types"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

type Server struct {
	router            *gin.Engine
	sm                *statemanager.StateManager
	eb                *eventbus.EventBus
	recovery          *recovery.RecoveryService
	connPoolScenario  *scenarios.ConnectionPoolScenario
	msgQueueScenario  *scenarios.MessageQueueScenario
	goroutineScenario *scenarios.GoroutineLeakScenario
	dbLockScenario    *scenarios.DbLockScenario
	cacheScenario     *scenarios.CacheDirtyScenario
	configScenario    *scenarios.ConfigDriftScenario
}

func NewServer() *Server {
	eb := eventbus.NewEventBus()
	sm := statemanager.NewStateManager(eb)

	return &Server{
		router:            gin.Default(),
		sm:                sm,
		eb:                eb,
		recovery:          recovery.NewRecoveryService(sm, eb),
		connPoolScenario:  scenarios.NewConnectionPoolScenario(sm, eb),
		msgQueueScenario:  scenarios.NewMessageQueueScenario(sm, eb),
		goroutineScenario: scenarios.NewGoroutineLeakScenario(sm, eb),
		dbLockScenario:    scenarios.NewDbLockScenario(sm, eb),
		cacheScenario:     scenarios.NewCacheDirtyScenario(sm, eb),
		configScenario:    scenarios.NewConfigDriftScenario(sm, eb),
	}
}

func (s *Server) SetupRoutes() {
	s.router.GET("/health", s.handleHealth)
	s.router.GET("/ws", s.handleWebSocket)

	api := s.router.Group("/api")
	{
		api.GET("/state", s.handleGetState)
		api.GET("/events", s.handleGetEvents)
		api.GET("/snapshots", s.handleGetSnapshots)
		api.POST("/scenario/:type", s.handleStartScenario)
		api.POST("/recovery/:type", s.handleRecovery)
		api.POST("/reset", s.handleReset)
	}

	s.router.Static("/", "./frontend/dist")
}

func (s *Server) handleHealth(c *gin.Context) {
	c.JSON(200, gin.H{
		"status": "ok",
		"timestamp": time.Now(),
	})
}

func (s *Server) handleGetState(c *gin.Context) {
	state := types.SystemState{
		Timestamp:   time.Now(),
		Connections: s.sm.GetConnections(),
		Messages:    s.sm.GetMessages(),
		Goroutines:  s.sm.GetGoroutines(),
		DbLocks:     s.sm.GetDbLocks(),
		Cache:       s.sm.GetCache(),
		Config:      s.sm.GetConfig(),
		Metrics:     s.sm.GetMetrics(),
	}
	c.JSON(200, state)
}

func (s *Server) handleGetEvents(c *gin.Context) {
	events := s.eb.GetAllEvents()
	c.JSON(200, events)
}

func (s *Server) handleGetSnapshots(c *gin.Context) {
	snapshots := s.sm.GetSnapshots()
	c.JSON(200, snapshots)
}

func (s *Server) handleStartScenario(c *gin.Context) {
	scenarioType := c.Param("type")
	duration := 30 * time.Second

	var req struct {
		Duration   int                    `json:"duration"`
		Parameters map[string]interface{} `json:"parameters"`
	}
	if err := c.ShouldBindJSON(&req); err == nil && req.Duration > 0 {
		duration = time.Duration(req.Duration) * time.Second
	}

	switch scenarioType {
	case "connection_pool":
		poolSize := 10
		if p, ok := req.Parameters["pool_size"].(float64); ok {
			poolSize = int(p)
		}
		s.connPoolScenario.Start(poolSize, duration)
	case "message_queue":
		backlogSize := 50
		if p, ok := req.Parameters["backlog_size"].(float64); ok {
			backlogSize = int(p)
		}
		s.msgQueueScenario.Start(backlogSize, duration)
	case "goroutine_leak":
		leakRate := 0.3
		if p, ok := req.Parameters["leak_rate"].(float64); ok {
			leakRate = p
		}
		s.goroutineScenario.Start(leakRate, duration)
	case "db_lock":
		contentionRate := 0.5
		if p, ok := req.Parameters["contention_rate"].(float64); ok {
			contentionRate = p
		}
		s.dbLockScenario.Start(contentionRate, duration)
	case "cache_dirty":
		dirtyRate := 0.3
		if p, ok := req.Parameters["dirty_rate"].(float64); ok {
			dirtyRate = p
		}
		s.cacheScenario.Start(dirtyRate, duration)
	case "config_drift":
		driftRate := 0.4
		if p, ok := req.Parameters["drift_rate"].(float64); ok {
			driftRate = p
		}
		s.configScenario.Start(driftRate, duration)
	}

	c.JSON(200, gin.H{
		"status":   "started",
		"scenario": scenarioType,
		"duration": duration.Seconds(),
	})
}

func (s *Server) handleRecovery(c *gin.Context) {
	recoveryType := c.Param("type")

	switch recoveryType {
	case "connection_pool":
		s.recovery.RecoverConnectionPool()
	case "message_queue":
		s.recovery.RecoverMessageQueue()
	case "goroutine":
		s.recovery.RecoverGoroutines()
	case "db_lock":
		s.recovery.RecoverDbLocks()
	case "cache":
		s.recovery.RecoverCache()
	case "config":
		s.recovery.RecoverConfig()
	case "all":
		s.recovery.RecoverAll()
	}

	c.JSON(200, gin.H{
		"status": "recovery_started",
		"type":   recoveryType,
	})
}

func (s *Server) handleReset(c *gin.Context) {
	s.eb.Clear()
	s.sm.Clear()
	c.JSON(200, gin.H{
		"status": "reset",
	})
}

func (s *Server) handleWebSocket(c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		return
	}
	defer conn.Close()

	subID, eventCh := s.eb.Subscribe()
	defer s.eb.Unsubscribe(subID)

	snapshotTicker := time.NewTicker(1 * time.Second)
	defer snapshotTicker.Stop()

	for {
		select {
		case event := <-eventCh:
			if err := conn.WriteJSON(gin.H{
				"type":  "event",
				"event": event,
			}); err != nil {
				return
			}
		case <-snapshotTicker.C:
			state := types.SystemState{
				Timestamp:   time.Now(),
				Connections: s.sm.GetConnections(),
				Messages:    s.sm.GetMessages(),
				Goroutines:  s.sm.GetGoroutines(),
				DbLocks:     s.sm.GetDbLocks(),
				Cache:       s.sm.GetCache(),
				Config:      s.sm.GetConfig(),
				Metrics:     s.sm.GetMetrics(),
			}
			if err := conn.WriteJSON(gin.H{
				"type":  "state",
				"state": state,
			}); err != nil {
				return
			}
		}
	}
}

func (s *Server) Run(addr string) error {
	return s.router.Run(addr)
}
