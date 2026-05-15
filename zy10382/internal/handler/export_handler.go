package handler

import (
	"customer-probe-api/internal/service"
	"net/http"
	"strings"
)

type ExportHandler struct {
	exportService *service.ExportService
}

func NewExportHandler() *ExportHandler {
	return &ExportHandler{
		exportService: service.NewExportService(),
	}
}

func (h *ExportHandler) ExportTaskEvidence(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/export/tasks/")
	id = id[:len(id)-len("/evidence")]
	if id == "" {
		JSONError(w, http.StatusBadRequest, "task id is required", nil)
		return
	}

	data, filename, err := h.exportService.ExportTaskEvidence(id)
	if err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to export evidence", err)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}

func (h *ExportHandler) ExportHistory(w http.ResponseWriter, r *http.Request) {
	envID := GetIDFromURL(r.URL.Path, "/api/export/environments/")
	envID = envID[:len(envID)-len("/history")]
	if envID == "" {
		JSONError(w, http.StatusBadRequest, "environment id is required", nil)
		return
	}

	startTime, endTime, err := GetTimeRange(r)
	if err != nil {
		JSONError(w, http.StatusBadRequest, "invalid time range", err)
		return
	}

	data, filename, err := h.exportService.ExportHistory(envID, startTime, endTime)
	if err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to export history", err)
		return
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	w.WriteHeader(http.StatusOK)
	w.Write(data)
}
