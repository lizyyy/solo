package handler

import (
	"encoding/json"
	"longpoll-session-api/internal/errors"
	"longpoll-session-api/internal/service"
	"net/http"
)

type Handler struct {
	service *service.Service
}

func NewHandler(s *service.Service) *Handler {
	return &Handler{service: s}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	mux := http.NewServeMux()

	mux.HandleFunc("/api/sessions", h.handleSessions)
	mux.HandleFunc("/api/sessions/", h.handleSession)
	mux.HandleFunc("/api/sessions/reconnect", h.handleReconnect)
	mux.HandleFunc("/api/messages", h.handleMessages)
	mux.HandleFunc("/api/messages/poll", h.handlePoll)
	mux.HandleFunc("/api/messages/ack", h.handleAck)
	mux.HandleFunc("/api/export", h.handleExport)

	mux.ServeHTTP(w, r)
}

func (h *Handler) handleSessions(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.createSession(w, r)
	case http.MethodGet:
		h.querySessions(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleSession(w http.ResponseWriter, r *http.Request) {
	sessionID := r.URL.Path[len("/api/sessions/"):]
	if sessionID == "" {
		http.Error(w, "session ID is required", http.StatusBadRequest)
		return
	}

	switch r.Method {
	case http.MethodGet:
		h.getSession(w, r, sessionID)
	case http.MethodPut:
		h.advanceSession(w, r, sessionID)
	case http.MethodDelete:
		h.revokeSession(w, r, sessionID)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) handleMessages(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodPost:
		h.pushMessage(w, r)
	case http.MethodGet:
		h.queryMessages(w, r)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) jsonResponse(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func (h *Handler) errorResponse(w http.ResponseWriter, err error) {
	var e *errors.Error
	if errors.As(err, &e) {
		h.jsonResponse(w, e.Status, map[string]interface{}{
			"error": e,
		})
		return
	}
	h.jsonResponse(w, http.StatusInternalServerError, map[string]interface{}{
		"error": map[string]interface{}{
			"code":    "INTERNAL_ERROR",
			"message": err.Error(),
			"status":  500,
		},
	})
}
