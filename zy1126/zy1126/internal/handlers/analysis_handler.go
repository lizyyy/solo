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

type AnalysisHandler struct {
	comparisonService  *services.ComparisonService
	attributionService *services.AttributionService
}

func NewAnalysisHandler(comparisonService *services.ComparisonService, attributionService *services.AttributionService) *AnalysisHandler {
	return &AnalysisHandler{
		comparisonService:  comparisonService,
		attributionService: attributionService,
	}
}

func (h *AnalysisHandler) RegisterRoutes(router *mux.Router) {
	analysisRouter := router.PathPrefix("/analysis").Subrouter()
	analysisRouter.HandleFunc("/compare/{run_id:[0-9]+}", h.CompareRunWithBaseline).Methods("POST")
	analysisRouter.HandleFunc("/compare/{run_id:[0-9]+}", h.GetRunComparisons).Methods("GET")
	analysisRouter.HandleFunc("/attribution/{run_id:[0-9]+}", h.AnalyzeSlowPath).Methods("POST")
	analysisRouter.HandleFunc("/attribution/{run_id:[0-9]+}", h.GetSlowPathAttributions).Methods("GET")
}

func (h *AnalysisHandler) CompareRunWithBaseline(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	runIDStr := vars["run_id"]
	runID, err := strconv.ParseUint(runIDStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	// 可选的基线 ID
	var request struct {
		BaselineID *uint `json:"baseline_id,omitempty"`
	}

	if r.Body != nil {
		json.NewDecoder(r.Body).Decode(&request)
	}

	comparison, err := h.comparisonService.CompareRunWithBaseline(ctx, uint(runID), request.BaselineID)
	if err != nil {
		logger.Errorf("Failed to compare run with baseline: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to compare run with baseline: "+err.Error())
		return
	}

	logger.Infof("Successfully compared run %d with baseline", runID)
	sendSuccessResponse(w, http.StatusOK, comparison, "Comparison completed successfully")
}

func (h *AnalysisHandler) GetRunComparisons(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	runIDStr := vars["run_id"]
	runID, err := strconv.ParseUint(runIDStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	comparisons, err := h.comparisonService.GetRunComparisonsByRunID(ctx, uint(runID))
	if err != nil {
		logger.Errorf("Failed to get run comparisons: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to get run comparisons: "+err.Error())
		return
	}

	sendSuccessResponse(w, http.StatusOK, comparisons, "")
}

func (h *AnalysisHandler) AnalyzeSlowPath(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	runIDStr := vars["run_id"]
	runID, err := strconv.ParseUint(runIDStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	attributions, err := h.attributionService.AnalyzeSlowPath(ctx, uint(runID))
	if err != nil {
		logger.Errorf("Failed to analyze slow path: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to analyze slow path: "+err.Error())
		return
	}

	logger.Infof("Successfully analyzed slow path for run %d, found %d issues", runID, len(attributions))
	sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"attributions": attributions,
		"total_issues": len(attributions),
	}, "Slow path analysis completed successfully")
}

func (h *AnalysisHandler) GetSlowPathAttributions(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	runIDStr := vars["run_id"]
	runID, err := strconv.ParseUint(runIDStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	attributions, err := h.attributionService.GetSlowPathAttributionsByRunID(ctx, uint(runID))
	if err != nil {
		logger.Errorf("Failed to get slow path attributions: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to get slow path attributions: "+err.Error())
		return
	}

	sendSuccessResponse(w, http.StatusOK, attributions, "")
}
