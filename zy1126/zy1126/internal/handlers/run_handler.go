package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"performance-tracker/internal/models"
	"performance-tracker/internal/services"
	"performance-tracker/pkg/logger"

	"github.com/gorilla/mux"
)

type RunHandler struct {
	runService     *services.RunService
	projectService *services.ProjectService
}

func NewRunHandler(runService *services.RunService, projectService *services.ProjectService) *RunHandler {
	return &RunHandler{
		runService:     runService,
		projectService: projectService,
	}
}

func (h *RunHandler) RegisterRoutes(router *mux.Router) {
	runsRouter := router.PathPrefix("/runs").Subrouter()
	runsRouter.HandleFunc("", h.CreateRun).Methods("POST")
	runsRouter.HandleFunc("/project/{project_id:[0-9]+}", h.GetRunsByProjectID).Methods("GET")
	runsRouter.HandleFunc("/{id:[0-9]+}", h.GetRun).Methods("GET")
	runsRouter.HandleFunc("/{id:[0-9]+}", h.UpdateRun).Methods("PUT")
	runsRouter.HandleFunc("/{id:[0-9]+}", h.DeleteRun).Methods("DELETE")
	runsRouter.HandleFunc("/{id:[0-9]+}/start", h.StartRun).Methods("POST")
	runsRouter.HandleFunc("/{id:[0-9]+}/stop", h.StopRun).Methods("POST")
	runsRouter.HandleFunc("/{id:[0-9]+}/status", h.GetRunStatus).Methods("GET")
}

func (h *RunHandler) CreateRun(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var run models.Run
	if err := json.NewDecoder(r.Body).Decode(&run); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 验证必要字段
	if run.ProjectID == 0 {
		sendErrorResponse(w, http.StatusBadRequest, "Project ID is required")
		return
	}

	// 验证项目是否存在
	_, err := h.projectService.GetProjectByID(ctx, run.ProjectID)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Project with ID "+strconv.FormatUint(uint64(run.ProjectID), 10)+" not found")
		return
	}

	if err := h.runService.CreateRun(ctx, &run); err != nil {
		logger.Errorf("Failed to create run: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to create run: "+err.Error())
		return
	}

	logger.Infof("Run created successfully: %s (ID: %d)", run.Name, run.ID)
	sendSuccessResponse(w, http.StatusCreated, run, "Run created successfully")
}

func (h *RunHandler) GetRunsByProjectID(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	projectIDStr := vars["project_id"]
	projectID, err := strconv.ParseUint(projectIDStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid project ID: "+err.Error())
		return
	}

	runs, err := h.runService.GetRunsByProjectID(ctx, uint(projectID))
	if err != nil {
		logger.Errorf("Failed to get runs by project ID: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to get runs: "+err.Error())
		return
	}

	sendSuccessResponse(w, http.StatusOK, runs, "")
}

func (h *RunHandler) GetRun(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	run, err := h.runService.GetRunByID(ctx, uint(id))
	if err != nil {
		logger.Errorf("Failed to get run: %v", err)
		sendErrorResponse(w, http.StatusNotFound, "Run not found")
		return
	}

	sendSuccessResponse(w, http.StatusOK, run, "")
}

func (h *RunHandler) UpdateRun(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	// 检查运行是否存在
	existingRun, err := h.runService.GetRunByID(ctx, uint(id))
	if err != nil {
		sendErrorResponse(w, http.StatusNotFound, "Run not found")
		return
	}

	// 只能更新 pending 状态的运行
	if existingRun.Status != models.RunStatusPending {
		sendErrorResponse(w, http.StatusBadRequest, "Cannot update run that is not in pending status")
		return
	}

	var updatedRun models.Run
	if err := json.NewDecoder(r.Body).Decode(&updatedRun); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 保持原有的创建时间和ID
	updatedRun.ID = existingRun.ID
	updatedRun.CreatedAt = existingRun.CreatedAt
	updatedRun.ProjectID = existingRun.ProjectID
	updatedRun.Status = existingRun.Status

	if err := h.runService.UpdateRun(ctx, &updatedRun); err != nil {
		logger.Errorf("Failed to update run: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to update run: "+err.Error())
		return
	}

	logger.Infof("Run updated successfully: %s (ID: %d)", updatedRun.Name, updatedRun.ID)
	sendSuccessResponse(w, http.StatusOK, updatedRun, "Run updated successfully")
}

func (h *RunHandler) DeleteRun(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	// 检查运行是否存在
	_, err = h.runService.GetRunByID(ctx, uint(id))
	if err != nil {
		sendErrorResponse(w, http.StatusNotFound, "Run not found")
		return
	}

	if err := h.runService.DeleteRun(ctx, uint(id)); err != nil {
		logger.Errorf("Failed to delete run: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to delete run: "+err.Error())
		return
	}

	logger.Infof("Run deleted successfully: ID %d", id)
	sendSuccessResponse(w, http.StatusOK, nil, "Run deleted successfully")
}

func (h *RunHandler) StartRun(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	if err := h.runService.StartRun(ctx, uint(id)); err != nil {
		logger.Errorf("Failed to start run: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to start run: "+err.Error())
		return
	}

	// 获取运行状态
	status, err := h.runService.GetRunStatus(ctx, uint(id))
	if err != nil {
		logger.Errorf("Failed to get run status: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to get run status: "+err.Error())
		return
	}

	logger.Infof("Run started successfully: ID %d", id)
	sendSuccessResponse(w, http.StatusOK, status, "Run started successfully")
}

func (h *RunHandler) StopRun(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	if err := h.runService.StopRun(ctx, uint(id)); err != nil {
		logger.Errorf("Failed to stop run: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to stop run: "+err.Error())
		return
	}

	// 获取运行状态
	status, err := h.runService.GetRunStatus(ctx, uint(id))
	if err != nil {
		logger.Errorf("Failed to get run status: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to get run status: "+err.Error())
		return
	}

	logger.Infof("Run stopped successfully: ID %d", id)
	sendSuccessResponse(w, http.StatusOK, status, "Run stopped successfully")
}

func (h *RunHandler) GetRunStatus(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	status, err := h.runService.GetRunStatus(ctx, uint(id))
	if err != nil {
		logger.Errorf("Failed to get run status: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to get run status: "+err.Error())
		return
	}

	sendSuccessResponse(w, http.StatusOK, status, "")
}
