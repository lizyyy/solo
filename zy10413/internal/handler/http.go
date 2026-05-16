package handler

import (
	"encoding/json"
	"fmt"
	"net/http"
	"push-token-lifecycle/internal/model"
	"push-token-lifecycle/internal/service"
	"strings"
	"time"
)

type HTTPHandler struct {
	service *service.LifecycleService
}

func NewHTTPHandler(s *service.LifecycleService) *HTTPHandler {
	return &HTTPHandler{service: s}
}

func (h *HTTPHandler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func (h *HTTPHandler) respondError(w http.ResponseWriter, status int, message string) {
	h.respondJSON(w, status, map[string]string{"error": message})
}

func (h *HTTPHandler) BindToken(w http.ResponseWriter, r *http.Request) {
	var req model.TokenLifecycleRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	token, err := h.service.BindToken(&req)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusCreated, token)
}

func (h *HTTPHandler) GetToken(w http.ResponseWriter, r *http.Request) {
	tokenID := strings.TrimPrefix(r.URL.Path, "/api/v1/tokens/")
	if tokenID == "" {
		h.respondError(w, http.StatusBadRequest, "token_id is required")
		return
	}

	token, err := h.service.GetToken(tokenID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if token == nil {
		h.respondError(w, http.StatusNotFound, "token not found")
		return
	}

	h.respondJSON(w, http.StatusOK, token)
}

func (h *HTTPHandler) GetTokenByToken(w http.ResponseWriter, r *http.Request) {
	token := r.URL.Query().Get("token")
	if token == "" {
		h.respondError(w, http.StatusBadRequest, "token query parameter is required")
		return
	}

	tokenData, err := h.service.GetTokenByToken(token)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if tokenData == nil {
		h.respondError(w, http.StatusNotFound, "token not found")
		return
	}

	h.respondJSON(w, http.StatusOK, tokenData)
}

func (h *HTTPHandler) ListTokensByUser(w http.ResponseWriter, r *http.Request) {
	userID := r.URL.Query().Get("user_id")
	if userID == "" {
		h.respondError(w, http.StatusBadRequest, "user_id query parameter is required")
		return
	}

	tokens, err := h.service.ListTokensByUser(userID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, tokens)
}

func (h *HTTPHandler) RecordPushReceipt(w http.ResponseWriter, r *http.Request) {
	var req model.PushReceiptRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	receipt, err := h.service.RecordPushReceipt(&req)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusCreated, receipt)
}

func (h *HTTPHandler) Unsubscribe(w http.ResponseWriter, r *http.Request) {
	tokenID := strings.TrimPrefix(r.URL.Path, "/api/v1/tokens/")
	tokenID = strings.TrimSuffix(tokenID, "/unsubscribe")

	var body struct {
		Reason  string `json:"reason"`
		Channel string `json:"channel"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	event, err := h.service.Unsubscribe(tokenID, body.Reason, body.Channel)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusCreated, event)
}

func (h *HTTPHandler) ManualCorrection(w http.ResponseWriter, r *http.Request) {
	var req model.ManualCorrectionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	token, err := h.service.ManualCorrection(&req)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, token)
}

func (h *HTTPHandler) GenerateLifecycleReport(w http.ResponseWriter, r *http.Request) {
	tokenID := strings.TrimPrefix(r.URL.Path, "/api/v1/tokens/")
	tokenID = strings.TrimSuffix(tokenID, "/report")

	report, err := h.service.GenerateLifecycleReport(tokenID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, report)
}

func (h *HTTPHandler) GetReports(w http.ResponseWriter, r *http.Request) {
	startStr := r.URL.Query().Get("start_time")
	endStr := r.URL.Query().Get("end_time")

	var startTime, endTime time.Time
	var err error

	if startStr != "" {
		startTime, err = time.Parse(time.RFC3339, startStr)
		if err != nil {
			h.respondError(w, http.StatusBadRequest, "invalid start_time format")
			return
		}
	} else {
		startTime = time.Now().AddDate(0, -1, 0)
	}

	if endStr != "" {
		endTime, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			h.respondError(w, http.StatusBadRequest, "invalid end_time format")
			return
		}
	} else {
		endTime = time.Now()
	}

	reports, err := h.service.GetLifecycleReports(startTime, endTime)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, reports)
}

func (h *HTTPHandler) GetTokenLifecycleDetails(w http.ResponseWriter, r *http.Request) {
	tokenID := strings.TrimPrefix(r.URL.Path, "/api/v1/tokens/")
	tokenID = strings.TrimSuffix(tokenID, "/details")

	details, err := h.service.GetTokenLifecycleDetails(tokenID)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	h.respondJSON(w, http.StatusOK, details)
}

func (h *HTTPHandler) ExportReportsCSV(w http.ResponseWriter, r *http.Request) {
	startStr := r.URL.Query().Get("start_time")
	endStr := r.URL.Query().Get("end_time")

	var startTime, endTime time.Time
	var err error

	if startStr != "" {
		startTime, err = time.Parse(time.RFC3339, startStr)
		if err != nil {
			h.respondError(w, http.StatusBadRequest, "invalid start_time format")
			return
		}
	} else {
		startTime = time.Now().AddDate(0, -1, 0)
	}

	if endStr != "" {
		endTime, err = time.Parse(time.RFC3339, endStr)
		if err != nil {
			h.respondError(w, http.StatusBadRequest, "invalid end_time format")
			return
		}
	} else {
		endTime = time.Now()
	}

	reports, err := h.service.GetLifecycleReports(startTime, endTime)
	if err != nil {
		h.respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename=lifecycle_reports.csv")

	csv := "token_id,token,user_id,device_id,status,total_binds,total_pushes,success_pushes,failed_pushes,is_unsubscribed,is_rebound,generated_at\n"
	for _, r := range reports {
		csv += "\"" + r.TokenID + "\","
		csv += "\"" + r.Token + "\","
		csv += "\"" + r.UserID + "\","
		csv += "\"" + r.DeviceID + "\","
		csv += "\"" + string(r.Status) + "\","
		csv += fmt.Sprintf("%d,", r.TotalBinds)
		csv += fmt.Sprintf("%d,", r.TotalPushes)
		csv += fmt.Sprintf("%d,", r.SuccessPushes)
		csv += fmt.Sprintf("%d,", r.FailedPushes)
		csv += fmt.Sprintf("%d,", map[bool]int{true: 1, false: 0}[r.IsUnsubscribed])
		csv += fmt.Sprintf("%d,", map[bool]int{true: 1, false: 0}[r.IsRebound])
		csv += "\"" + r.GeneratedAt.Format(time.RFC3339) + "\"\n"
	}

	w.Write([]byte(csv))
}

func (h *HTTPHandler) HealthCheck(w http.ResponseWriter, r *http.Request) {
	h.respondJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
