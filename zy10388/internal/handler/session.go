package handler

import (
	"encoding/json"
	"longpoll-session-api/internal/model"
	"net/http"
)

func (h *Handler) createSession(w http.ResponseWriter, r *http.Request) {
	var req model.CreateSessionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.ClientID == "" {
		http.Error(w, "client_id is required", http.StatusBadRequest)
		return
	}

	resp, err := h.service.Session.CreateSession(&req)
	if err != nil {
		h.errorResponse(w, err)
		return
	}

	h.jsonResponse(w, http.StatusCreated, resp)
}

func (h *Handler) getSession(w http.ResponseWriter, r *http.Request, sessionID string) {
	session, err := h.service.Session.GetSession(sessionID)
	if err != nil {
		h.errorResponse(w, err)
		return
	}
	h.jsonResponse(w, http.StatusOK, session)
}

func (h *Handler) querySessions(w http.ResponseWriter, r *http.Request) {
	var req model.SessionQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req = model.SessionQueryRequest{}
	}

	resp, err := h.service.Session.QuerySessions(&req)
	if err != nil {
		h.errorResponse(w, err)
		return
	}
	h.jsonResponse(w, http.StatusOK, resp)
}

func (h *Handler) advanceSession(w http.ResponseWriter, r *http.Request, sessionID string) {
	var req model.AdvanceRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	req.SessionID = sessionID

	resp, err := h.service.Session.AdvanceSession(&req)
	if err != nil {
		h.errorResponse(w, err)
		return
	}
	h.jsonResponse(w, http.StatusOK, resp)
}

func (h *Handler) revokeSession(w http.ResponseWriter, r *http.Request, sessionID string) {
	req := &model.RevokeSessionRequest{
		SessionID: sessionID,
		Reason:    r.URL.Query().Get("reason"),
	}

	resp, err := h.service.Session.RevokeSession(req)
	if err != nil {
		h.errorResponse(w, err)
		return
	}
	h.jsonResponse(w, http.StatusOK, resp)
}

func (h *Handler) handleReconnect(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req model.ReconnectRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" || req.ClientID == "" {
		http.Error(w, "session_id and client_id are required", http.StatusBadRequest)
		return
	}

	session, err := h.service.Session.ReconnectSession(req.SessionID, req.ClientID)
	if err != nil {
		h.errorResponse(w, err)
		return
	}

	h.jsonResponse(w, http.StatusOK, &model.ReconnectResponse{
		Session: session,
		Success: true,
	})
}
