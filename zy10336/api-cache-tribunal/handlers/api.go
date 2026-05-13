package handlers

import (
	"api-cache-tribunal/models"
	"api-cache-tribunal/service"
	"encoding/json"
	"net/http"
	"time"
)

type APIHandler struct {
	service *service.TribunalService
}

func NewAPIHandler(service *service.TribunalService) *APIHandler {
	return &APIHandler{
		service: service,
	}
}

func (h *APIHandler) CreateStrategy(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path      string        `json:"path"`
		Method    string        `json:"method"`
		TTL       time.Duration `json:"ttl"`
		ParamKeys []string      `json:"param_keys"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	strategy, err := h.service.CreateStrategy(req.Path, req.Method, req.TTL, req.ParamKeys)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(strategy)
}

func (h *APIHandler) ListStrategies(w http.ResponseWriter, r *http.Request) {
	strategies := h.service.ListStrategies()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(strategies)
}

func (h *APIHandler) CheckCache(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path   string                 `json:"path"`
		Method string                 `json:"method"`
		Params map[string]interface{} `json:"params"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	record, reason, err := h.service.CheckCache(req.Path, req.Method, req.Params)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	result := map[string]interface{}{
		"hit":    record != nil,
		"reason": reason,
	}
	if record != nil {
		result["record"] = record
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (h *APIHandler) CreateRecord(w http.ResponseWriter, r *http.Request) {
	var req struct {
		StrategyID string                 `json:"strategy_id"`
		Params     map[string]interface{} `json:"params"`
		Response   interface{}            `json:"response"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	record, err := h.service.CreateRecord(req.StrategyID, req.Params, req.Response)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(record)
}

func (h *APIHandler) UpdateRecordStatus(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RecordID string              `json:"record_id"`
		Status   models.CacheStatus `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	err := h.service.UpdateRecordStatus(req.RecordID, req.Status)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *APIHandler) InvalidateCache(w http.ResponseWriter, r *http.Request) {
	var req struct {
		RecordID string `json:"record_id"`
		Reason   string `json:"reason"`
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	err := h.service.InvalidateCache(req.RecordID, req.Reason, req.Operator)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.WriteHeader(http.StatusOK)
}

func (h *APIHandler) CreateBypass(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Path     string                 `json:"path"`
		Method   string                 `json:"method"`
		Params   map[string]interface{} `json:"params"`
		Reason   string                 `json:"reason"`
		Operator string                 `json:"operator"`
		Duration time.Duration          `json:"duration"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	bypass, err := h.service.CreateBypass(req.Path, req.Method, req.Params, req.Reason, req.Operator, req.Duration)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(bypass)
}

func (h *APIHandler) ListRecords(w http.ResponseWriter, r *http.Request) {
	strategyID := r.URL.Query().Get("strategy_id")
	records := h.service.ListRecords(strategyID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(records)
}

func (h *APIHandler) GetRecordHistory(w http.ResponseWriter, r *http.Request) {
	recordID := r.URL.Query().Get("record_id")
	if recordID == "" {
		http.Error(w, "record_id is required", http.StatusBadRequest)
		return
	}
	history, err := h.service.GetRecordHistory(recordID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(history)
}

func (h *APIHandler) ExportRecords(w http.ResponseWriter, r *http.Request) {
	strategyID := r.URL.Query().Get("strategy_id")
	data, err := h.service.ExportRecords(strategyID)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=\"cache_records.json\"")
	w.Write(data)
}

func (h *APIHandler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	logs := h.service.GetAuditLogs(100)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(logs)
}
