package handler

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"api-gateway-tester/internal/model"
	"api-gateway-tester/internal/service"

	"github.com/gorilla/mux"
	"gopkg.in/go-playground/validator.v9"
)

var validate = validator.New()

type Handler struct {
	service *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{service: svc}
}

func (h *Handler) RegisterRoutes(r *mux.Router) {
	r.HandleFunc("/api/v1/upstreams", h.CreateUpstream).Methods("POST")
	r.HandleFunc("/api/v1/upstreams", h.ListUpstreams).Methods("GET")
	r.HandleFunc("/api/v1/upstreams/{id}", h.GetUpstream).Methods("GET")

	r.HandleFunc("/api/v1/rules", h.CreateRouteRule).Methods("POST")
	r.HandleFunc("/api/v1/rules", h.ListRouteRules).Methods("GET")
	r.HandleFunc("/api/v1/rules/{id}", h.GetRouteRule).Methods("GET")

	r.HandleFunc("/api/v1/samples", h.CreateRequestSample).Methods("POST")
	r.HandleFunc("/api/v1/samples", h.ListRequestSamples).Methods("GET")
	r.HandleFunc("/api/v1/samples/{id}", h.GetRequestSample).Methods("GET")

	r.HandleFunc("/api/v1/trials", h.StartTrial).Methods("POST")
	r.HandleFunc("/api/v1/trials", h.GetTrialHistory).Methods("GET")
	r.HandleFunc("/api/v1/trials/{id}", h.GetTrialResult).Methods("GET")

	r.HandleFunc("/api/v1/rules/{id}/explain", h.ExplainRule).Methods("POST")

	r.HandleFunc("/api/v1/export", h.ExportTrials).Methods("POST")

	r.HandleFunc("/api/v1/health", h.HealthCheck).Methods("GET")
}

func respondWithJSON(w http.ResponseWriter, code int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(payload)
}

func respondWithError(w http.ResponseWriter, code int, message string, details string) {
	respondWithJSON(w, code, model.ErrorResponse{
		Code:    http.StatusText(code),
		Message: message,
		Details: details,
	})
}

func (h *Handler) CreateUpstream(w http.ResponseWriter, r *http.Request) {
	var req model.CreateUpstreamRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if err := validate.Struct(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	result, err := h.service.CreateUpstream(&req)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create upstream", err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, result)
}

func (h *Handler) ListUpstreams(w http.ResponseWriter, r *http.Request) {
	result, err := h.service.ListUpstreams()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list upstreams", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) GetUpstream(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result, err := h.service.GetUpstream(id)
	if err != nil {
		if errors.Is(err, errors.New("record not found")) {
			respondWithError(w, http.StatusNotFound, "Upstream not found", "")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to get upstream", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) CreateRouteRule(w http.ResponseWriter, r *http.Request) {
	var req model.CreateRouteRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if err := validate.Struct(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	result, err := h.service.CreateRouteRule(&req)
	if err != nil {
		if errors.Is(err, service.ErrUpstreamNotFound) {
			respondWithError(w, http.StatusBadRequest, "Upstream not found", "")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to create route rule", err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, result)
}

func (h *Handler) ListRouteRules(w http.ResponseWriter, r *http.Request) {
	result, err := h.service.ListRouteRules()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list route rules", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) GetRouteRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result, err := h.service.GetRouteRule(id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get route rule", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) CreateRequestSample(w http.ResponseWriter, r *http.Request) {
	var req model.CreateRequestSampleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if err := validate.Struct(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	result, err := h.service.CreateRequestSample(&req)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to create request sample", err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, result)
}

func (h *Handler) ListRequestSamples(w http.ResponseWriter, r *http.Request) {
	result, err := h.service.ListRequestSamples()
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to list request samples", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) GetRequestSample(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result, err := h.service.GetRequestSample(id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get request sample", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) StartTrial(w http.ResponseWriter, r *http.Request) {
	var req model.StartTrialRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if err := validate.Struct(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	result, err := h.service.StartTrial(&req)
	if err != nil {
		if errors.Is(err, service.ErrSampleNotFound) {
			respondWithError(w, http.StatusBadRequest, "Request sample not found", "")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to start trial", err.Error())
		return
	}

	respondWithJSON(w, http.StatusCreated, result)
}

func (h *Handler) GetTrialResult(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	result, err := h.service.GetTrialResult(id)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get trial result", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) GetTrialHistory(w http.ResponseWriter, r *http.Request) {
	var query model.TrialHistoryQuery
	
	status := r.URL.Query().Get("status")
	if status != "" {
		trialStatus := model.TrialStatus(status)
		query.Status = &trialStatus
	}
	
	page := 1
	if r.URL.Query().Get("page") != "" {
		fmt.Sscanf(r.URL.Query().Get("page"), "%d", &page)
	}
	query.Page = page

	pageSize := 10
	if r.URL.Query().Get("page_size") != "" {
		fmt.Sscanf(r.URL.Query().Get("page_size"), "%d", &pageSize)
	}
	query.PageSize = pageSize

	result, err := h.service.GetTrialHistory(&query)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to get trial history", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) ExplainRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	ruleID := vars["id"]

	var req struct {
		SampleID string `json:"sample_id" validate:"required"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if err := validate.Struct(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	result, err := h.service.ExplainRule(ruleID, req.SampleID)
	if err != nil {
		if errors.Is(err, service.ErrRuleNotFound) {
			respondWithError(w, http.StatusBadRequest, "Route rule not found", "")
			return
		}
		if errors.Is(err, service.ErrSampleNotFound) {
			respondWithError(w, http.StatusBadRequest, "Request sample not found", "")
			return
		}
		respondWithError(w, http.StatusInternalServerError, "Failed to explain rule", err.Error())
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) ExportTrials(w http.ResponseWriter, r *http.Request) {
	var req model.ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Invalid request body", err.Error())
		return
	}

	if err := validate.Struct(&req); err != nil {
		respondWithError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	result, err := h.service.ExportTrials(&req)
	if err != nil {
		respondWithError(w, http.StatusInternalServerError, "Failed to export trials", err.Error())
		return
	}

	if req.Format == "csv" {
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", "attachment; filename=trials.csv")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(result.(string)))
		return
	}

	respondWithJSON(w, http.StatusOK, result)
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	respondWithJSON(w, http.StatusOK, map[string]string{
		"status":  "ok",
		"service": "API Gateway Route Tester",
	})
}
