package handlers

import (
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"
	"time"

	"performance-tracker/internal/services"
	"performance-tracker/pkg/logger"

	"github.com/gorilla/mux"
)

type ReportHandler struct {
	reportService *services.ReportService
}

func NewReportHandler(reportService *services.ReportService) *ReportHandler {
	return &ReportHandler{reportService: reportService}
}

func (h *ReportHandler) RegisterRoutes(router *mux.Router) {
	reportRouter := router.PathPrefix("/reports").Subrouter()
	reportRouter.HandleFunc("/export/{run_id:[0-9]+}/{format}", h.ExportReport).Methods("POST")
	reportRouter.HandleFunc("/export/{run_id:[0-9]+}/{format}", h.DownloadReport).Methods("GET")
	reportRouter.HandleFunc("/run/{run_id:[0-9]+}", h.GetReportsByRunID).Methods("GET")
	reportRouter.HandleFunc("/{id:[0-9]+}", h.GetReportByID).Methods("GET")
}

func (h *ReportHandler) ExportReport(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 60*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	runIDStr := vars["run_id"]
	format := vars["format"]

	runID, err := strconv.ParseUint(runIDStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	// 验证格式
	format = strings.ToLower(format)
	validFormats := []string{"json", "csv", "markdown", "md"}
	valid := false
	for _, f := range validFormats {
		if format == f {
			valid = true
			break
		}
	}

	if !valid {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid format: "+format+". Valid formats: json, csv, markdown, md")
		return
	}

	report, err := h.reportService.ExportReport(ctx, uint(runID), format)
	if err != nil {
		logger.Errorf("Failed to export report: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to export report: "+err.Error())
		return
	}

	logger.Infof("Successfully exported report for run %d, format: %s", runID, format)
	sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"report_id": report.ID,
		"run_id":    report.RunID,
		"format":    report.Format,
		"created_at": report.CreatedAt,
	}, "Report exported successfully")
}

func (h *ReportHandler) DownloadReport(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	runIDStr := vars["run_id"]
	format := vars["format"]

	runID, err := strconv.ParseUint(runIDStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	// 验证格式
	format = strings.ToLower(format)
	validFormats := []string{"json", "csv", "markdown", "md"}
	valid := false
	for _, f := range validFormats {
		if format == f {
			valid = true
			break
		}
	}

	if !valid {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid format: "+format+". Valid formats: json, csv, markdown, md")
		return
	}

	// 先检查是否已有报告，如果没有则创建
	reports, err := h.reportService.GetReportsByRunID(ctx, uint(runID))
	if err != nil {
		logger.Errorf("Failed to get reports: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to get reports: "+err.Error())
		return
	}

	var report *models.Report
	// 查找对应格式的报告
	for _, r := range reports {
		if r.Format == format {
			report = &r
			break
		}
	}

	// 如果没有找到，创建新报告
	if report == nil {
		report, err = h.reportService.ExportReport(ctx, uint(runID), format)
		if err != nil {
			logger.Errorf("Failed to export report: %v", err)
			sendErrorResponse(w, http.StatusInternalServerError, "Failed to export report: "+err.Error())
			return
		}
	}

	// 设置响应头
	var contentType, fileExtension string
	switch format {
	case "json":
		contentType = "application/json"
		fileExtension = "json"
	case "csv":
		contentType = "text/csv"
		fileExtension = "csv"
	case "markdown", "md":
		contentType = "text/markdown"
		fileExtension = "md"
	}

	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", "attachment; filename=performance-report-"+strconv.FormatUint(uint64(report.RunID), 10)+"."+fileExtension)
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(report.Content))

	logger.Infof("Successfully downloaded report for run %d, format: %s", runID, format)
}

func (h *ReportHandler) GetReportsByRunID(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	runIDStr := vars["run_id"]
	runID, err := strconv.ParseUint(runIDStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid run ID: "+err.Error())
		return
	}

	reports, err := h.reportService.GetReportsByRunID(ctx, uint(runID))
	if err != nil {
		logger.Errorf("Failed to get reports: %v", err)
		sendErrorResponse(w, http.StatusInternalServerError, "Failed to get reports: "+err.Error())
		return
	}

	// 转换为摘要信息
	type ReportSummary struct {
		ID        uint      `json:"id"`
		RunID     uint      `json:"run_id"`
		Format    string    `json:"format"`
		CreatedAt time.Time `json:"created_at"`
	}

	summaries := make([]ReportSummary, len(reports))
	for i, report := range reports {
		summaries[i] = ReportSummary{
			ID:        report.ID,
			RunID:     report.RunID,
			Format:    report.Format,
			CreatedAt: report.CreatedAt,
		}
	}

	sendSuccessResponse(w, http.StatusOK, summaries, "")
}

func (h *ReportHandler) GetReportByID(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	vars := mux.Vars(r)
	idStr := vars["id"]
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		sendErrorResponse(w, http.StatusBadRequest, "Invalid report ID: "+err.Error())
		return
	}

	report, err := h.reportService.GetReportByID(ctx, uint(id))
	if err != nil {
		logger.Errorf("Failed to get report: %v", err)
		sendErrorResponse(w, http.StatusNotFound, "Report not found")
		return
	}

	// 返回报告内容
	sendSuccessResponse(w, http.StatusOK, map[string]interface{}{
		"id":         report.ID,
		"run_id":     report.RunID,
		"format":     report.Format,
		"content":    report.Content,
		"created_at": report.CreatedAt,
	}, "")
}
