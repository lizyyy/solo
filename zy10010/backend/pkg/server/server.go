package server

import (
	"net/http"
	"strconv"
	"sync"
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

	playbackMu     sync.Mutex
	isPlaybackMode bool
	playbackIdx    int
	playbackSpeed  float64
	playbackStopCh chan struct{}
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
		playbackSpeed:     1.0,
		playbackStopCh:    make(chan struct{}),
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
		api.GET("/snapshots/:index", s.handleGetSnapshotByIndex)
		api.POST("/playback/control", s.handlePlaybackControl)
		api.POST("/scenario/:type", s.handleStartScenario)
		api.POST("/recovery/:type", s.handleRecovery)
		api.POST("/reset", s.handleReset)
	}

	s.router.StaticFile("/", "./frontend/dist/index.html")
	s.router.Static("/assets", "./frontend/dist/assets")
}

func (s *Server) handleHealth(c *gin.Context) {
	c.JSON(200, gin.H{
		"status":    "ok",
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
	s.stopPlayback()
	s.eb.Clear()
	s.sm.Clear()
	c.JSON(200, gin.H{
		"status": "reset",
	})
}

func (s *Server) handleGetSnapshotByIndex(c *gin.Context) {
	indexStr := c.Param("index")
	index, err := strconv.Atoi(indexStr)
	if err != nil {
		c.JSON(400, gin.H{"error": "invalid index"})
		return
	}

	snapshots := s.sm.GetSnapshots()
	if index < 0 || index >= len(snapshots) {
		c.JSON(404, gin.H{"error": "snapshot not found"})
		return
	}

	c.JSON(200, snapshots[index])
}

func (s *Server) handlePlaybackControl(c *gin.Context) {
	var req struct {
		Action string  `json:"action"`
		Index  int     `json:"index"`
		Speed  float64 `json:"speed"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(400, gin.H{"error": err.Error()})
		return
	}

	s.playbackMu.Lock()
	defer s.playbackMu.Unlock()

	snapshots := s.sm.GetSnapshots()
	switch req.Action {
	case "play":
		if len(snapshots) == 0 {
			c.JSON(400, gin.H{"error": "no snapshots available"})
			return
		}
		s.stopPlayback()
		s.isPlaybackMode = true
		if req.Index >= 0 && req.Index < len(snapshots) {
			s.playbackIdx = req.Index
		}
		if req.Speed > 0 {
			s.playbackSpeed = req.Speed
		}
		s.startPlayback()
		c.JSON(200, gin.H{
			"status":      "playing",
			"current_idx": s.playbackIdx,
			"total_idx":   len(snapshots) - 1,
			"speed":       s.playbackSpeed,
		})

	case "pause":
		s.stopPlayback()
		c.JSON(200, gin.H{
			"status":      "paused",
			"current_idx": s.playbackIdx,
		})

	case "step":
		if len(snapshots) == 0 {
			c.JSON(400, gin.H{"error": "no snapshots available"})
			return
		}
		s.stopPlayback()
		s.isPlaybackMode = true
		if req.Index >= 0 && req.Index < len(snapshots) {
			s.playbackIdx = req.Index
		} else if s.playbackIdx < len(snapshots)-1 {
			s.playbackIdx++
		}
		s.broadcastSnapshot(snapshots[s.playbackIdx])
		c.JSON(200, gin.H{
			"status":      "stepped",
			"current_idx": s.playbackIdx,
			"total_idx":   len(snapshots) - 1,
		})

	case "stop":
		s.stopPlayback()
		s.isPlaybackMode = false
		c.JSON(200, gin.H{
			"status": "stopped",
		})

	default:
		c.JSON(400, gin.H{"error": "invalid action"})
	}
}

func (s *Server) stopPlayback() {
	if s.playbackStopCh != nil {
		select {
		case <-s.playbackStopCh:
		default:
			close(s.playbackStopCh)
		}
		s.playbackStopCh = make(chan struct{})
	}
}

func (s *Server) startPlayback() {
	go func() {
		snapshots := s.sm.GetSnapshots()
		if len(snapshots) == 0 {
			return
		}

		ticker := time.NewTicker(time.Duration(1000.0/s.playbackSpeed) * time.Millisecond)
		defer ticker.Stop()

		for {
			select {
			case <-s.playbackStopCh:
				return
			case <-ticker.C:
				s.playbackMu.Lock()
				snapshots = s.sm.GetSnapshots()
				if s.playbackIdx >= len(snapshots) {
					s.playbackMu.Unlock()
					s.stopPlayback()
					return
				}
				snapshot := snapshots[s.playbackIdx]
				s.playbackIdx++
				s.playbackMu.Unlock()

				s.broadcastSnapshot(snapshot)
			}
		}
	}()
}

func (s *Server) broadcastSnapshot(snapshot types.SystemState) {
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
			state := s.sm.TakeSnapshot()
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
