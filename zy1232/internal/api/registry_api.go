package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/internal/config"
	"github.com/zy1232/microservice-framework/internal/middleware"
	"github.com/zy1232/microservice-framework/internal/model"
	"github.com/zy1232/microservice-framework/internal/persistence"
	"github.com/zy1232/microservice-framework/internal/registry"
	"github.com/zy1232/microservice-framework/pkg/tracing"
)

type RegistryAPI struct {
	registry *registry.Registry
	config   *config.Manager
	store    *persistence.Store
	port     int
}

func NewRegistryAPI(reg *registry.Registry, cfg *config.Manager, store *persistence.Store, port int) *RegistryAPI {
	return &RegistryAPI{
		registry: reg,
		config:   cfg,
		store:    store,
		port:     port,
	}
}

func (api *RegistryAPI) Run() error {
	r := mux.NewRouter()

	chain := middleware.NewChain(
		middleware.RecoveryMiddleware,
		middleware.TracingMiddleware,
		middleware.LoggingMiddleware,
		middleware.CORSMiddleware,
	)

	// Registry management
	reg := r.PathPrefix("/api/registry").Subrouter()
	reg.HandleFunc("/services", chain.Then(http.HandlerFunc(api.listServices))).Methods("GET")
	reg.HandleFunc("/services", chain.Then(http.HandlerFunc(api.registerInstance))).Methods("POST")
	reg.HandleFunc("/services/{service}", chain.Then(http.HandlerFunc(api.getService))).Methods("GET")
	reg.HandleFunc("/services/{service}/{instance_id}", chain.Then(http.HandlerFunc(api.deregisterInstance))).Methods("DELETE")
	reg.HandleFunc("/services/{service}/{instance_id}/health", chain.Then(http.HandlerFunc(api.updateHealth))).Methods("PUT")

	// Config management
	cfg := r.PathPrefix("/api/config").Subrouter()
	cfg.HandleFunc("", chain.Then(http.HandlerFunc(api.getCurrentConfig))).Methods("GET")
	cfg.HandleFunc("", chain.Then(http.HandlerFunc(api.updateConfig))).Methods("PUT")
	cfg.HandleFunc("/history", chain.Then(http.HandlerFunc(api.getConfigHistory))).Methods("GET")

	// Request logs
	logs := r.PathPrefix("/api/logs").Subrouter()
	logs.HandleFunc("/requests", chain.Then(http.HandlerFunc(api.getRequestLogs))).Methods("GET")

	// Health check
	r.HandleFunc("/health", chain.Then(http.HandlerFunc(api.healthCheck))).Methods("GET")

	addr := fmt.Sprintf(":%d", api.port)
	log.Info().Str("service", "registry-api").Str("addr", addr).Msg("Registry API starting")

	return http.ListenAndServe(addr, r)
}

func (api *RegistryAPI) listServices(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	services := api.registry.AllServices()

	log.Info().Str("trace_id", traceID).Int("count", len(services)).Msg("Listing services")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     services,
		"trace_id": traceID,
	})
}

func (api *RegistryAPI) registerInstance(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	var instance model.ServiceInstance
	if err := json.NewDecoder(r.Body).Decode(&instance); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if instance.Service == "" {
		http.Error(w, "Service name is required", http.StatusBadRequest)
		return
	}
	if instance.Address == "" {
		instance.Address = "localhost"
	}
	if instance.Port == 0 {
		http.Error(w, "Port is required", http.StatusBadRequest)
		return
	}

	if err := api.registry.Register(&instance); err != nil {
		if err == registry.ErrInstanceExists {
			http.Error(w, "Instance already exists", http.StatusConflict)
			return
		}
		log.Error().Err(err).Str("trace_id", traceID).Msg("Failed to register instance")
		http.Error(w, "Failed to register instance", http.StatusInternalServerError)
		return
	}

	// Persist registry
	if err := api.store.SaveRegistry(api.registry.AllServices()); err != nil {
		log.Warn().Err(err).Str("trace_id", traceID).Msg("Failed to persist registry")
	}

	log.Info().
		Str("trace_id", traceID).
		Str("service", instance.Service).
		Str("instance_id", instance.ID).
		Msg("Instance registered")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     instance,
		"trace_id": traceID,
	})
}

func (api *RegistryAPI) getService(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	serviceName := vars["service"]

	service, err := api.registry.GetService(serviceName)
	if err != nil {
		if err == registry.ErrServiceNotFound {
			http.Error(w, "Service not found", http.StatusNotFound)
			return
		}
		log.Error().Err(err).Str("trace_id", traceID).Msg("Failed to get service")
		http.Error(w, "Failed to get service", http.StatusInternalServerError)
		return
	}

	log.Info().Str("trace_id", traceID).Str("service", serviceName).Msg("Getting service")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     service,
		"trace_id": traceID,
	})
}

func (api *RegistryAPI) deregisterInstance(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	serviceName := vars["service"]
	instanceID := vars["instance_id"]

	if err := api.registry.Deregister(serviceName, instanceID); err != nil {
		if err == registry.ErrInstanceNotFound || err == registry.ErrServiceNotFound {
			http.Error(w, "Instance not found", http.StatusNotFound)
			return
		}
		log.Error().Err(err).Str("trace_id", traceID).Msg("Failed to deregister instance")
		http.Error(w, "Failed to deregister instance", http.StatusInternalServerError)
		return
	}

	// Persist registry
	if err := api.store.SaveRegistry(api.registry.AllServices()); err != nil {
		log.Warn().Err(err).Str("trace_id", traceID).Msg("Failed to persist registry")
	}

	log.Info().
		Str("trace_id", traceID).
		Str("service", serviceName).
		Str("instance_id", instanceID).
		Msg("Instance deregistered")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Instance deregistered",
		"trace_id": traceID,
	})
}

func (api *RegistryAPI) updateHealth(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	vars := mux.Vars(r)
	serviceName := vars["service"]
	instanceID := vars["instance_id"]

	var req struct {
		Healthy bool `json:"healthy"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := api.registry.UpdateHealth(serviceName, instanceID, req.Healthy); err != nil {
		if err == registry.ErrInstanceNotFound || err == registry.ErrServiceNotFound {
			http.Error(w, "Instance not found", http.StatusNotFound)
			return
		}
		log.Error().Err(err).Str("trace_id", traceID).Msg("Failed to update health")
		http.Error(w, "Failed to update health", http.StatusInternalServerError)
		return
	}

	// Persist registry
	if err := api.store.SaveRegistry(api.registry.AllServices()); err != nil {
		log.Warn().Err(err).Str("trace_id", traceID).Msg("Failed to persist registry")
	}

	log.Info().
		Str("trace_id", traceID).
		Str("service", serviceName).
		Str("instance_id", instanceID).
		Bool("healthy", req.Healthy).
		Msg("Health updated")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"message":  "Health updated",
		"trace_id": traceID,
	})
}

func (api *RegistryAPI) getCurrentConfig(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	config := api.config.Current()

	log.Info().Str("trace_id", traceID).Msg("Getting current config")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     config,
		"trace_id": traceID,
	})
}

func (api *RegistryAPI) updateConfig(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	var updates map[string]interface{}
	if err := json.NewDecoder(r.Body).Decode(&updates); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	if err := api.config.Update(updates); err != nil {
		log.Error().Err(err).Str("trace_id", traceID).Msg("Failed to update config")
		http.Error(w, "Failed to update config", http.StatusInternalServerError)
		return
	}

	// Persist config history
	if err := api.store.SaveConfigHistory(api.config.History()); err != nil {
		log.Warn().Err(err).Str("trace_id", traceID).Msg("Failed to persist config history")
	}

	log.Info().Str("trace_id", traceID).Msg("Config updated")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     api.config.Current(),
		"trace_id": traceID,
	})
}

func (api *RegistryAPI) getConfigHistory(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())

	history := api.config.History()

	log.Info().Str("trace_id", traceID).Int("count", len(history)).Msg("Getting config history")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     history,
		"trace_id": traceID,
	})
}

func (api *RegistryAPI) getRequestLogs(w http.ResponseWriter, r *http.Request) {
	traceID, _ := tracing.FromContext(r.Context())
	date := r.URL.Query().Get("date")

	logs, err := api.store.LoadRequestLogs(date)
	if err != nil {
		log.Error().Err(err).Str("trace_id", traceID).Msg("Failed to load request logs")
		http.Error(w, "Failed to load request logs", http.StatusInternalServerError)
		return
	}

	log.Info().Str("trace_id", traceID).Int("count", len(logs)).Msg("Getting request logs")

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success":  true,
		"data":     logs,
		"trace_id": traceID,
	})
}

func (api *RegistryAPI) healthCheck(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"success": true,
		"service": "registry-api",
		"status":  "healthy",
		"port":    api.port,
		"time":    time.Now().Format(time.RFC3339),
	})
}
