package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"time"

	"certificate-renewal-api/internal/models"
	"certificate-renewal-api/internal/service"
	"certificate-renewal-api/internal/util"
)

type Handlers struct {
	certService   *service.CertificateService
	taskService   *service.TaskService
	reportService *service.ReportService
}

func NewHandlers(certService *service.CertificateService, taskService *service.TaskService, reportService *service.ReportService) *Handlers {
	return &Handlers{
		certService:   certService,
		taskService:   taskService,
		reportService: reportService,
	}
}

func (h *Handlers) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/certificates", h.handleCertificates)
	mux.HandleFunc("/api/certificates/", h.handleCertificate)
	mux.HandleFunc("/api/tasks", h.handleTasks)
	mux.HandleFunc("/api/tasks/", h.handleTask)
	mux.HandleFunc("/api/reports", h.handleReports)
	mux.HandleFunc("/api/reports/", h.handleReport)
	mux.HandleFunc("/health", h.handleHealth)
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, code, message string, err error) {
	apiErr := models.APIError{
		Code:    code,
		Message: message,
	}
	if err != nil {
		apiErr.Details = err.Error()
	}
	writeJSON(w, status, apiErr)
}

func (h *Handlers) handleHealth(w http.ResponseWriter, r *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{
		"status": "ok",
		"time":   util.Now().Format(time.RFC3339),
	})
}

func (h *Handlers) handleCertificates(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		certs := h.certService.ListCertificates()
		writeJSON(w, http.StatusOK, certs)
		
	case http.MethodPost:
		var req struct {
			CommonName string            `json:"common_name"`
			SANs       []string          `json:"sans"`
			ValidDays  int               `json:"valid_days"`
			AutoRenew  bool              `json:"auto_renew"`
			Tags       map[string]string `json:"tags"`
		}
		
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid request body", err)
			return
		}
		
		if req.CommonName == "" {
			writeError(w, http.StatusBadRequest, "MISSING_FIELD", "common_name is required", nil)
			return
		}
		
		if req.ValidDays <= 0 {
			req.ValidDays = 365
		}
		
		now := util.Now()
		validTo := now.Add(time.Duration(req.ValidDays) * 24 * time.Hour)
		
		cert, err := h.certService.CreateCertificate(req.CommonName, req.SANs, now, validTo, req.AutoRenew, req.Tags)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "CREATE_FAILED", "failed to create certificate", err)
			return
		}
		
		writeJSON(w, http.StatusCreated, cert)
		
	default:
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", fmt.Sprintf("method %s not allowed", r.Method), nil)
	}
}

func (h *Handlers) handleCertificate(w http.ResponseWriter, r *http.Request) {
	id := strings.TrimPrefix(r.URL.Path, "/api/certificates/")
	
	switch r.Method {
	case http.MethodGet:
		cert, err := h.certService.GetCertificate(id)
		if err != nil {
			if err == models.ErrCertificateNotFound {
				writeError(w, http.StatusNotFound, "NOT_FOUND", "certificate not found", err)
			} else {
				writeError(w, http.StatusInternalServerError, "GET_FAILED", "failed to get certificate", err)
			}
			return
		}
		writeJSON(w, http.StatusOK, cert)
		
	default:
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", fmt.Sprintf("method %s not allowed", r.Method), nil)
	}
}

func (h *Handlers) handleTasks(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		tasks := h.taskService.ListTasks()
		writeJSON(w, http.StatusOK, tasks)
		
	case http.MethodPost:
		var req struct {
			CertificateID string                     `json:"certificate_id"`
			Targets       []models.DeploymentTarget `json:"targets"`
		}
		
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid request body", err)
			return
		}
		
		if req.CertificateID == "" {
			writeError(w, http.StatusBadRequest, "MISSING_FIELD", "certificate_id is required", nil)
			return
		}
		
		if len(req.Targets) == 0 {
			writeError(w, http.StatusBadRequest, "MISSING_FIELD", "at least one target is required", nil)
			return
		}
		
		cert, err := h.certService.GetCertificate(req.CertificateID)
		if err != nil {
			if err == models.ErrCertificateNotFound {
				writeError(w, http.StatusNotFound, "NOT_FOUND", "certificate not found", err)
			} else {
				writeError(w, http.StatusInternalServerError, "GET_FAILED", "failed to get certificate", err)
			}
			return
		}
		
		task, err := h.taskService.CreateTask(cert, req.Targets)
		if err != nil {
			if strings.Contains(err.Error(), "conflict") {
				writeError(w, http.StatusConflict, "TASK_CONFLICT", err.Error(), err)
			} else {
				writeError(w, http.StatusInternalServerError, "CREATE_FAILED", "failed to create task", err)
			}
			return
		}
		
		go h.taskService.ProcessTask(task.ID)
		
		writeJSON(w, http.StatusCreated, task)
		
	default:
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", fmt.Sprintf("method %s not allowed", r.Method), nil)
	}
}

func (h *Handlers) handleTask(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/tasks/")
	parts := strings.Split(path, "/")
	
	if len(parts) == 0 {
		writeError(w, http.StatusBadRequest, "INVALID_PATH", "invalid task path", nil)
		return
	}
	
	taskID := parts[0]
	
	if len(parts) == 2 {
		action := parts[1]
		switch r.Method {
		case http.MethodPost:
			switch action {
			case "retry":
				if err := h.taskService.RetryTask(taskID); err != nil {
					writeError(w, http.StatusBadRequest, "RETRY_FAILED", err.Error(), err)
					return
				}
				task, _ := h.taskService.GetTask(taskID)
				writeJSON(w, http.StatusOK, task)
				return
				
			case "cancel":
				if err := h.taskService.CancelTask(taskID); err != nil {
					writeError(w, http.StatusBadRequest, "CANCEL_FAILED", err.Error(), err)
					return
				}
				task, _ := h.taskService.GetTask(taskID)
				writeJSON(w, http.StatusOK, task)
				return
				
			case "resolve-conflict":
				var req struct {
					ConflictID string `json:"conflict_id"`
					Resolution string `json:"resolution"`
				}
				if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
					writeError(w, http.StatusBadRequest, "INVALID_REQUEST", "invalid request body", err)
					return
				}
				if err := h.taskService.ResolveConflict(taskID, req.ConflictID, req.Resolution); err != nil {
					writeError(w, http.StatusBadRequest, "RESOLVE_FAILED", err.Error(), err)
					return
				}
				task, _ := h.taskService.GetTask(taskID)
				writeJSON(w, http.StatusOK, task)
				return
			}
		}
	}
	
	switch r.Method {
	case http.MethodGet:
		task, err := h.taskService.GetTask(taskID)
		if err != nil {
			if err == models.ErrTaskNotFound {
				writeError(w, http.StatusNotFound, "NOT_FOUND", "task not found", err)
			} else {
				writeError(w, http.StatusInternalServerError, "GET_FAILED", "failed to get task", err)
			}
			return
		}
		writeJSON(w, http.StatusOK, task)
		
	default:
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", fmt.Sprintf("method %s not allowed", r.Method), nil)
	}
}

func (h *Handlers) handleReports(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		reports := h.reportService.ListReports()
		writeJSON(w, http.StatusOK, reports)
		
	case http.MethodPost:
		report, err := h.reportService.GenerateExpiryReport()
		if err != nil {
			writeError(w, http.StatusInternalServerError, "GENERATE_FAILED", "failed to generate report", err)
			return
		}
		writeJSON(w, http.StatusCreated, report)
		
	default:
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", fmt.Sprintf("method %s not allowed", r.Method), nil)
	}
}

func (h *Handlers) handleReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED", fmt.Sprintf("method %s not allowed", r.Method), nil)
		return
	}
	
	id := strings.TrimPrefix(r.URL.Path, "/api/reports/")
	report, err := h.reportService.GetReport(id)
	if err != nil {
		writeError(w, http.StatusNotFound, "NOT_FOUND", "report not found", err)
		return
	}
	writeJSON(w, http.StatusOK, report)
}
