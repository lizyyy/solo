package handler

import (
	"encoding/json"
	"lease-api/model"
	"lease-api/service"
	"net/http"
	"strings"
	"time"
)

type Handler struct {
	leaseService *service.LeaseService
	timeline     *service.TimelineService
}

func NewHandler(leaseService *service.LeaseService, timeline *service.TimelineService) *Handler {
	return &Handler{
		leaseService: leaseService,
		timeline:     timeline,
	}
}

type ErrorResponse struct {
	Error string `json:"error"`
	Code  string `json:"code"`
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, err error, code string) {
	errorMsg := ""
	if err != nil {
		errorMsg = err.Error()
	}
	respondJSON(w, status, ErrorResponse{Error: errorMsg, Code: code})
}

type CreateTaskRequest struct {
	Name         string `json:"name"`
	Payload      string `json:"payload"`
	Priority     int    `json:"priority"`
	LeaseTimeout int    `json:"lease_timeout"`
	MaxRetries   int    `json:"max_retries"`
}

func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, nil, "METHOD_NOT_ALLOWED")
		return
	}

	var req CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err, "INVALID_REQUEST")
		return
	}

	if req.Name == "" {
		req.Name = "unnamed-task"
	}
	if req.LeaseTimeout <= 0 {
		req.LeaseTimeout = 300
	}
	if req.MaxRetries <= 0 {
		req.MaxRetries = 3
	}

	task, err := h.leaseService.CreateTask(req.Name, req.Payload, req.Priority, req.LeaseTimeout, req.MaxRetries)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err, "CREATE_FAILED")
		return
	}

	respondJSON(w, http.StatusCreated, task)
}

func (h *Handler) GetTask(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, nil, "METHOD_NOT_ALLOWED")
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/tasks/")
	taskID := strings.Split(path, "/")[0]
	if taskID == "" {
		respondError(w, http.StatusBadRequest, nil, "MISSING_TASK_ID")
		return
	}

	task, err := h.leaseService.GetTask(taskID)
	if err != nil {
		respondError(w, http.StatusNotFound, err, "TASK_NOT_FOUND")
		return
	}

	respondJSON(w, http.StatusOK, task)
}

func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, nil, "METHOD_NOT_ALLOWED")
		return
	}

	statusFilter := r.URL.Query().Get("status")
	var status *model.TaskStatus
	if statusFilter != "" {
		ts := model.TaskStatus(statusFilter)
		status = &ts
	}

	tasks, err := h.leaseService.ListTasks(status)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err, "LIST_FAILED")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"tasks": tasks,
		"count": len(tasks),
	})
}

type AcquireLeaseRequest struct {
	TaskID     string `json:"task_id"`
	HolderID   string `json:"holder_id"`
	HolderName string `json:"holder_name"`
}

func (h *Handler) AcquireLease(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, nil, "METHOD_NOT_ALLOWED")
		return
	}

	var req AcquireLeaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err, "INVALID_REQUEST")
		return
	}

	if req.TaskID == "" || req.HolderID == "" {
		respondError(w, http.StatusBadRequest, nil, "MISSING_FIELDS")
		return
	}

	lease, err := h.leaseService.AcquireLease(req.TaskID, req.HolderID, req.HolderName)
	if err != nil {
		switch err {
		case service.ErrTaskNotFound:
			respondError(w, http.StatusNotFound, err, "TASK_NOT_FOUND")
		case service.ErrTaskAlreadyCompleted:
			respondError(w, http.StatusConflict, err, "TASK_COMPLETED")
		case service.ErrLeaseAlreadyHeld:
			respondError(w, http.StatusConflict, err, "LEASE_HELD")
		case service.ErrResultAlreadySubmitted:
			respondError(w, http.StatusConflict, err, "RESULT_SUBMITTED")
		default:
			respondError(w, http.StatusInternalServerError, err, "ACQUIRE_FAILED")
		}
		return
	}

	respondJSON(w, http.StatusOK, lease)
}

type RenewLeaseRequest struct {
	LeaseID  string `json:"lease_id"`
	HolderID string `json:"holder_id"`
}

func (h *Handler) RenewLease(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, nil, "METHOD_NOT_ALLOWED")
		return
	}

	var req RenewLeaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err, "INVALID_REQUEST")
		return
	}

	lease, err := h.leaseService.RenewLease(req.LeaseID, req.HolderID)
	if err != nil {
		switch err {
		case service.ErrNoActiveLease:
			respondError(w, http.StatusNotFound, err, "NO_ACTIVE_LEASE")
		case service.ErrInvalidLeaseHolder:
			respondError(w, http.StatusForbidden, err, "INVALID_HOLDER")
		case service.ErrLeaseExpired:
			respondError(w, http.StatusConflict, err, "LEASE_EXPIRED")
		default:
			respondError(w, http.StatusInternalServerError, err, "RENEW_FAILED")
		}
		return
	}

	respondJSON(w, http.StatusOK, lease)
}

type ReleaseLeaseRequest struct {
	LeaseID  string `json:"lease_id"`
	HolderID string `json:"holder_id"`
	Reason   string `json:"reason"`
}

func (h *Handler) ReleaseLease(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, nil, "METHOD_NOT_ALLOWED")
		return
	}

	var req ReleaseLeaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err, "INVALID_REQUEST")
		return
	}

	if err := h.leaseService.ReleaseLease(req.LeaseID, req.HolderID, req.Reason); err != nil {
		switch err {
		case service.ErrNoActiveLease:
			respondError(w, http.StatusNotFound, err, "NO_ACTIVE_LEASE")
		case service.ErrInvalidLeaseHolder:
			respondError(w, http.StatusForbidden, err, "INVALID_HOLDER")
		default:
			respondError(w, http.StatusInternalServerError, err, "RELEASE_FAILED")
		}
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "released"})
}

type SubmitResultRequest struct {
	TaskID       string `json:"task_id"`
	LeaseID      string `json:"lease_id"`
	HolderID     string `json:"holder_id"`
	Status       string `json:"status"`
	ResultData   string `json:"result_data"`
	ErrorMessage string `json:"error_message"`
	StartedAt    string `json:"started_at"`
}

func (h *Handler) SubmitResult(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		respondError(w, http.StatusMethodNotAllowed, nil, "METHOD_NOT_ALLOWED")
		return
	}

	var req SubmitResultRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, err, "INVALID_REQUEST")
		return
	}

	var startedAt time.Time
	if req.StartedAt != "" {
		startedAt, _ = time.Parse(time.RFC3339, req.StartedAt)
	}
	if startedAt.IsZero() {
		startedAt = time.Now().UTC().Add(-1 * time.Second)
	}

	result, err := h.leaseService.SubmitResult(req.TaskID, req.LeaseID, req.HolderID, req.Status, req.ResultData, req.ErrorMessage, startedAt)
	if err != nil {
		switch err {
		case service.ErrResultAlreadySubmitted:
			respondError(w, http.StatusConflict, err, "DUPLICATE_SUBMIT")
		case service.ErrInvalidLeaseHolder:
			respondError(w, http.StatusForbidden, err, "INVALID_HOLDER")
		case service.ErrNoActiveLease:
			respondError(w, http.StatusNotFound, err, "NO_ACTIVE_LEASE")
		default:
			respondError(w, http.StatusInternalServerError, err, "SUBMIT_FAILED")
		}
		return
	}

	respondJSON(w, http.StatusOK, result)
}

func (h *Handler) GetTaskTimeline(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, nil, "METHOD_NOT_ALLOWED")
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/timeline/")
	taskID := strings.Split(path, "/")[0]
	if taskID == "" {
		respondError(w, http.StatusBadRequest, nil, "MISSING_TASK_ID")
		return
	}

	events, err := h.timeline.GetTaskTimeline(taskID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err, "TIMELINE_FAILED")
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"task_id": taskID,
		"events":  events,
		"count":   len(events),
	})
}

func (h *Handler) ExportDiagnostics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		respondError(w, http.StatusMethodNotAllowed, nil, "METHOD_NOT_ALLOWED")
		return
	}

	report, err := h.timeline.GenerateDiagnosticsReport()
	if err != nil {
		respondError(w, http.StatusInternalServerError, err, "DIAGNOSTICS_FAILED")
		return
	}

	if r.URL.Query().Get("format") == "text" {
		w.Header().Set("Content-Type", "text/plain; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(formatTextReport(report)))
		return
	}

	respondJSON(w, http.StatusOK, report)
}

func formatTextReport(report *model.DiagnosticsReport) string {
	var sb strings.Builder
	sb.WriteString("=== BATCH TASK LEASE DIAGNOSTICS REPORT ===\n")
	sb.WriteString("Generated at: " + report.GeneratedAt.Format(time.RFC3339) + "\n\n")
	sb.WriteString("Task Summary:\n")
	sb.WriteString("  Total Tasks: " + itoa(report.TotalTasks) + "\n")
	sb.WriteString("  Pending: " + itoa(report.PendingTasks) + "\n")
	sb.WriteString("  Running: " + itoa(report.RunningTasks) + "\n")
	sb.WriteString("  Completed: " + itoa(report.CompletedTasks) + "\n")
	sb.WriteString("  Failed: " + itoa(report.FailedTasks) + "\n")
	sb.WriteString("  Active Leases: " + itoa(report.ActiveLeases) + "\n\n")
	sb.WriteString("Recent Timeline Events:\n")
	for _, e := range report.RecentEvents {
		sb.WriteString("  [" + e.CreatedAt.Format(time.RFC3339) + "] " + e.EventType + ": " + e.Message + "\n")
		if e.Details != "" {
			sb.WriteString("    Details: " + e.Details + "\n")
		}
	}
	return sb.String()
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}
