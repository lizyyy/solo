package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"path/filepath"
	"strconv"
	"strings"

	"middleware-diagnostic/internal/model"
	"middleware-diagnostic/internal/service"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) JSONResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *Handler) ErrorResponse(w http.ResponseWriter, status int, code, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error": map[string]string{
			"code":    code,
			"message": message,
		},
	})
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.JSONResponse(w, http.StatusOK, map[string]string{
		"status": "ok",
	})
}

func (h *Handler) ImportData(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	dataType := r.URL.Query().Get("type")
	filePath := r.URL.Query().Get("file")

	if dataType == "" {
		h.ErrorResponse(w, http.StatusBadRequest, "missing_type", "Missing 'type' query parameter")
		return
	}

	if filePath == "" {
		h.ErrorResponse(w, http.StatusBadRequest, "missing_file", "Missing 'file' query parameter")
		return
	}

	if !filepath.IsAbs(filePath) {
		basePath := "./"
		filePath = filepath.Join(basePath, filePath)
	}

	var result *model.ImportResult
	var err error

	switch strings.ToLower(dataType) {
	case "routes":
		result, err = h.svc.ImportRoutes(filePath)
	case "middlewares":
		result, err = h.svc.ImportMiddlewares(filePath)
	case "request-traces":
		result, err = h.svc.ImportRequestTraces(filePath)
	case "context-events":
		result, err = h.svc.ImportContextEvents(filePath)
	case "policies":
		result, err = h.svc.ImportPolicies(filePath)
	default:
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_type",
			"Invalid type. Supported types: routes, middlewares, request-traces, context-events, policies")
		return
	}

	if err != nil {
		h.ErrorResponse(w, http.StatusInternalServerError, "import_failed", err.Error())
		return
	}

	h.JSONResponse(w, http.StatusOK, result)
}

func (h *Handler) ListRoutes(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	routes, err := h.svc.GetAllRoutes()
	if err != nil {
		h.ErrorResponse(w, http.StatusInternalServerError, "database_error", err.Error())
		return
	}

	h.JSONResponse(w, http.StatusOK, map[string]interface{}{
		"routes": routes,
		"count":  len(routes),
	})
}

func (h *Handler) GetRouteChain(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	pathParts := strings.Split(r.URL.Path, "/")

	if len(pathParts) < 3 {
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_path", "Invalid path")
		return
	}

	isChainEndpoint := strings.Contains(r.URL.Path, "/chain")

	var routeIDStr string
	if isChainEndpoint && len(pathParts) >= 4 {
		routeIDStr = pathParts[len(pathParts)-2]
	} else if len(pathParts) >= 3 {
		routeIDStr = pathParts[len(pathParts)-1]
	} else {
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_path", "Invalid path")
		return
	}

	routeID, err := strconv.ParseInt(routeIDStr, 10, 64)
	if err != nil {
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_id", "Invalid route ID")
		return
	}

	includeSuggestion := r.URL.Query().Get("suggestion") == "true"

	if isChainEndpoint {
		data, err := h.svc.ExportRouteChain(routeID)
		if err != nil {
			if err.Error() == "route not found" {
				h.ErrorResponse(w, http.StatusNotFound, "not_found", "Route not found")
				return
			}
			h.ErrorResponse(w, http.StatusInternalServerError, "database_error", err.Error())
			return
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write(data)
		return
	}

	if includeSuggestion {
		suggestion, err := h.svc.GetMiddlewareOrderSuggestion(routeID)
		if err != nil {
			if err.Error() == "route not found" {
				h.ErrorResponse(w, http.StatusNotFound, "not_found", "Route not found")
				return
			}
			h.ErrorResponse(w, http.StatusInternalServerError, "database_error", err.Error())
			return
		}

		h.JSONResponse(w, http.StatusOK, map[string]interface{}{
			"suggestion": suggestion,
		})
		return
	}

	route, err := h.svc.GetRouteWithMiddlewares(routeID)
	if err != nil {
		if err.Error() == "route not found" {
			h.ErrorResponse(w, http.StatusNotFound, "not_found", "Route not found")
			return
		}
		h.ErrorResponse(w, http.StatusInternalServerError, "database_error", err.Error())
		return
	}

	h.JSONResponse(w, http.StatusOK, route)
}

func (h *Handler) RunDiagnostics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	result, err := h.svc.RunDiagnostics()
	if err != nil {
		h.ErrorResponse(w, http.StatusInternalServerError, "diagnostic_error", err.Error())
		return
	}

	h.JSONResponse(w, http.StatusOK, result)
}

func (h *Handler) ListRisks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	statusFilter := r.URL.Query().Get("status")

	risks, err := h.svc.GetRisks(statusFilter)
	if err != nil {
		h.ErrorResponse(w, http.StatusInternalServerError, "database_error", err.Error())
		return
	}

	h.JSONResponse(w, http.StatusOK, map[string]interface{}{
		"risks": risks,
		"count": len(risks),
	})
}

func (h *Handler) UpdateRiskStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPatch && r.Method != http.MethodPut {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_path", "Invalid path")
		return
	}

	riskIDStr := pathParts[len(pathParts)-2]
	riskID, err := strconv.ParseInt(riskIDStr, 10, 64)
	if err != nil {
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_id", "Invalid risk ID")
		return
	}

	var req struct {
		Status string `json:"status"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_body", "Invalid request body")
		return
	}

	validStatuses := map[string]bool{"new": true, "confirmed": true, "false_positive": true, "resolved": true}
	if !validStatuses[req.Status] {
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_status",
			"Invalid status. Valid values: new, confirmed, false_positive, resolved")
		return
	}

	if err := h.svc.UpdateRiskStatus(riskID, req.Status); err != nil {
		h.ErrorResponse(w, http.StatusInternalServerError, "update_error", err.Error())
		return
	}

	h.JSONResponse(w, http.StatusOK, map[string]string{
		"status": "updated",
	})
}

func (h *Handler) ReplayRequests(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	var req model.ReplayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_body", "Invalid request body")
		return
	}

	result, err := h.svc.ReplayRequests(&req)
	if err != nil {
		h.ErrorResponse(w, http.StatusInternalServerError, "replay_error", err.Error())
		return
	}

	h.JSONResponse(w, http.StatusOK, result)
}

func (h *Handler) ExportReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	statusFilter := r.URL.Query().Get("status")

	data, contentType, err := h.svc.ExportReport(format, statusFilter)
	if err != nil {
		h.ErrorResponse(w, http.StatusInternalServerError, "export_error", err.Error())
		return
	}

	var ext string
	switch format {
	case "markdown", "md":
		ext = "md"
	case "json":
		ext = "json"
	case "csv":
		ext = "csv"
	default:
		ext = "txt"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=diagnostic-report.%s", ext))
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

func (h *Handler) GetRequestTrace(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	pathParts := strings.Split(r.URL.Path, "/")
	if len(pathParts) < 4 {
		h.ErrorResponse(w, http.StatusBadRequest, "invalid_path", "Invalid path")
		return
	}

	traceID := pathParts[len(pathParts)-1]

	includeEvents := r.URL.Query().Get("events") == "true"

	trace, err := h.svc.GetRequestTrace(traceID)
	if err != nil {
		if err.Error() == "trace not found" {
			h.ErrorResponse(w, http.StatusNotFound, "not_found", "Trace not found")
			return
		}
		h.ErrorResponse(w, http.StatusInternalServerError, "database_error", err.Error())
		return
	}

	if includeEvents {
		events, err := h.svc.GetContextEvents(traceID)
		if err != nil {
			h.ErrorResponse(w, http.StatusInternalServerError, "database_error", err.Error())
			return
		}

		h.JSONResponse(w, http.StatusOK, map[string]interface{}{
			"trace":  trace,
			"events": events,
		})
		return
	}

	h.JSONResponse(w, http.StatusOK, trace)
}

func (h *Handler) ReloadRules(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		h.ErrorResponse(w, http.StatusMethodNotAllowed, "method_not_allowed", "Method not allowed")
		return
	}

	if err := h.svc.ReloadDiagnosticRules(); err != nil {
		h.ErrorResponse(w, http.StatusInternalServerError, "reload_error", err.Error())
		return
	}

	h.JSONResponse(w, http.StatusOK, map[string]string{
		"status": "reloaded",
	})
}
