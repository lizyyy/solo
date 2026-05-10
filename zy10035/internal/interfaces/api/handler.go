package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"mq-deadletter-review/internal/domain/model"
	"mq-deadletter-review/internal/domain/service"
	"mq-deadletter-review/internal/interfaces/reporter"
	"mq-deadletter-review/pkg/logger"
)

type APIHandler struct {
	trackingSvc *service.TrackingService
	replaySvc   *service.ReplayService
	reporter    *reporter.MarkdownReporter
}

func NewAPIHandler(
	trackingSvc *service.TrackingService,
	replaySvc *service.ReplayService,
	reporter *reporter.MarkdownReporter,
) *APIHandler {
	return &APIHandler{
		trackingSvc: trackingSvc,
		replaySvc:   replaySvc,
		reporter:    reporter,
	}
}

func (h *APIHandler) RegisterRoutes(mux *http.ServeMux) {
	mux.HandleFunc("/api/health", h.HealthCheck)

	mux.HandleFunc("/api/trackings", h.handleTrackings)
	mux.HandleFunc("/api/trackings/", h.handleTrackingsByID)

	mux.HandleFunc("/api/dead-letters", h.ListDeadLetters)
	mux.HandleFunc("/api/dead-letters/", h.GetDeadLetter)

	mux.HandleFunc("/api/replays", h.handleReplays)
	mux.HandleFunc("/api/replays/", h.handleReplaysByID)

	mux.HandleFunc("/api/reports/tracking/", h.GenerateTrackingReport)
	mux.HandleFunc("/api/reports/replay/", h.GenerateReplayReport)
	mux.HandleFunc("/api/reports/statistics", h.GenerateStatisticsReport)

	mux.HandleFunc("/api/statistics", h.GetStatistics)

	logger.Info("API routes registered")
}

func (h *APIHandler) handleTrackings(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.CreateTracking(w, r)
	case http.MethodGet:
		h.ListTrackings(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (h *APIHandler) handleTrackingsByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/trackings/")

	if strings.HasPrefix(path, "message/") {
		h.GetTrackingByMessageID(w, r)
		return
	}

	parts := strings.Split(path, "/")
	if len(parts) >= 2 && parts[1] == "status" {
		h.UpdateTrackingStatus(w, r)
		return
	}

	if r.Method == http.MethodGet {
		h.GetTracking(w, r)
		return
	}

	writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
}

func (h *APIHandler) handleReplays(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.CreateReplay(w, r)
	case http.MethodGet:
		h.ListReplays(w, r)
	default:
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}

func (h *APIHandler) handleReplaysByID(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/replays/")

	if strings.HasPrefix(path, "cancel/") {
		h.CancelReplay(w, r)
		return
	}

	if r.Method == http.MethodGet {
		h.GetReplay(w, r)
		return
	}

	writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, Response{
		Code:    status,
		Message: message,
	})
}

func (h *APIHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "ok",
		Data: map[string]interface{}{
			"timestamp": time.Now().Unix(),
			"status":    "healthy",
		},
	})
}

type CreateTrackingAPIRequest struct {
	MessageID     string            `json:"message_id"`
	Topic         string            `json:"topic"`
	Tag           string            `json:"tag"`
	Keys          string            `json:"keys"`
	ProducerGroup string            `json:"producer_group"`
	ConsumerGroup string            `json:"consumer_group"`
	Body          string            `json:"body"`
	Properties    map[string]string `json:"properties,omitempty"`
}

func (h *APIHandler) CreateTracking(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req CreateTrackingAPIRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	if req.MessageID == "" {
		writeError(w, http.StatusBadRequest, "message_id is required")
		return
	}
	if req.Topic == "" {
		writeError(w, http.StatusBadRequest, "topic is required")
		return
	}

	tracking, err := h.trackingSvc.CreateTracking(r.Context(), &service.CreateTrackingRequest{
		MessageID:     req.MessageID,
		Topic:         req.Topic,
		Tag:           req.Tag,
		Keys:          req.Keys,
		ProducerGroup: req.ProducerGroup,
		ConsumerGroup: req.ConsumerGroup,
		Body:          req.Body,
		Properties:    req.Properties,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusCreated, Response{
		Code:    http.StatusCreated,
		Message: "success",
		Data:    tracking,
	})
}

func (h *APIHandler) ListTrackings(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	status := model.MessageStatus(r.URL.Query().Get("status"))
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	trackings, total, err := h.trackingSvc.ListByStatus(r.Context(), status, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data: map[string]interface{}{
			"items": trackings,
			"total": total,
			"page":  page,
			"size":  pageSize,
		},
	})
}

func (h *APIHandler) GetTracking(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	trackingID := strings.TrimPrefix(r.URL.Path, "/api/trackings/")
	if trackingID == "" || strings.Contains(trackingID, "/") {
		return
	}

	tracking, err := h.trackingSvc.GetByTrackingID(r.Context(), trackingID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	logs, _ := h.trackingSvc.GetEventLogs(r.Context(), trackingID, 50)

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data: map[string]interface{}{
			"tracking": tracking,
			"logs":     logs,
		},
	})
}

func (h *APIHandler) GetTrackingByMessageID(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	messageID := strings.TrimPrefix(r.URL.Path, "/api/trackings/message/")
	if messageID == "" || strings.Contains(messageID, "/") {
		writeError(w, http.StatusBadRequest, "Invalid message ID")
		return
	}

	tracking, err := h.trackingSvc.GetByMessageID(r.Context(), messageID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data:    tracking,
	})
}

func (h *APIHandler) UpdateTrackingStatus(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/api/trackings/")
	parts := strings.Split(path, "/")
	if len(parts) < 2 || parts[1] != "status" {
		return
	}

	trackingID := parts[0]
	if trackingID == "" {
		writeError(w, http.StatusBadRequest, "Invalid tracking ID")
		return
	}

	var req struct {
		Status string `json:"status"`
		Error  string `json:"error,omitempty"`
		Stack  string `json:"stack,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	tracking, err := h.trackingSvc.UpdateStatus(r.Context(), trackingID, model.MessageStatus(req.Status), req.Error, req.Stack)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data:    tracking,
	})
}

func (h *APIHandler) ListDeadLetters(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	consumerGroup := r.URL.Query().Get("consumer_group")
	topic := r.URL.Query().Get("topic")
	tag := r.URL.Query().Get("tag")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	deadLetters, total, err := h.trackingSvc.ListDeadLetters(r.Context(), consumerGroup, topic, tag, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data: map[string]interface{}{
			"items": deadLetters,
			"total": total,
			"page":  page,
			"size":  pageSize,
		},
	})
}

func (h *APIHandler) GetDeadLetter(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	idStr := strings.TrimPrefix(r.URL.Path, "/api/dead-letters/")
	if idStr == "" || strings.Contains(idStr, "/") {
		writeError(w, http.StatusBadRequest, "Invalid ID")
		return
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid ID format")
		return
	}

	deadLetter, err := h.trackingSvc.GetDeadLetter(r.Context(), id)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data:    deadLetter,
	})
}

type CreateReplayRequest struct {
	DeadLetterIDs []int64  `json:"dead_letter_ids"`
	TrackingIDs   []string `json:"tracking_ids"`
	ConsumerGroup string   `json:"consumer_group"`
	Topic         string   `json:"topic"`
	Tag           string   `json:"tag"`
	DryRun        bool     `json:"dry_run"`
	MaxBatchSize  int      `json:"max_batch_size"`
	Concurrency   int      `json:"concurrency"`
	Timeout       int      `json:"timeout"`
	Reason        string   `json:"reason"`
	OperatorID    string   `json:"operator_id"`
}

func (h *APIHandler) CreateReplay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	var req CreateReplayRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body")
		return
	}

	result, err := h.replaySvc.ReplayMessages(r.Context(), &service.ReplayMessagesRequest{
		DeadLetterIDs: req.DeadLetterIDs,
		TrackingIDs:   req.TrackingIDs,
		ConsumerGroup: req.ConsumerGroup,
		Topic:         req.Topic,
		Tag:           req.Tag,
		DryRun:        req.DryRun,
		MaxBatchSize:  req.MaxBatchSize,
		Concurrency:   req.Concurrency,
		Timeout:       req.Timeout,
		Reason:        req.Reason,
		OperatorID:    req.OperatorID,
	})
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data:    result,
	})
}

func (h *APIHandler) GetReplay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	requestID := strings.TrimPrefix(r.URL.Path, "/api/replays/")
	if requestID == "" || strings.Contains(requestID, "/") {
		writeError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	request, err := h.replaySvc.GetReplayRequest(r.Context(), requestID)
	if err != nil {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}

	tasks, _ := h.replaySvc.GetReplayTasks(r.Context(), requestID)

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data: map[string]interface{}{
			"request": request,
			"tasks":   tasks,
			"active":  h.replaySvc.IsReplayActive(requestID),
		},
	})
}

func (h *APIHandler) CancelReplay(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	requestID := strings.TrimPrefix(r.URL.Path, "/api/replays/cancel/")
	if requestID == "" || strings.Contains(requestID, "/") {
		writeError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	if err := h.replaySvc.CancelReplay(r.Context(), requestID); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
	})
}

func (h *APIHandler) ListReplays(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	status := r.URL.Query().Get("status")
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("page_size"))

	if page <= 0 {
		page = 1
	}
	if pageSize <= 0 {
		pageSize = 20
	}

	requests, total, err := h.replaySvc.ListReplayRequests(r.Context(), status, page, pageSize)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data: map[string]interface{}{
			"items": requests,
			"total": total,
			"page":  page,
			"size":  pageSize,
		},
	})
}

func (h *APIHandler) GenerateTrackingReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	trackingID := strings.TrimPrefix(r.URL.Path, "/api/reports/tracking/")
	if trackingID == "" || strings.Contains(trackingID, "/") {
		writeError(w, http.StatusBadRequest, "Invalid tracking ID")
		return
	}

	format := r.URL.Query().Get("format")

	report, err := h.reporter.GenerateTrackingReport(r.Context(), trackingID, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if format == "download" {
		w.Header().Set("Content-Type", "text/markdown")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=tracking-%s.md", trackingID))
	} else {
		w.Header().Set("Content-Type", "text/markdown")
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(report))
}

func (h *APIHandler) GenerateReplayReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	requestID := strings.TrimPrefix(r.URL.Path, "/api/reports/replay/")
	if requestID == "" || strings.Contains(requestID, "/") {
		writeError(w, http.StatusBadRequest, "Invalid request ID")
		return
	}

	format := r.URL.Query().Get("format")

	report, err := h.reporter.GenerateReplayReport(r.Context(), requestID, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if format == "download" {
		w.Header().Set("Content-Type", "text/markdown")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=replay-%s.md", requestID))
	} else {
		w.Header().Set("Content-Type", "text/markdown")
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(report))
}

func (h *APIHandler) GenerateStatisticsReport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	format := r.URL.Query().Get("format")

	report, err := h.reporter.GenerateStatisticsReport(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	if format == "download" {
		w.Header().Set("Content-Type", "text/markdown")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=statistics-%s.md", time.Now().Format("20060102")))
	} else {
		w.Header().Set("Content-Type", "text/markdown")
	}

	w.WriteHeader(http.StatusOK)
	w.Write([]byte(report))
}

func (h *APIHandler) GetStatistics(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		writeError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	stats, err := h.trackingSvc.GetStatistics(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, Response{
		Code:    http.StatusOK,
		Message: "success",
		Data:    stats,
	})
}

func (h *APIHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	start := time.Now()
	logger.Info("[API] %s %s", r.Method, r.URL.Path)
	defer func() {
		logger.Info("[API] %s %s - %v", r.Method, r.URL.Path, time.Since(start))
	}()
}

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
