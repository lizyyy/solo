package user

import (
	"encoding/json"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/internal/middleware"
	"github.com/zy1232/microservice-framework/pkg/tracing"
)

type User struct {
	ID        int       `json:"id"`
	Username  string    `json:"username"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Service struct {
	users  map[int]*User
	nextID int
	mu     sync.RWMutex
	port   int
}

func NewService(port int) *Service {
	s := &Service{
		users:  make(map[int]*User),
		nextID: 1,
		port:   port,
	}

	// Seed data
	s.users[1] = &User{
		ID:        1,
		Username:  "admin",
		Email:     "admin@example.com",
		Name:      "Administrator",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	s.users[2] = &User{
		ID:        2,
		Username:  "john_doe",
		Email:     "john@example.com",
		Name:      "John Doe",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	s.nextID = 3

	return s
}

func (s *Service) Run() error {
	r := mux.NewRouter()

	chain := middleware.NewChain(
		middleware.RecoveryMiddleware,
		middleware.TracingMiddleware,
		middleware.LoggingMiddleware,
		middleware.CORSMiddleware,
	)

	api := r.PathPrefix("/api/users").Subrouter()
	api.HandleFunc("", chain.Then(http.HandlerFunc(s.listUsers))).Methods("GET")
	api.HandleFunc("", chain.Then(http.HandlerFunc(s.createUser))).Methods("POST")
	api.HandleFunc("/{id}", chain.Then(http.HandlerFunc(s.getUser))).Methods("GET")
	api.HandleFunc("/{id}", chain.Then(http.HandlerFunc(s.updateUser))).Methods("PUT")
	api.HandleFunc("/{id}", chain.Then(http.HandlerFunc(s.deleteUser))).Methods("DELETE")
	api.HandleFunc("/health", chain.Then(http.HandlerFunc(s.healthCheck))).Methods("GET")

	addr := ":" + strconv.Itoa(s.port)
	log.Info().Str("service", "user").Str("addr", addr).Msg("User service starting")

	return http.ListenAndServe(addr, r)
}

func (s *Service) listUsers(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	s.mu.RLock()
	users := make([]*User, 0, len(s.users))
	for _, u := range s.users {
		users = append(users, u)
	}
	s.mu.RUnlock()

	log.Info().Str("trace_id", traceID).Int("count", len(users)).Msg("Listing users")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"data":    users,
		"trace_id": traceID,
	})
}

func (s *Service) createUser(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	var user User
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	user.ID = s.nextID
	s.nextID++
	user.CreatedAt = time.Now()
	user.UpdatedAt = time.Now()
	s.users[user.ID] = &user
	s.mu.Unlock()

	log.Info().Str("trace_id", traceID).Int("user_id", user.ID).Str("username", user.Username).Msg("User created")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     user,
		"trace_id": traceID,
	})
}

func (s *Service) getUser(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	user, exists := s.users[id]
	s.mu.RUnlock()

	if !exists {
		log.Warn().Str("trace_id", traceID).Int("user_id", id).Msg("User not found")
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	log.Info().Str("trace_id", traceID).Int("user_id", id).Msg("Getting user")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     user,
		"trace_id": traceID,
	})
}

func (s *Service) updateUser(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	var updates User
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	user, exists := s.users[id]
	if !exists {
		s.mu.Unlock()
		log.Warn().Str("trace_id", traceID).Int("user_id", id).Msg("User not found for update")
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}

	if updates.Username != "" {
		user.Username = updates.Username
	}
	if updates.Email != "" {
		user.Email = updates.Email
	}
	if updates.Name != "" {
		user.Name = updates.Name
	}
	user.UpdatedAt = time.Now()
	s.mu.Unlock()

	log.Info().Str("trace_id", traceID).Int("user_id", id).Msg("User updated")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     user,
		"trace_id": traceID,
	})
}

func (s *Service) deleteUser(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	_, exists := s.users[id]
	if !exists {
		s.mu.Unlock()
		log.Warn().Str("trace_id", traceID).Int("user_id", id).Msg("User not found for delete")
		http.Error(w, "User not found", http.StatusNotFound)
		return
	}
	delete(s.users, id)
	s.mu.Unlock()

	log.Info().Str("trace_id", traceID).Int("user_id", id).Msg("User deleted")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "User deleted",
		"trace_id": traceID,
	})
}

func (s *Service) healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"service": "user",
		"status":  "healthy",
		"port":    s.port,
	})
}
