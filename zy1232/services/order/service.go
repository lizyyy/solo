package order

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

type OrderItem struct {
	ProductID   int     `json:"product_id"`
	ProductName string  `json:"product_name"`
	Quantity    int     `json:"quantity"`
	Price       float64 `json:"price"`
}

type Order struct {
	ID          int          `json:"id"`
	UserID      int          `json:"user_id"`
	Status      string       `json:"status"`
	TotalAmount float64      `json:"total_amount"`
	Items       []OrderItem  `json:"items"`
	CreatedAt   time.Time    `json:"created_at"`
	UpdatedAt   time.Time    `json:"updated_at"`
}

type Service struct {
	orders map[int]*Order
	nextID int
	mu     sync.RWMutex
	port   int
}

func NewService(port int) *Service {
	s := &Service{
		orders: make(map[int]*Order),
		nextID: 1,
		port:   port,
	}

	// Seed data
	s.orders[1] = &Order{
		ID:          1,
		UserID:      1,
		Status:      "completed",
		TotalAmount: 99.99,
		Items: []OrderItem{
			{ProductID: 101, ProductName: "Laptop", Quantity: 1, Price: 99.99},
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	s.orders[2] = &Order{
		ID:          2,
		UserID:      2,
		Status:      "pending",
		TotalAmount: 59.98,
		Items: []OrderItem{
			{ProductID: 102, ProductName: "Mouse", Quantity: 2, Price: 29.99},
		},
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

	api := r.PathPrefix("/api/orders").Subrouter()
	api.HandleFunc("", chain.Then(http.HandlerFunc(s.listOrders))).Methods("GET")
	api.HandleFunc("", chain.Then(http.HandlerFunc(s.createOrder))).Methods("POST")
	api.HandleFunc("/{id}", chain.Then(http.HandlerFunc(s.getOrder))).Methods("GET")
	api.HandleFunc("/{id}", chain.Then(http.HandlerFunc(s.updateOrder))).Methods("PUT")
	api.HandleFunc("/{id}", chain.Then(http.HandlerFunc(s.deleteOrder))).Methods("DELETE")
	api.HandleFunc("/user/{user_id}", chain.Then(http.HandlerFunc(s.getOrdersByUser))).Methods("GET")
	api.HandleFunc("/health", chain.Then(http.HandlerFunc(s.healthCheck))).Methods("GET")

	addr := ":" + strconv.Itoa(s.port)
	log.Info().Str("service", "order").Str("addr", addr).Msg("Order service starting")

	return http.ListenAndServe(addr, r)
}

func (s *Service) listOrders(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	s.mu.RLock()
	orders := make([]*Order, 0, len(s.orders))
	for _, o := range s.orders {
		orders = append(orders, o)
	}
	s.mu.RUnlock()

	log.Info().Str("trace_id", traceID).Int("count", len(orders)).Msg("Listing orders")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     orders,
		"trace_id": traceID,
	})
}

func (s *Service) createOrder(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	var order Order
	if err := json.NewDecoder(r.Body).Decode(&order); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	order.ID = s.nextID
	s.nextID++
	order.Status = "pending"
	order.CreatedAt = time.Now()
	order.UpdatedAt = time.Now()

	total := 0.0
	for _, item := range order.Items {
		total += item.Price * float64(item.Quantity)
	}
	order.TotalAmount = total

	s.orders[order.ID] = &order
	s.mu.Unlock()

	log.Info().Str("trace_id", traceID).Int("order_id", order.ID).Int("user_id", order.UserID).Float64("amount", order.TotalAmount).Msg("Order created")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     order,
		"trace_id": traceID,
	})
}

func (s *Service) getOrder(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	order, exists := s.orders[id]
	s.mu.RUnlock()

	if !exists {
		log.Warn().Str("trace_id", traceID).Int("order_id", id).Msg("Order not found")
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	log.Info().Str("trace_id", traceID).Int("order_id", id).Msg("Getting order")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     order,
		"trace_id": traceID,
	})
}

func (s *Service) updateOrder(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	var updates Order
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	order, exists := s.orders[id]
	if !exists {
		s.mu.Unlock()
		log.Warn().Str("trace_id", traceID).Int("order_id", id).Msg("Order not found for update")
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}

	if updates.Status != "" {
		order.Status = updates.Status
	}
	if len(updates.Items) > 0 {
		order.Items = updates.Items
		total := 0.0
		for _, item := range order.Items {
			total += item.Price * float64(item.Quantity)
		}
		order.TotalAmount = total
	}
	order.UpdatedAt = time.Now()
	s.mu.Unlock()

	log.Info().Str("trace_id", traceID).Int("order_id", id).Str("status", order.Status).Msg("Order updated")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     order,
		"trace_id": traceID,
	})
}

func (s *Service) deleteOrder(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	id, err := strconv.Atoi(vars["id"])
	if err != nil {
		http.Error(w, "Invalid order ID", http.StatusBadRequest)
		return
	}

	s.mu.Lock()
	_, exists := s.orders[id]
	if !exists {
		s.mu.Unlock()
		log.Warn().Str("trace_id", traceID).Int("order_id", id).Msg("Order not found for delete")
		http.Error(w, "Order not found", http.StatusNotFound)
		return
	}
	delete(s.orders, id)
	s.mu.Unlock()

	log.Info().Str("trace_id", traceID).Int("order_id", id).Msg("Order deleted")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Order deleted",
		"trace_id": traceID,
	})
}

func (s *Service) getOrdersByUser(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	userID, err := strconv.Atoi(vars["user_id"])
	if err != nil {
		http.Error(w, "Invalid user ID", http.StatusBadRequest)
		return
	}

	s.mu.RLock()
	var userOrders []*Order
	for _, o := range s.orders {
		if o.UserID == userID {
			userOrders = append(userOrders, o)
		}
	}
	s.mu.RUnlock()

	log.Info().Str("trace_id", traceID).Int("user_id", userID).Int("count", len(userOrders)).Msg("Getting orders by user")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     userOrders,
		"trace_id": traceID,
	})
}

func (s *Service) healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"service": "order",
		"status":  "healthy",
		"port":    s.port,
	})
}
