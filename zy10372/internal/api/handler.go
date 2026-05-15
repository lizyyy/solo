package api

import (
	"encoding/json"
	"net/http"
	"time"

	"queue-backoff-api/internal/model"
	"queue-backoff-api/internal/service"
	"queue-backoff-api/pkg/utils"
)

type Handler struct {
	throttleSvc *service.ThrottleService
	reportSvc   *service.ReportService
}

func NewHandler(throttleSvc *service.ThrottleService, reportSvc *service.ReportService) *Handler {
	return &Handler{
		throttleSvc: throttleSvc,
		reportSvc:   reportSvc,
	}
}

func (h *Handler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func (h *Handler) respondError(w http.ResponseWriter, err error, requestID string) {
	var code string
	var status int

	switch err {
	case model.ErrTopicNotFound:
		code = "TOPIC_NOT_FOUND"
		status = http.StatusNotFound
	case model.ErrRuleNotFound:
		code = "RULE_NOT_FOUND"
		status = http.StatusNotFound
	case model.ErrDuplicateRequest:
		code = "DUPLICATE_REQUEST"
		status = http.StatusConflict
	case model.ErrInvalidThreshold:
		code = "INVALID_THRESHOLD"
		status = http.StatusBadRequest
	case model.ErrTopicAlreadyExists:
		code = "TOPIC_ALREADY_EXISTS"
		status = http.StatusConflict
	case model.ErrRuleAlreadyExists:
		code = "RULE_ALREADY_EXISTS"
		status = http.StatusConflict
	case model.ErrInvalidPriority:
		code = "INVALID_PRIORITY"
		status = http.StatusBadRequest
	case model.ErrTopicNotThrottled:
		code = "TOPIC_NOT_THROTTLED"
		status = http.StatusBadRequest
	case model.ErrInvalidRequest:
		code = "INVALID_REQUEST"
		status = http.StatusBadRequest
	default:
		code = "BAD_REQUEST"
		status = http.StatusBadRequest
	}

	h.respondJSON(w, status, model.ErrorResponse{
		Code:      code,
		Message:   err.Error(),
		RequestID: requestID,
		Timestamp: utils.GetCurrentTime().Format(time.RFC3339),
	})
}

func (h *Handler) CreateTopic(w http.ResponseWriter, r *http.Request) {
	var req model.CreateTopicRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, err, "")
		return
	}

	resp, err := h.throttleSvc.CreateTopic(&req)
	if err != nil {
		h.respondError(w, err, req.RequestID)
		return
	}

	h.respondJSON(w, http.StatusCreated, resp)
}

func (h *Handler) CreateRule(w http.ResponseWriter, r *http.Request) {
	var req model.CreateRuleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, err, "")
		return
	}

	resp, err := h.throttleSvc.CreateRule(&req)
	if err != nil {
		h.respondError(w, err, req.RequestID)
		return
	}

	h.respondJSON(w, http.StatusCreated, resp)
}

func (h *Handler) CheckBacklog(w http.ResponseWriter, r *http.Request) {
	var req model.CheckBacklogRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, err, "")
		return
	}

	resp, err := h.throttleSvc.CheckBacklog(&req)
	if err != nil {
		h.respondError(w, err, req.RequestID)
		return
	}

	h.respondJSON(w, http.StatusOK, resp)
}

func (h *Handler) SubmitMessage(w http.ResponseWriter, r *http.Request) {
	var req model.SubmitMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, err, "")
		return
	}

	resp, err := h.throttleSvc.SubmitMessage(&req)
	if err != nil {
		h.respondError(w, err, req.RequestID)
		return
	}

	h.respondJSON(w, http.StatusOK, resp)
}

func (h *Handler) GetTopicStatus(w http.ResponseWriter, r *http.Request) {
	topicID := r.URL.Query().Get("topic_id")
	if topicID == "" {
		h.respondError(w, model.ErrTopicNotFound, "")
		return
	}

	resp, err := h.throttleSvc.GetTopicStatus(topicID)
	if err != nil {
		h.respondError(w, err, "")
		return
	}

	h.respondJSON(w, http.StatusOK, resp)
}

func (h *Handler) ListTopics(w http.ResponseWriter, r *http.Request) {
	resp, err := h.throttleSvc.ListTopics()
	if err != nil {
		h.respondError(w, err, "")
		return
	}

	h.respondJSON(w, http.StatusOK, resp)
}

func (h *Handler) AdvanceStatus(w http.ResponseWriter, r *http.Request) {
	var req model.AdvanceStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, err, "")
		return
	}

	resp, err := h.throttleSvc.AdvanceStatus(&req)
	if err != nil {
		h.respondError(w, err, req.RequestID)
		return
	}

	h.respondJSON(w, http.StatusOK, resp)
}

func (h *Handler) CheckRecovery(w http.ResponseWriter, r *http.Request) {
	topicID := r.URL.Query().Get("topic_id")
	if topicID == "" {
		h.respondError(w, model.ErrTopicNotFound, "")
		return
	}

	recovered, err := h.throttleSvc.CheckRecovery(topicID)
	if err != nil {
		h.respondError(w, err, "")
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"topic_id":  topicID,
		"recovered": recovered,
	})
}

func (h *Handler) QueryHistory(w http.ResponseWriter, r *http.Request) {
	var req model.QueryHistoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.TopicID = r.URL.Query().Get("topic_id")
		req.EventType = r.URL.Query().Get("event_type")
	}

	resp, err := h.reportSvc.QueryHistory(&req)
	if err != nil {
		h.respondError(w, err, "")
		return
	}

	h.respondJSON(w, http.StatusOK, resp)
}

func (h *Handler) ExportReport(w http.ResponseWriter, r *http.Request) {
	var req model.ExportReportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.TopicID = r.URL.Query().Get("topic_id")
	}

	resp, err := h.reportSvc.ExportReport(&req)
	if err != nil {
		h.respondError(w, err, "")
		return
	}

	h.respondJSON(w, http.StatusOK, resp)
}

func (h *Handler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"status":    "healthy",
		"service":   "queue-backoff-api",
		"timestamp": utils.GetCurrentTime().Format(time.RFC3339),
	})
}
