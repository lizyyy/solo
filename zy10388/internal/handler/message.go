package handler

import (
	"encoding/json"
	"longpoll-session-api/internal/model"
	"net/http"
)

func (h *Handler) pushMessage(w http.ResponseWriter, r *http.Request) {
	var req model.PushMessageRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" {
		http.Error(w, "session_id is required", http.StatusBadRequest)
		return
	}
	if req.Payload == nil {
		http.Error(w, "payload is required", http.StatusBadRequest)
		return
	}

	resp, err := h.service.Message.PushMessage(&req)
	if err != nil {
		h.errorResponse(w, err)
		return
	}

	h.jsonResponse(w, http.StatusCreated, resp)
}

func (h *Handler) pollMessages(w http.ResponseWriter, r *http.Request) {
	var req model.PollRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" {
		http.Error(w, "session_id is required", http.StatusBadRequest)
		return
	}

	resp, err := h.service.Message.PollMessages(&req)
	if err != nil {
		h.errorResponse(w, err)
		return
	}

	h.jsonResponse(w, http.StatusOK, resp)
}

func (h *Handler) ackMessages(w http.ResponseWriter, r *http.Request) {
	var req model.AckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.SessionID == "" {
		http.Error(w, "session_id is required", http.StatusBadRequest)
		return
	}
	if len(req.Cursors) == 0 {
		http.Error(w, "cursors is required", http.StatusBadRequest)
		return
	}

	resp, err := h.service.Message.AckMessages(&req)
	if err != nil {
		h.errorResponse(w, err)
		return
	}

	h.jsonResponse(w, http.StatusOK, resp)
}

func (h *Handler) queryMessages(w http.ResponseWriter, r *http.Request) {
	var req model.MessageQueryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req = model.MessageQueryRequest{}
	}

	resp, err := h.service.Message.QueryMessages(&req)
	if err != nil {
		h.errorResponse(w, err)
		return
	}
	h.jsonResponse(w, http.StatusOK, resp)
}

func (h *Handler) handlePoll(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	h.pollMessages(w, r)
}

func (h *Handler) handleAck(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	h.ackMessages(w, r)
}
