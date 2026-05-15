package handler

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/internal/service"
	"encoding/json"
	"net/http"
)

type EnvironmentHandler struct {
	envService *service.EnvironmentService
}

func NewEnvironmentHandler() *EnvironmentHandler {
	return &EnvironmentHandler{
		envService: service.NewEnvironmentService(),
	}
}

func (h *EnvironmentHandler) CreateEnvironment(w http.ResponseWriter, r *http.Request) {
	var req service.CreateEnvRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	env, err := h.envService.CreateEnvironment(req)
	if err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to create environment", err)
		return
	}

	JSONResponse(w, http.StatusCreated, env)
}

func (h *EnvironmentHandler) GetEnvironment(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/environments/")
	if id == "" {
		JSONError(w, http.StatusBadRequest, "environment id is required", nil)
		return
	}

	env, err := h.envService.GetEnvironment(id)
	if err != nil {
		JSONError(w, http.StatusNotFound, "environment not found", err)
		return
	}

	JSONResponse(w, http.StatusOK, env)
}

func (h *EnvironmentHandler) ListEnvironments(w http.ResponseWriter, r *http.Request) {
	page, pageSize := GetPagination(r)
	customerID := r.URL.Query().Get("customer_id")

	var envs []models.CustomerEnvironment
	var total int64
	var err error

	if customerID != "" {
		envs, total, err = h.envService.ListByCustomer(customerID, page, pageSize)
	} else {
		envs, total, err = h.envService.ListEnvironments(page, pageSize)
	}

	if err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to list environments", err)
		return
	}

	JSONResponse(w, http.StatusOK, map[string]interface{}{
		"items": envs,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

func (h *EnvironmentHandler) UpdateEnvironment(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/environments/")
	if id == "" {
		JSONError(w, http.StatusBadRequest, "environment id is required", nil)
		return
	}

	var req struct {
		Description string `json:"description"`
		Region      string `json:"region"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	env, err := h.envService.UpdateEnvironment(id, req.Description, req.Region)
	if err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to update environment", err)
		return
	}

	JSONResponse(w, http.StatusOK, env)
}

func (h *EnvironmentHandler) DeleteEnvironment(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/environments/")
	if id == "" {
		JSONError(w, http.StatusBadRequest, "environment id is required", nil)
		return
	}

	if err := h.envService.DeleteEnvironment(id); err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to delete environment", err)
		return
	}

	JSONResponse(w, http.StatusOK, map[string]string{"message": "environment deleted"})
}

func (h *EnvironmentHandler) AddProxySetting(w http.ResponseWriter, r *http.Request) {
	envID := GetIDFromURL(r.URL.Path, "/api/environments/")
	envID = envID[:len(envID)-len("/proxies")]
	if envID == "" {
		JSONError(w, http.StatusBadRequest, "environment id is required", nil)
		return
	}

	var proxy models.ProxySetting
	if err := json.NewDecoder(r.Body).Decode(&proxy); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	result, err := h.envService.AddProxySetting(envID, &proxy)
	if err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to add proxy setting", err)
		return
	}

	JSONResponse(w, http.StatusCreated, result)
}

func (h *EnvironmentHandler) GetProxySettings(w http.ResponseWriter, r *http.Request) {
	envID := GetIDFromURL(r.URL.Path, "/api/environments/")
	envID = envID[:len(envID)-len("/proxies")]
	if envID == "" {
		JSONError(w, http.StatusBadRequest, "environment id is required", nil)
		return
	}

	proxies, err := h.envService.GetProxySettings(envID)
	if err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to get proxy settings", err)
		return
	}

	JSONResponse(w, http.StatusOK, proxies)
}

func (h *EnvironmentHandler) DeleteProxySetting(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/proxies/")
	if id == "" {
		JSONError(w, http.StatusBadRequest, "proxy id is required", nil)
		return
	}

	if err := h.envService.DeleteProxySetting(id); err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to delete proxy setting", err)
		return
	}

	JSONResponse(w, http.StatusOK, map[string]string{"message": "proxy setting deleted"})
}
