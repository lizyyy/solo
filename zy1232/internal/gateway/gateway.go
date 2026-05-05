package gateway

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"strings"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/internal/config"
	"github.com/zy1232/microservice-framework/internal/middleware"
	"github.com/zy1232/microservice-framework/internal/model"
	"github.com/zy1232/microservice-framework/internal/persistence"
	"github.com/zy1232/microservice-framework/internal/registry"
	"github.com/zy1232/microservice-framework/pkg/circuitbreaker"
	"github.com/zy1232/microservice-framework/pkg/ratelimit"
	"github.com/zy1232/microservice-framework/pkg/tracing"
)

type Gateway struct {
	registry      *registry.Registry
	config        *config.Manager
	store         *persistence.Store
	rateLimiter   *ratelimit.ServiceRateLimiter
	circuitBreaker *circuitbreaker.ServiceCircuitBreaker
	router        *mux.Router
	port          int
}

type Config struct {
	Registry *registry.Registry
	Config   *config.Manager
	Store    *persistence.Store
	Port     int
}

func NewGateway(cfg Config) *Gateway {
	return &Gateway{
		registry:      cfg.Registry,
		config:        cfg.Config,
		store:         cfg.Store,
		rateLimiter:   ratelimit.NewServiceRateLimiter(),
		circuitBreaker: circuitbreaker.NewServiceCircuitBreaker(3, 30*time.Second),
		port:          cfg.Port,
	}
}

func (g *Gateway) Run() error {
	g.router = mux.NewRouter()

	chain := middleware.NewChain(
		middleware.RecoveryMiddleware,
		middleware.TracingMiddleware,
		middleware.LoggingMiddleware,
		middleware.CORSMiddleware,
		middleware.RequestContextMiddleware,
	)

	// API routes for management
	api := g.router.PathPrefix("/api/gateway").Subrouter()
	api.HandleFunc("/routes", chain.Then(http.HandlerFunc(g.listRoutes))).Methods("GET")
	api.HandleFunc("/decisions", chain.Then(http.HandlerFunc(g.getDecisions))).Methods("GET")
	api.HandleFunc("/circuit-breakers", chain.Then(http.HandlerFunc(g.getCircuitBreakers))).Methods("GET")
	api.HandleFunc("/circuit-breakers/{service}/reset", chain.Then(http.HandlerFunc(g.resetCircuitBreaker))).Methods("POST")
	api.HandleFunc("/simulate", chain.Then(http.HandlerFunc(g.simulateRequest))).Methods("POST")
	api.HandleFunc("/health", chain.Then(http.HandlerFunc(g.healthCheck))).Methods("GET")

	// Proxy routes
	g.router.PathPrefix("/api/users").Handler(chain.Then(http.HandlerFunc(g.proxyHandler("user"))))
	g.router.PathPrefix("/api/orders").Handler(chain.Then(http.HandlerFunc(g.proxyHandler("order"))))

	addr := fmt.Sprintf(":%d", g.port)
	log.Info().Str("service", "gateway").Str("addr", addr).Msg("Gateway starting")

	return http.ListenAndServe(addr, g.router)
}

func (g *Gateway) proxyHandler(serviceName string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		traceID, _ := tracing.FromContext(r.Context())
		start := time.Now()

		decision := &model.RoutingDecision{
			TraceID:   traceID,
			Service:   serviceName,
			Endpoint:  r.URL.Path,
			Method:    r.Method,
			Timestamp: time.Now(),
		}

		defer func() {
			if err := g.store.SaveRoutingDecision(decision); err != nil {
				log.Warn().Err(err).Str("trace_id", traceID).Msg("Failed to save routing decision")
			}
		}()

		// Rate limit check
		limit := g.config.GetInt("ratelimit.limit")
		if limit == 0 {
			limit = 100
		}
		windowSec := g.config.GetInt("ratelimit.window")
		if windowSec == 0 {
			windowSec = 60
		}
		window := time.Duration(windowSec) * time.Second

		if !g.rateLimiter.Allow(serviceName, limit, window) {
			decision.Decision = "rejected"
			decision.Reason = "rate_limit_exceeded"
			decision.Error = "Too many requests"

			log.Warn().
				Str("trace_id", traceID).
				Str("service", serviceName).
				Msg("Rate limit exceeded")

			http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
			return
		}

		// Circuit breaker check
		breaker := g.circuitBreaker.Get(serviceName)
		if !breaker.Allow() {
			decision.Decision = "rejected"
			decision.Reason = "circuit_breaker_open"
			decision.Error = "Service unavailable"

			state, failures, _ := breaker.Stats()
			log.Warn().
				Str("trace_id", traceID).
				Str("service", serviceName).
				Str("state", string(state)).
				Int("failures", failures).
				Msg("Circuit breaker open")

			http.Error(w, "Service Unavailable", http.StatusServiceUnavailable)
			return
		}

		// Get healthy instances
		instances, err := g.registry.GetHealthyInstances(serviceName)
		if err != nil || len(instances) == 0 {
			decision.Decision = "rejected"
			decision.Reason = "no_healthy_instances"
			decision.Error = "No healthy instances available"

			log.Warn().
				Str("trace_id", traceID).
				Str("service", serviceName).
				Msg("No healthy instances available")

			http.Error(w, "Service Unavailable", http.StatusServiceUnavailable)
			return
		}

		// Simple round-robin: pick first instance
		instance := instances[0]
		decision.InstanceID = instance.ID
		decision.Decision = "allowed"
		decision.Reason = "routed_to_instance"

		// Proxy the request
		targetURL := fmt.Sprintf("http://%s:%d", instance.Address, instance.Port)
		target, err := url.Parse(targetURL)
		if err != nil {
			decision.Decision = "failed"
			decision.Reason = "invalid_target_url"
			decision.Error = err.Error()

			log.Error().
				Err(err).
				Str("trace_id", traceID).
				Str("target", targetURL).
				Msg("Invalid target URL")

			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			return
		}

		proxy := httputil.NewSingleHostReverseProxy(target)
		proxy.Director = func(req *http.Request) {
			req.URL.Scheme = target.Scheme
			req.URL.Host = target.Host
			req.URL.Path = r.URL.Path
			req.URL.RawQuery = r.URL.RawQuery

			// Copy headers
			for k, v := range r.Header {
				req.Header[k] = v
			}

			// Inject trace ID
			tracing.InjectTraceID(r.Context(), req)
		}

		// Capture response
		rw := &responseRecorder{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
			body:           &bytes.Buffer{},
		}

		proxy.ServeHTTP(rw, r)

		duration := time.Since(start)

		// Log request
		reqBody, _ := io.ReadAll(io.LimitReader(r.Body, 1024))
		logEntry := &model.RequestLog{
			TraceID:    traceID,
			Service:    serviceName,
			Endpoint:   r.URL.Path,
			Method:     r.Method,
			StatusCode: rw.statusCode,
			Duration:   duration,
			Request: map[string]interface{}{
				"body": string(reqBody),
			},
			CreatedAt: time.Now(),
		}

		if rw.statusCode >= 400 {
			logEntry.Error = rw.body.String()
			decision.Error = rw.body.String()

			if rw.statusCode >= 500 {
				breaker.RecordFailure()
				log.Warn().
					Str("trace_id", traceID).
					Str("service", serviceName).
					Int("status", rw.statusCode).
					Msg("Circuit breaker recorded failure")
			}
		} else {
			breaker.RecordSuccess()
		}

		if err := g.store.SaveRequestLog(logEntry); err != nil {
			log.Warn().Err(err).Str("trace_id", traceID).Msg("Failed to save request log")
		}

		log.Info().
			Str("trace_id", traceID).
			Str("service", serviceName).
			Str("instance", instance.ID).
			Int("status", rw.statusCode).
			Dur("duration", duration).
			Msg("Request proxied")
	}
}

type responseRecorder struct {
	http.ResponseWriter
	statusCode int
	body       *bytes.Buffer
}

func (rr *responseRecorder) WriteHeader(code int) {
	rr.statusCode = code
	rr.ResponseWriter.WriteHeader(code)
}

func (rr *responseRecorder) Write(b []byte) (int, error) {
	rr.body.Write(b)
	return rr.ResponseWriter.Write(b)
}

func (g *Gateway) listRoutes(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	routes := []map[string]interface{}{
		{
			"path":    "/api/users/*",
			"service": "user",
			"methods": []string{"GET", "POST", "PUT", "DELETE"},
		},
		{
			"path":    "/api/orders/*",
			"service": "order",
			"methods": []string{"GET", "POST", "PUT", "DELETE"},
		},
	}

	log.Info().Str("trace_id", traceID).Msg("Listing routes")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     routes,
		"trace_id": traceID,
	})
}

func (g *Gateway) getDecisions(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	date := r.URL.Query().Get("date")

	decisions, err := g.store.LoadRoutingDecisions(date)
	if err != nil {
		log.Error().Err(err).Str("trace_id", traceID).Msg("Failed to load routing decisions")
		http.Error(w, "Failed to load routing decisions", http.StatusInternalServerError)
		return
	}

	log.Info().Str("trace_id", traceID).Int("count", len(decisions)).Msg("Getting routing decisions")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     decisions,
		"trace_id": traceID,
	})
}

func (g *Gateway) getCircuitBreakers(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	breakers := g.circuitBreaker.All()
	states := make(map[string]interface{})

	for name, breaker := range breakers {
		state, failures, successes := breaker.Stats()
		states[name] = map[string]interface{}{
			"state":     state,
			"failures":  failures,
			"successes": successes,
		}
	}

	log.Info().Str("trace_id", traceID).Msg("Getting circuit breaker states")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     states,
		"trace_id": traceID,
	})
}

func (g *Gateway) resetCircuitBreaker(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	serviceName := vars["service"]

	breaker := g.circuitBreaker.Get(serviceName)
	breaker.Reset()

	log.Info().Str("trace_id", traceID).Str("service", serviceName).Msg("Circuit breaker reset")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Circuit breaker reset",
		"trace_id": traceID,
	})
}

func (g *Gateway) simulateRequest(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	var req struct {
		Service  string                 `json:"service"`
		Endpoint string                 `json:"endpoint"`
		Method   string                 `json:"method"`
		Body     map[string]interface{} `json:"body,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if req.Method == "" {
		req.Method = "GET"
	}

	log.Info().
		Str("trace_id", traceID).
		Str("service", req.Service).
		Str("endpoint", req.Endpoint).
		Str("method", req.Method).
		Msg("Simulating request")

	// Create a new request
	proxyReq, err := http.NewRequestWithContext(
		r.Context(),
		req.Method,
		"http://localhost"+req.Endpoint,
		nil,
	)
	if err != nil {
		http.Error(w, "Failed to create request", http.StatusInternalServerError)
		return
	}

	// Use the proxy handler
	handler := g.proxyHandler(req.Service)
	rw := &responseRecorder{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
		body:           &bytes.Buffer{},
	}

	handler(rw, proxyReq)
}

func (g *Gateway) healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"service": "gateway",
		"status":  "healthy",
		"port":    g.port,
	})
}
