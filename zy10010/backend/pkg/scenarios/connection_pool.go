package scenarios

import (
	"math/rand"
	"sync"
	"time"

	"system-chaos-visualizer/backend/pkg/eventbus"
	"system-chaos-visualizer/backend/pkg/statemanager"
	"system-chaos-visualizer/backend/pkg/types"

	"github.com/google/uuid"
)

type ConnectionPoolScenario struct {
	mu          sync.Mutex
	sm          *statemanager.StateManager
	eb          *eventbus.EventBus
	maxPoolSize int
	connections map[string]*simConnection
	stopCh      chan struct{}
	running     bool
}

type simConnection struct {
	ID             string
	Active         bool
	LastUsed       time.Time
	MessageCount   int
	ReconnectCount int
}

func NewConnectionPoolScenario(sm *statemanager.StateManager, eb *eventbus.EventBus) *ConnectionPoolScenario {
	return &ConnectionPoolScenario{
		sm:          sm,
		eb:          eb,
		maxPoolSize: 10,
		connections: make(map[string]*simConnection),
		stopCh:      make(chan struct{}),
	}
}

func (s *ConnectionPoolScenario) Start(poolSize int, duration time.Duration) {
	s.mu.Lock()
	s.maxPoolSize = poolSize
	s.sm.UpdateMetrics(func(m *types.SystemMetrics) {
		m.ConnectionPoolSize = poolSize
	})
	s.running = true
	s.mu.Unlock()

	go func() {
		activityTicker := time.NewTicker(100 * time.Millisecond)
		defer activityTicker.Stop()

		reconnectTicker := time.NewTicker(2 * time.Second)
		defer reconnectTicker.Stop()

		endTime := time.Now().Add(duration)
		for time.Now().Before(endTime) {
			select {
			case <-s.stopCh:
				return
			case <-activityTicker.C:
				s.simulateActivity()
			case <-reconnectTicker.C:
				s.simulateReconnect()
			}
		}
	}()
}

func (s *ConnectionPoolScenario) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.running {
		close(s.stopCh)
		s.stopCh = make(chan struct{})
		s.running = false
		s.connections = make(map[string]*simConnection)
	}
}

func (s *ConnectionPoolScenario) simulateActivity() {
	s.mu.Lock()
	defer s.mu.Unlock()

	if rand.Float64() < 0.7 {
		if len(s.connections) < s.maxPoolSize {
			s.createConnection()
		} else {
			s.eb.Publish(types.Event{
				Type:     types.EventTypeConnectionPoolExhausted,
				Severity: types.SeverityError,
				Source:   "connection_pool",
				Message:  "Connection pool exhausted",
				Data: map[string]interface{}{
					"pool_size":    s.maxPoolSize,
					"active_conns": len(s.connections),
				},
			})
		}
	}

	if rand.Float64() < 0.3 {
		s.releaseOldConnection()
	}

	s.sm.UpdateMetrics(func(m *types.SystemMetrics) {
		m.ConnectionPoolUsage = (len(s.connections) * 100) / s.maxPoolSize
	})
}

func (s *ConnectionPoolScenario) simulateReconnect() {
	s.mu.Lock()
	defer s.mu.Unlock()

	for id, conn := range s.connections {
		if rand.Float64() < 0.5 {
			connID := id
			connection := conn
			s.eb.Publish(types.Event{
				Type:     types.EventTypeReconnectAttempt,
				Severity: types.SeverityWarning,
				Source:   "connection_pool",
				Message:  "Attempting to reconnect",
				Data: map[string]interface{}{
					"connection_id": connID,
				},
			})

			connection.LastUsed = time.Now()
			s.sm.UpdateConnection(connID, types.ConnectionState{
				Status:         "reconnecting",
				ReconnectCount: connection.ReconnectCount,
			})

			go func(cid string) {
				time.Sleep(time.Duration(rand.Intn(500)) * time.Millisecond)
				s.mu.Lock()
				defer s.mu.Unlock()
				if c, exists := s.connections[cid]; exists {
					c.LastUsed = time.Now()
					s.sm.UpdateConnection(cid, types.ConnectionState{
						Status:         "active",
						LastActiveAt:   time.Now(),
						ReconnectCount: c.ReconnectCount + 1,
					})
					s.eb.Publish(types.Event{
						Type:     types.EventTypeReconnected,
						Severity: types.SeverityInfo,
						Source:   "connection_pool",
						Message:  "Reconnected successfully",
						Data: map[string]interface{}{
							"connection_id": cid,
						},
					})
				}
			}(connID)
		}
	}
}

func (s *ConnectionPoolScenario) createConnection() {
	id := uuid.New().String()
	conn := &simConnection{
		ID:           id,
		Active:       true,
		LastUsed:     time.Now(),
		MessageCount: 0,
	}
	s.connections[id] = conn
	s.sm.AddConnection(types.ConnectionState{
		ID:           id,
		Status:       "active",
		CreatedAt:    time.Now(),
		LastActiveAt: time.Now(),
	})
}

func (s *ConnectionPoolScenario) releaseOldConnection() {
	var oldestID string
	var oldestTime time.Time

	for id, conn := range s.connections {
		if oldestTime.IsZero() || conn.LastUsed.Before(oldestTime) {
			oldestID = id
			oldestTime = conn.LastUsed
		}
	}

	if oldestID != "" {
		delete(s.connections, oldestID)
		s.sm.RemoveConnection(oldestID)
	}
}
