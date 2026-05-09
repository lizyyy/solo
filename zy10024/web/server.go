package web

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"sync"
	"time"

	"chaos-simulator/internal/config"
	"chaos-simulator/internal/engine"
	"chaos-simulator/pkg/models"

	"github.com/gorilla/websocket"
)

type Server struct {
	engine       *engine.Engine
	upgrader     websocket.Upgrader
	clients      map[*websocket.Conn]bool
	clientsMu    sync.RWMutex
}

func NewServer(e *engine.Engine) *Server {
	return &Server{
		engine: e,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		clients: make(map[*websocket.Conn]bool),
	}
}

func (s *Server) Start() error {
	mux := http.NewServeMux()

	mux.HandleFunc("/", s.handleIndex)
	mux.HandleFunc("/api/scenarios", s.handleScenarios)
	mux.HandleFunc("/api/scenarios/", s.handleScenario)
	mux.HandleFunc("/api/state", s.handleState)
	mux.HandleFunc("/api/events", s.handleEvents)
	mux.HandleFunc("/api/snapshots", s.handleSnapshots)
	mux.HandleFunc("/ws", s.handleWebSocket)
	mux.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./static"))))

	go s.broadcastState()

	port := config.Get().Web.Port
	log.Printf("Web server starting on :%d", port)
	return http.ListenAndServe(fmt.Sprintf(":%d", port), mux)
}

func (s *Server) handleIndex(w http.ResponseWriter, r *http.Request) {
	http.ServeFile(w, r, "./static/index.html")
}

func (s *Server) handleScenarios(w http.ResponseWriter, r *http.Request) {
	scenarioNames := s.engine.ListScenarios()
	result := make([]map[string]interface{}, 0, len(scenarioNames))

	for _, name := range scenarioNames {
		sc, ok := s.engine.GetScenario(name)
		if !ok {
			continue
		}
		result = append(result, map[string]interface{}{
			"name":   sc.Name(),
			"type":   sc.Type(),
			"status": sc.Status(),
			"config": sc.Config(),
		})
	}

	writeJSON(w, http.StatusOK, result)
}

func (s *Server) handleScenario(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Path[len("/api/scenarios/"):]

	sc, ok := s.engine.GetScenario(name)
	if !ok {
		http.Error(w, "Scenario not found", http.StatusNotFound)
		return
	}

	switch r.Method {
	case "GET":
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"name":   sc.Name(),
			"type":   sc.Type(),
			"status": sc.Status(),
			"config": sc.Config(),
			"state":  sc.CurrentState(),
			"events": sc.GetEvents(),
		})

	case "POST":
		var req struct {
			Action string `json:"action"`
		}
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, err.Error(), http.StatusBadRequest)
			return
		}

		var err error
		switch req.Action {
		case "start":
			err = s.engine.StartScenario(name)
		case "stop":
			err = s.engine.StopScenario(name)
		case "recover":
			err = s.engine.RecoverScenario(name)
		default:
			http.Error(w, "Unknown action", http.StatusBadRequest)
			return
		}

		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}

		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) handleState(w http.ResponseWriter, r *http.Request) {
	state := s.engine.GetLatestState()
	writeJSON(w, http.StatusOK, state)
}

func (s *Server) handleEvents(w http.ResponseWriter, r *http.Request) {
	events := s.engine.GetTimeline().GetAll()
	writeJSON(w, http.StatusOK, events)
}

func (s *Server) handleSnapshots(w http.ResponseWriter, r *http.Request) {
	snapshots := s.engine.GetSnapshots()
	writeJSON(w, http.StatusOK, snapshots)
}

func (s *Server) handleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := s.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("WebSocket upgrade error: %v", err)
		return
	}

	s.clientsMu.Lock()
	s.clients[conn] = true
	s.clientsMu.Unlock()

	defer func() {
		s.clientsMu.Lock()
		delete(s.clients, conn)
		s.clientsMu.Unlock()
		conn.Close()
	}()

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

func (s *Server) broadcastState() {
	ticker := s.newTicker(1 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		state := s.engine.GetLatestState()
		events := s.engine.GetTimeline().GetAll()

		scenarioStatuses := make(map[string]models.ScenarioStatus)
		for _, name := range s.engine.ListScenarios() {
			if sc, ok := s.engine.GetScenario(name); ok {
				scenarioStatuses[name] = sc.Status()
			}
		}

		msg := map[string]interface{}{
			"state":          state,
			"events":         lastNEvents(events, 50),
			"scenario_status": scenarioStatuses,
		}

		data, _ := json.Marshal(msg)

		s.clientsMu.RLock()
		for client := range s.clients {
			client.WriteMessage(websocket.TextMessage, data)
		}
		s.clientsMu.RUnlock()
	}
}

func (s *Server) newTicker(d time.Duration) *time.Ticker {
	return time.NewTicker(d)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func lastNEvents(events []models.Event, n int) []models.Event {
	if len(events) <= n {
		return events
	}
	return events[len(events)-n:]
}
