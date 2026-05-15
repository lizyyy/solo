package handler

import (
	"encoding/json"
	"longpoll-session-api/internal/model"
	"net/http"
)

func (h *Handler) handleExport(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req model.ExportRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	resp, err := h.service.Export.Export(&req)
	if err != nil {
		h.errorResponse(w, err)
		return
	}

	h.jsonResponse(w, http.StatusOK, resp)
}
