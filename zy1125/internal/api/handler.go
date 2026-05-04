package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"

	"github.com/gorilla/mux"

	"config-manager/internal/model"
	"config-manager/internal/service"
)

type Handler struct {
	configService *service.ConfigService
}

func NewHandler(cs *service.ConfigService) *Handler {
	return &Handler{configService: cs}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func respondError(w http.ResponseWriter, code int, err error) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)

	resp := struct {
		Error string `json:"error"`
		Code  string `json:"code,omitempty"`
	}{
		Error: err.Error(),
	}

	if appErr, ok := err.(*model.AppError); ok {
		resp.Code = appErr.Code
	}

	json.NewEncoder(w).Encode(resp)
}

func getOperator(r *http.Request) string {
	op := r.Header.Get("X-Operator")
	if op == "" {
		op = "anonymous"
	}
	return op
}

func (h *Handler) CreateTenant(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body"))
		return
	}
	if req.Name == "" {
		respondError(w, http.StatusBadRequest, fmt.Errorf("name is required"))
		return
	}

	tenant := &model.Tenant{
		ID:   model.NewID(),
		Name: req.Name,
	}

	respondJSON(w, http.StatusCreated, tenant)
}

func (h *Handler) CreateConfigVersion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	configID := vars["config_id"]

	var req struct {
		Value json.RawMessage `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body"))
		return
	}

	operator := getOperator(r)

	version, err := h.configService.CreateVersion(configID, req.Value, operator)
	if err != nil {
		if err == model.ErrConfigNotFound {
			respondError(w, http.StatusNotFound, err)
			return
		}
		respondError(w, http.StatusBadRequest, err)
		return
	}

	respondJSON(w, http.StatusCreated, version)
}

func (h *Handler) ValidateConfigVersion(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	configID := vars["config_id"]

	var req struct {
		Value json.RawMessage `json:"value"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body"))
		return
	}

	result, err := h.configService.ValidateVersion(configID, req.Value)
	if err != nil {
		if err == model.ErrConfigNotFound {
			respondError(w, http.StatusNotFound, err)
			return
		}
		respondError(w, http.StatusBadRequest, err)
		return
	}

	respondJSON(w, http.StatusOK, result)
}

func (h *Handler) DiffVersions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	oldVID := vars["old_version_id"]
	newVID := vars["new_version_id"]

	diff, err := h.configService.DiffVersions(oldVID, newVID)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	respondJSON(w, http.StatusOK, diff)
}

func (h *Handler) CreateRelease(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TenantID      string            `json:"tenant_id"`
		ServiceID     string            `json:"service_id"`
		Name          string            `json:"name"`
		ConfigChanges []string          `json:"config_changes"`
		GrayRule      *model.GrayRule   `json:"gray_rule"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body"))
		return
	}

	if req.TenantID == "" || req.ServiceID == "" || req.Name == "" || len(req.ConfigChanges) == 0 {
		respondError(w, http.StatusBadRequest, fmt.Errorf("tenant_id, service_id, name, and config_changes are required"))
		return
	}

	operator := getOperator(r)

	release, err := h.configService.CreateRelease(
		req.TenantID,
		req.ServiceID,
		req.Name,
		req.ConfigChanges,
		req.GrayRule,
		operator,
	)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	respondJSON(w, http.StatusCreated, release)
}

func (h *Handler) StartRelease(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	releaseID := vars["release_id"]

	operator := getOperator(r)

	if err := h.configService.StartRelease(releaseID, operator); err != nil {
		if err == model.ErrReleaseNotFound {
			respondError(w, http.StatusNotFound, err)
			return
		}
		respondError(w, http.StatusBadRequest, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) PauseRelease(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	releaseID := vars["release_id"]

	operator := getOperator(r)

	if err := h.configService.PauseRelease(releaseID, operator); err != nil {
		if err == model.ErrReleaseNotFound {
			respondError(w, http.StatusNotFound, err)
			return
		}
		respondError(w, http.StatusBadRequest, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) ResumeRelease(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	releaseID := vars["release_id"]

	operator := getOperator(r)

	if err := h.configService.ResumeRelease(releaseID, operator); err != nil {
		if err == model.ErrReleaseNotFound {
			respondError(w, http.StatusNotFound, err)
			return
		}
		respondError(w, http.StatusBadRequest, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) CompleteRelease(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	releaseID := vars["release_id"]

	operator := getOperator(r)

	if err := h.configService.CompleteRelease(releaseID, operator); err != nil {
		if err == model.ErrReleaseNotFound {
			respondError(w, http.StatusNotFound, err)
			return
		}
		respondError(w, http.StatusBadRequest, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) RollbackRelease(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	releaseID := vars["release_id"]

	var req struct {
		Reason string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, fmt.Errorf("invalid request body"))
		return
	}

	operator := getOperator(r)

	if err := h.configService.RollbackRelease(releaseID, req.Reason, operator); err != nil {
		if err == model.ErrReleaseNotFound {
			respondError(w, http.StatusNotFound, err)
			return
		}
		respondError(w, http.StatusBadRequest, err)
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}

func (h *Handler) GetClientConfig(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	tenantID := vars["tenant_id"]
	serviceID := vars["service_id"]
	clientID := vars["client_id"]

	region := r.Header.Get("X-Region")
	if region == "" {
		region = "default"
	}

	ifNoneMatch := r.Header.Get("If-None-Match")

	configs, etag, notModified, err := h.configService.GetClientConfig(tenantID, serviceID, clientID, region, ifNoneMatch)
	if err != nil {
		respondError(w, http.StatusBadRequest, err)
		return
	}

	w.Header().Set("ETag", etag)

	if notModified {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	respondJSON(w, http.StatusOK, configs)
}

func (h *Handler) GetReleaseReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	releaseID := vars["release_id"]

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	report, err := h.configService.GenerateReleaseReport(releaseID)
	if err != nil {
		if err == model.ErrReleaseNotFound {
			respondError(w, http.StatusNotFound, err)
			return
		}
		respondError(w, http.StatusBadRequest, err)
		return
	}

	if strings.ToLower(format) == "markdown" || strings.ToLower(format) == "md" {
		md, err := h.configService.ExportReportMarkdown(report)
		if err != nil {
			respondError(w, http.StatusInternalServerError, err)
			return
		}
		w.Header().Set("Content-Type", "text/markdown; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(md))
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
