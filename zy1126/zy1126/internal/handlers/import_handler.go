package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"performance-tracker/internal/services"
	"performance-tracker/pkg/logger"

	"github.com/gorilla/mux"
)

type ImportHandler struct {
	importService *services.ImportService
}

func NewImportHandler(importService *services.ImportService) *ImportHandler {
	return &ImportHandler{importService: importService}
}

func (h *ImportHandler) RegisterRoutes(router *mux.Router) {
	importRouter := router.PathPrefix("/import").Subrouter()
	importRouter.HandleFunc("/routes", h.ImportRoutes).Methods("POST")
	importRouter.HandleFunc("/samples", h.ImportSamples).Methods("POST")
	importRouter.HandleFunc("/baseline", h.ImportBaseline).Methods("POST")
	importRouter.HandleFunc("/profile-events", h.ImportProfileEvents).Methods("POST")
}

func (h *ImportHandler) ImportRoutes(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var request struct {
		ProjectID uint   `json:"project_id"`
		FilePath  string `json:"file_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 验证必要字段
	if request.ProjectID == 0 {
		sendErrorResponse(w, http.StatusBadRequest, "Project ID is required")
		return
	}
	if request.FilePath == "" {
		sendErrorResponse(w, http.StatusBadRequest, "File path is required")
		return
	}

	count, err := h.importService.ImportRoutesYAML(ctx, request.ProjectID, request.FilePath)
	if err != nil {
		logger.Errorf("Failed to import routes: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to import routes: "+err.Error())
		return
	}

	logger.Infof("Successfully imported %d routes for project ID: %d", count, request.ProjectID)
	sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"imported_count": count,
		"project_id":     request.ProjectID,
	}, "Routes imported successfully")
}

func (h *ImportHandler) ImportSamples(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var request struct {
		ProjectID uint   `json:"project_id"`
		FilePath  string `json:"file_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 验证必要字段
	if request.ProjectID == 0 {
		sendErrorResponse(w, http.StatusBadRequest, "Project ID is required")
		return
	}
	if request.FilePath == "" {
		sendErrorResponse(w, http.StatusBadRequest, "File path is required")
		return
	}

	count, err := h.importService.ImportSamplesJSONL(ctx, request.ProjectID, request.FilePath)
	if err != nil {
		logger.Errorf("Failed to import samples: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to import samples: "+err.Error())
		return
	}

	logger.Infof("Successfully imported %d samples for project ID: %d", count, request.ProjectID)
	sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"imported_count": count,
		"project_id":     request.ProjectID,
	}, "Samples imported successfully")
}

func (h *ImportHandler) ImportBaseline(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var request struct {
		ProjectID uint   `json:"project_id"`
		FilePath  string `json:"file_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 验证必要字段
	if request.ProjectID == 0 {
		sendErrorResponse(w, http.StatusBadRequest, "Project ID is required")
		return
	}
	if request.FilePath == "" {
		sendErrorResponse(w, http.StatusBadRequest, "File path is required")
		return
	}

	baseline, err := h.importService.ImportBaselineJSON(ctx, request.ProjectID, request.FilePath)
	if err != nil {
		logger.Errorf("Failed to import baseline: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to import baseline: "+err.Error())
		return
	}

	logger.Infof("Successfully imported baseline '%s' for project ID: %d", baseline.Name, request.ProjectID)
	sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"baseline":   baseline,
		"project_id": request.ProjectID,
	}, "Baseline imported successfully")
}

func (h *ImportHandler) ImportProfileEvents(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	var request struct {
		ProjectID uint   `json:"project_id"`
		RunID     *uint  `json:"run_id,omitempty"`
		FilePath  string `json:"file_path"`
	}

	if err := json.NewDecoder(r.Body).Decode(&request); err != nil {
		logger.Errorf("Failed to decode request body: %v", err)
		sendErrorResponse(w, http.StatusBadRequest, "Invalid request body: "+err.Error())
		return
	}

	// 验证必要字段
	if request.ProjectID == 0 {
		sendErrorResponse(w, http.StatusBadRequest, "Project ID is required")
		return
	}
	if request.FilePath == "" {
		sendErrorResponse(w, http.StatusBadRequest, "File path is required")
		return
	}

	count, err := h.importService.ImportProfileEventsJSON(ctx, request.ProjectID, request.FilePath, request.RunID)
	if err != nil {
		logger.Errorf("Failed to import profile events: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to import profile events: "+err.Error())
		return
	}

	logger.Infof("Successfully imported %d profile events for project ID: %d", count, request.ProjectID)
	sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"imported_count": count,
		"project_id":     request.ProjectID,
		"run_id":         request.RunID,
	}, "Profile events imported successfully")
}
