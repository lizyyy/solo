package api

import (
	"config-rollback-api/model"
	"config-rollback-api/service"
	"encoding/json"
	"net/http"
	"time"
)

type Handler struct {
	service *service.RollbackService
}

func NewHandler(service *service.RollbackService) *Handler {
	return &Handler{service: service}
}

func (h *Handler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/releases", h.CreateRelease)
	mux.HandleFunc("GET /api/releases", h.ListReleases)
	mux.HandleFunc("GET /api/releases/{id}", h.GetRelease)
	mux.HandleFunc("POST /api/releases/{id}/start", h.StartRelease)
	mux.HandleFunc("POST /api/releases/{id}/baseline", h.SetupBaseline)
	mux.HandleFunc("POST /api/releases/{id}/threshold", h.SetupThreshold)
	mux.HandleFunc("POST /api/releases/{id}/observe/start", h.StartObservation)
	mux.HandleFunc("POST /api/releases/{id}/observe", h.ObserveMetrics)
	mux.HandleFunc("POST /api/releases/{id}/success", h.ConfirmSuccess)
	mux.HandleFunc("POST /api/releases/{id}/rollback", h.ManualRollback)
	mux.HandleFunc("GET /api/releases/{id}/decisions", h.GetDecisionHistory)
	mux.HandleFunc("GET /api/decisions", h.ListAllDecisions)
	mux.HandleFunc("GET /health", h.HealthCheck)
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, err error) {
	if apiErr, ok := err.(*model.APIError); ok {
		respondJSON(w, http.StatusBadRequest, apiErr)
		return
	}
	respondJSON(w, http.StatusInternalServerError, &model.APIError{
		Code:    "INTERNAL_ERROR",
		Message: err.Error(),
	})
}

type CreateReleaseRequest struct {
	ConfigName    string `json:"config_name"`
	Version       string `json:"version"`
	Content       string `json:"content"`
	IdempotentKey string `json:"idempotent_key"`
}

func (h *Handler) CreateRelease(w http.ResponseWriter, r *http.Request) {
	var req CreateReleaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, &model.APIError{Code: "INVALID_JSON", Message: "Invalid request body"})
		return
	}

	release, err := h.service.CreateRelease(req.ConfigName, req.Version, req.Content, req.IdempotentKey)
	if err != nil {
		respondError(w, err)
		return
	}

	respondJSON(w, http.StatusCreated, release)
}

func (h *Handler) ListReleases(w http.ResponseWriter, r *http.Request) {
	releases := h.service.ListReleases()
	respondJSON(w, http.StatusOK, releases)
}

func (h *Handler) GetRelease(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	release, err := h.service.GetRelease(id)
	if err != nil {
		respondError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, release)
}

func (h *Handler) StartRelease(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	release, err := h.service.StartRelease(id)
	if err != nil {
		respondError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, release)
}

type SetupBaselineRequest struct {
	Metrics     []MetricPoint `json:"metrics"`
	WindowStart time.Time     `json:"window_start"`
	WindowEnd   time.Time     `json:"window_end"`
}

type MetricPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Value     float64   `json:"value"`
	Metric    string    `json:"metric"`
}

func (h *Handler) SetupBaseline(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req SetupBaselineRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, &model.APIError{Code: "INVALID_JSON", Message: "Invalid request body"})
		return
	}

	metrics := make([]model.MetricPoint, len(req.Metrics))
	for i, m := range req.Metrics {
		metrics[i] = model.MetricPoint{
			Timestamp: m.Timestamp,
			Value:     m.Value,
			Metric:    m.Metric,
		}
	}

	baseline, err := h.service.SetupBaseline(id, metrics, req.WindowStart, req.WindowEnd)
	if err != nil {
		respondError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, baseline)
}

type SetupThresholdRequest struct {
	MetricName       string  `json:"metric_name"`
	MaxDeviation     float64 `json:"max_deviation"`
	MinThreshold     float64 `json:"min_threshold"`
	MaxThreshold     float64 `json:"max_threshold"`
	ConsecutiveCount int     `json:"consecutive_count"`
}

func (h *Handler) SetupThreshold(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req SetupThresholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, &model.APIError{Code: "INVALID_JSON", Message: "Invalid request body"})
		return
	}

	threshold, err := h.service.SetupThreshold(id, req.MetricName, req.MaxDeviation, req.MinThreshold, req.MaxThreshold, req.ConsecutiveCount)
	if err != nil {
		respondError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, threshold)
}

func (h *Handler) StartObservation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	release, err := h.service.StartObservation(id)
	if err != nil {
		respondError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, release)
}

type ObserveMetricsRequest struct {
	Metrics []MetricPoint `json:"metrics"`
}

func (h *Handler) ObserveMetrics(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req ObserveMetricsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, &model.APIError{Code: "INVALID_JSON", Message: "Invalid request body"})
		return
	}

	metrics := make([]model.MetricPoint, len(req.Metrics))
	for i, m := range req.Metrics {
		metrics[i] = model.MetricPoint{
			Timestamp: m.Timestamp,
			Value:     m.Value,
			Metric:    m.Metric,
		}
	}

	result, err := h.service.ObserveMetrics(id, metrics)
	if err != nil {
		respondError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, result)
}

func (h *Handler) ConfirmSuccess(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	release, err := h.service.ConfirmSuccess(id)
	if err != nil {
		respondError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, release)
}

type ManualRollbackRequest struct {
	Reason string `json:"reason"`
}

func (h *Handler) ManualRollback(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	var req ManualRollbackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, &model.APIError{Code: "INVALID_JSON", Message: "Invalid request body"})
		return
	}

	rollback, err := h.service.ManualRollback(id, req.Reason)
	if err != nil {
		respondError(w, err)
		return
	}
	respondJSON(w, http.StatusOK, rollback)
}

func (h *Handler) GetDecisionHistory(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	decisions := h.service.GetDecisionHistory(id)
	respondJSON(w, http.StatusOK, decisions)
}

func (h *Handler) ListAllDecisions(w http.ResponseWriter, r *http.Request) {
	decisions := h.service.GetAllDecisions()
	respondJSON(w, http.StatusOK, decisions)
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{"status": "healthy"})
}
