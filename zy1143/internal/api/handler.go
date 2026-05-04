package api

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"localmq/internal/models"
	"localmq/internal/service"
)

type Handler struct {
	svc *service.MessageService
}

func NewHandler(svc *service.MessageService) *Handler {
	return &Handler{svc: svc}
}

func jsonError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": message})
}

func jsonSuccess(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(data)
}

func (h *Handler) CreateQueue(w http.ResponseWriter, r *http.Request) {
	var req models.CreateQueueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	q, err := h.svc.CreateQueue(&req)
	if err != nil {
		if strings.Contains(err.Error(), "already exists") {
			jsonError(w, http.StatusConflict, err.Error())
			return
		}
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, q)
}

func (h *Handler) GetQueue(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		queues, err := h.svc.ListQueues()
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		jsonSuccess(w, queues)
		return
	}

	q, err := h.svc.GetQueue(name)
	if err != nil {
		jsonError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if q == nil {
		jsonError(w, http.StatusNotFound, "queue not found")
		return
	}
	jsonSuccess(w, q)
}

func (h *Handler) Enqueue(w http.ResponseWriter, r *http.Request) {
	var req models.EnqueueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	msg, err := h.svc.Enqueue(&req)
	if err != nil {
		if strings.Contains(err.Error(), "idempotency key already exists") {
			jsonError(w, http.StatusConflict, err.Error())
			return
		}
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, map[string]interface{}{
		"message_id": msg.ID,
		"status":     msg.Status,
		"created_at": msg.CreatedAt,
	})
}

func (h *Handler) Reserve(w http.ResponseWriter, r *http.Request) {
	var req models.ReserveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	msgs, err := h.svc.Reserve(&req)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, msgs)
}

func (h *Handler) Ack(w http.ResponseWriter, r *http.Request) {
	var req models.AckRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.svc.Ack(&req); err != nil {
		if strings.Contains(err.Error(), "not found") {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		if strings.Contains(err.Error(), "not reserved") {
			jsonError(w, http.StatusConflict, err.Error())
			return
		}
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, map[string]string{"status": "acked"})
}

func (h *Handler) Nack(w http.ResponseWriter, r *http.Request) {
	var req models.NackRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.svc.Nack(&req); err != nil {
		if strings.Contains(err.Error(), "not found") {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		if strings.Contains(err.Error(), "not reserved") {
			jsonError(w, http.StatusConflict, err.Error())
			return
		}
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, map[string]string{"status": "nacked"})
}

func (h *Handler) ExtendLease(w http.ResponseWriter, r *http.Request) {
	var req models.ExtendLeaseRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	if err := h.svc.ExtendLease(&req); err != nil {
		if strings.Contains(err.Error(), "not found") {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		if strings.Contains(err.Error(), "not reserved") {
			jsonError(w, http.StatusConflict, err.Error())
			return
		}
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, map[string]string{"status": "extended"})
}

func (h *Handler) Stats(w http.ResponseWriter, r *http.Request) {
	queueName := r.URL.Query().Get("queue")
	if queueName == "" {
		jsonError(w, http.StatusBadRequest, "queue parameter required")
		return
	}

	stats, err := h.svc.GetStats(queueName)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, stats)
}

func (h *Handler) Peek(w http.ResponseWriter, r *http.Request) {
	queueName := r.URL.Query().Get("queue")
	if queueName == "" {
		jsonError(w, http.StatusBadRequest, "queue parameter required")
		return
	}

	status := r.URL.Query().Get("status")
	limitStr := r.URL.Query().Get("limit")
	limit := 0
	if limitStr != "" {
		limit, _ = strconv.Atoi(limitStr)
	}

	msgs, err := h.svc.Peek(queueName, status, limit)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, msgs)
}

func (h *Handler) GetMessage(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		jsonError(w, http.StatusBadRequest, "id parameter required")
		return
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "invalid id")
		return
	}

	msg, err := h.svc.GetMessage(id)
	if err != nil {
		if strings.Contains(err.Error(), "not found") {
			jsonError(w, http.StatusNotFound, err.Error())
			return
		}
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, msg)
}

func (h *Handler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("message_id")
	if idStr == "" {
		jsonError(w, http.StatusBadRequest, "message_id parameter required")
		return
	}

	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		jsonError(w, http.StatusBadRequest, "invalid message_id")
		return
	}

	logs, err := h.svc.GetAuditLogs(id)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, logs)
}

func (h *Handler) ReplayDeadLetter(w http.ResponseWriter, r *http.Request) {
	var req models.ReplayDeadLetterRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	count, err := h.svc.ReplayDeadLetter(&req)
	if err != nil {
		jsonError(w, http.StatusBadRequest, err.Error())
		return
	}

	jsonSuccess(w, map[string]interface{}{
		"replayed": count,
		"status":   "ok",
	})
}

func (h *Handler) Export(w http.ResponseWriter, r *http.Request) {
	queueName := r.URL.Query().Get("queue")
	if queueName == "" {
		jsonError(w, http.StatusBadRequest, "queue parameter required")
		return
	}

	format := r.URL.Query().Get("format")
	if format == "" {
		format = "json"
	}

	switch format {
	case "json":
		data, err := h.svc.ExportJSON(queueName)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.json", queueName))
		w.Write(data)

	case "csv":
		data, err := h.svc.ExportCSV(queueName)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "text/csv")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.csv", queueName))
		w.Write(data)

	case "markdown", "md":
		data, err := h.svc.ExportMarkdown(queueName)
		if err != nil {
			jsonError(w, http.StatusInternalServerError, err.Error())
			return
		}
		w.Header().Set("Content-Type", "text/markdown")
		w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=%s.md", queueName))
		w.Write([]byte(data))

	default:
		jsonError(w, http.StatusBadRequest, "unsupported format: "+format)
	}
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	jsonSuccess(w, map[string]string{"status": "ok"})
}
