package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"performance-tracker/internal/models"
	"performance-tracker/internal/services"
	"performance-tracker/pkg/logger"

	"github.com/gorilla/mux"
)

type RouteHandler struct {
	routeService *services.RouteService
	projectService *services.ProjectService
}

func NewRouteHandler(routeService *services.RouteService, projectService *services.ProjectService) *RouteHandler {
	return &RouteHandler{
		routeService: routeService,
		projectService: projectService,
	}
}

func (h *RouteHandler) RegisterRoutes(router *mux.Router) {
	routesRouter := router.PathPrefix("/routes").Subrouter()
	routesRouter.HandleFunc("", h.CreateRoute).Methods("POST")
	routesRouter.HandleFunc("/project/{project_id:[0-9]+}", h.GetRoutesByProjectID).Methods("GET")
	routesRouter.HandleFunc("/{id:[0-9]+}", h.GetRoute).Methods("GET")
	routesRouter.HandleFunc("/{id:[0-9]+}", h.UpdateRoute).Methods("PUT")
	routesRouter.HandleFunc("/{id:[0-9]+}", h.DeleteRoute).Methods("DELETE")
	routesRouter.HandleFunc("/{id:[0-9]+}/budget", h.UpdatePerformanceBudget).Methods("PUT")
	routesRouter.HandleFunc("/{id:[0-9]+}/check-budget", h.CheckBudgetViolation).Methods("POST")
}

func (h *RouteHandler) CreateRoute(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var route models.Route
	if err := json.NewDecoder(r.Body).Decode(&route); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 验证必要字段
	if strings.TrimSpace(route.Method) == "" {
		sendErrorResponse(w, http.StatusBadRequest, "HTTP method is required")
		return
	}
	if strings.TrimSpace(route.Path) == "" {
		sendErrorResponse(w, http.StatusBadRequest, "Route path is required")
		return
	}
	if route.ProjectID == 0 {
		sendErrorResponse(w, http.StatusBadRequest, "Project ID is required")
		return
	}

	// 验证项目是否存在
	_, err := h.projectService.GetProjectByID(ctx, route.ProjectID)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Project with ID "+strconv.FormatUint(uint64(route.ProjectID), 10)+" not found")
		return
	}

	// 标准化 HTTP 方法
	route.Method = strings.ToUpper(route.Method)

	if err := h.routeService.CreateRoute(ctx, &route); err != nil {
		logger.Errorf("Failed to create route: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to create route: "+err.Error())
		return
	}

	logger.Infof("Route created successfully: %s %s (ID: %d)", route.Method, route.Path, route.ID)
	sendSuccessResponse(w, http.StatusCreated, route, "Route created successfully")
}

func (h *RouteHandler) GetRoutesByProjectID(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	projectIDStr := vars["project_id"]
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid project ID: "+err.Error())
		return
	}

	routes, err := h.routeService.GetRoutesByProjectID(ctx, uint(projectID))
	if err != nil {
		logger.Errorf("Failed to get routes by project ID: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to get routes: "+err.Error())
		return
	}

	sendSuccessResponse(w, http.StatusOK, routes, "")
}

func (h *RouteHandler) GetRoute(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid route ID: "+err.Error())
		return
	}

	route, err := h.routeService.GetRouteByID(ctx, uint(id))
	if err != nil {
		logger.Errorf("Failed to get route: %v", err)
		sendErrorResponse(w, http.StatusNotFound, "Route not found")
		return
	}

	sendSuccessResponse(w, http.StatusOK, route, "")
}

func (h *RouteHandler) UpdateRoute(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid route ID: "+err.Error())
		return
	}

	// 检查路由是否存在
	existingRoute, err := h.routeService.GetRouteByID(ctx, uint(id))
	if err != nil {
		sendErrorResponse(w, http.StatusNotFound, "Route not found")
		return
	}

	var updatedRoute models.Route
	if err := json.NewDecoder(r.Body).Decode(&updatedRoute); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 保持原有的创建时间和ID
	updatedRoute.ID = existingRoute.ID
	updatedRoute.CreatedAt = existingRoute.CreatedAt
	updatedRoute.ProjectID = existingRoute.ProjectID

	// 标准化 HTTP 方法
	if updatedRoute.Method != "" {
		updatedRoute.Method = strings.ToUpper(updatedRoute.Method)
	}

	if err := h.routeService.UpdateRoute(ctx, &updatedRoute); err != nil {
		logger.Errorf("Failed to update route: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to update route: "+err.Error())
		return
	}

	logger.Infof("Route updated successfully: %s %s (ID: %d)", updatedRoute.Method, updatedRoute.Path, updatedRoute.ID)
	sendSuccessResponse(w, http.StatusOK, updatedRoute, "Route updated successfully")
}

func (h *RouteHandler) DeleteRoute(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid route ID: "+err.Error())
		return
	}

	// 检查路由是否存在
	_, err = h.routeService.GetRouteByID(ctx, uint(id))
	if err != nil {
		sendErrorResponse(w, http.StatusNotFound, "Route not found")
		return
	}

	if err := h.routeService.DeleteRoute(ctx, uint(id)); err != nil {
		logger.Errorf("Failed to delete route: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to delete route: "+err.Error())
		return
	}

	logger.Infof("Route deleted successfully: ID %d", id)
	sendSuccessResponse(w, http.StatusOK, nil, "Route deleted successfully")
}

func (h *RouteHandler) UpdatePerformanceBudget(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid route ID: "+err.Error())
		return
	}

	// 检查路由是否存在
	_, err = h.routeService.GetRouteByID(ctx, uint(id))
	if err != nil {
		sendErrorResponse(w, http.StatusNotFound, "Route not found")
		return
	}

	var budget models.PerformanceBudget
	if err := json.NewDecoder(r.Body).Decode(&budget); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 验证预算值
	if budget.P95MaxMs < 0 {
		sendErrorResponse(w, http.StatusBadRequest, "P95 max milliseconds cannot be negative")
		return
	}
	if budget.P99MaxMs < 0 {
		sendErrorResponse(w, http.StatusBadRequest, "P99 max milliseconds cannot be negative")
		return
	}
	if budget.ErrorRateMax < 0 || budget.ErrorRateMax > 1 {
		sendErrorResponse(w, http.StatusBadRequest, "Error rate must be between 0 and 1")
		return
	}
	if budget.TimeoutRateMax < 0 || budget.TimeoutRateMax > 1 {
		sendErrorResponse(w, http.StatusBadRequest, "Timeout rate must be between 0 and 1")
		return
	}
	if budget.ThroughputMin < 0 {
		sendErrorResponse(w, http.StatusBadRequest, "Throughput minimum cannot be negative")
		return
	}

	if err := h.routeService.UpdatePerformanceBudget(ctx, uint(id), budget); err != nil {
		logger.Errorf("Failed to update performance budget: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to update performance budget: "+err.Error())
		return
	}

	logger.Infof("Performance budget updated successfully for route ID: %d", id)
	sendSuccessResponse(w, http.StatusOK, budget, "Performance budget updated successfully")
}

func (h *RouteHandler) CheckBudgetViolation(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid route ID: "+err.Error())
		return
	}

	// 检查路由是否存在
	_, err = h.routeService.GetRouteByID(ctx, uint(id))
	if err != nil {
		sendErrorResponse(w, http.StatusNotFound, "Route not found")
		return
	}

	var metrics models.RunMetrics
	if err := json.NewDecoder(r.Body).Decode(&metrics); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	hasViolation, message := h.routeService.CheckBudgetViolation(ctx, uint(id), metrics)

	result := map[string]interface{}{
		"has_violation": hasViolation,
		"message":       message,
		"metrics":       metrics,
	}

	sendSuccessResponse(w, http.StatusOK, result, "")
}
