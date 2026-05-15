package handler

import (
	"encoding/json"
	"net/http"
	"secure-unpack-api/internal/errors"
	"secure-unpack-api/internal/model"
	"secure-unpack-api/internal/service"
	"strconv"

	"github.com/gorilla/mux"
)

type Handler struct {
	service *service.UnpackService
}

func NewHandler(service *service.UnpackService) *Handler {
	return &Handler{service: service}
}

func (h *Handler) respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if data != nil {
		json.NewEncoder(w).Encode(data)
	}
}

func (h *Handler) respondError(w http.ResponseWriter, err error) {
	code := errors.MapToErrorCode(err)
	var message string
	if appErr, ok := err.(*errors.AppError); ok {
		message = appErr.Message
	} else {
		message = err.Error()
	}

	response := model.ErrorResponse{
		Code:    code,
		Message: message,
	}

	if appErr, ok := err.(*errors.AppError); ok && appErr.Detail != "" {
		response.Detail = appErr.Detail
	}

	status := http.StatusInternalServerError
	switch code {
	case "TASK_NOT_FOUND":
		status = http.StatusNotFound
	case "TASK_ALREADY_EXISTS", "DUPLICATE_TASK":
		status = http.StatusConflict
	case "INVALID_STATUS", "VALIDATION_FAILED", "VALIDATION_ERROR", "INVALID_REQUEST":
		status = http.StatusBadRequest
	case "PATH_TRAVERSAL", "FILE_TOO_LARGE", "TOTAL_SIZE_EXCEEDED", "TOO_MANY_FILES", "BLOCKED_EXTENSION", "BLOCKED_PATTERN":
		status = http.StatusBadRequest
	}

	h.respondJSON(w, status, response)
}

func (h *Handler) CreateTask(w http.ResponseWriter, r *http.Request) {
	var req model.CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, errors.NewAppError("INVALID_REQUEST", "Invalid request body", err))
		return
	}

	task, err := h.service.CreateTask(&req)
	if err != nil {
		h.respondError(w, err)
		return
	}

	h.respondJSON(w, http.StatusCreated, model.CreateTaskResponse{
		TaskID: task.TaskID,
		Status: task.Status,
	})
}

func (h *Handler) GetTask(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	taskID := vars["task_id"]

	task, err := h.service.GetTask(taskID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	h.respondJSON(w, http.StatusOK, task)
}

func (h *Handler) ValidateTask(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	taskID := vars["task_id"]

	risks, err := h.service.ValidateTask(taskID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"task_id":    taskID,
		"validated":  true,
		"risk_count": len(risks),
		"risks":      risks,
	})
}

type ProcessTaskRequest struct {
	Files []model.FileEntry `json:"files"`
}

func (h *Handler) ProcessTask(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	taskID := vars["task_id"]

	var req ProcessTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		req.Files = []model.FileEntry{}
	}

	result, err := h.service.ProcessTask(taskID, req.Files)
	if err != nil {
		h.respondError(w, err)
		return
	}

	h.respondJSON(w, http.StatusOK, result)
}

func (h *Handler) ListTasks(w http.ResponseWriter, r *http.Request) {
	status := model.TaskStatus(r.URL.Query().Get("status"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	tasks, err := h.service.ListTasks(status, limit, offset)
	if err != nil {
		h.respondError(w, err)
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"tasks": tasks,
		"count": len(tasks),
	})
}

func (h *Handler) ExportResult(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	taskID := vars["task_id"]

	result, err := h.service.GetResult(taskID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	risks, err := h.service.GetRisks(taskID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	taskResp, err := h.service.GetTask(taskID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"task":        taskResp.Task,
		"result":      result,
		"risks":       risks,
		"exported_at": result.CompletedAt,
	})
}

func (h *Handler) GetRisks(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	taskID := vars["task_id"]

	risks, err := h.service.GetRisks(taskID)
	if err != nil {
		h.respondError(w, err)
		return
	}

	h.respondJSON(w, http.StatusOK, map[string]interface{}{
		"task_id": taskID,
		"risks":   risks,
		"count":   len(risks),
	})
}
