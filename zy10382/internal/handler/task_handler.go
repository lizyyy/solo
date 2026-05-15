package handler

import (
	"customer-probe-api/internal/models"
	"customer-probe-api/internal/service"
	"encoding/json"
	"net/http"
	"strings"
)

type TaskHandler struct {
	taskService *service.TaskService
}

func NewTaskHandler() *TaskHandler {
	return &TaskHandler{
		taskService: service.NewTaskService(),
	}
}

func (h *TaskHandler) CreateTask(w http.ResponseWriter, r *http.Request) {
	var req service.CreateTaskRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	task, isDuplicate, err := h.taskService.CreateTask(req)
	if err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to create task", err)
		return
	}

	if isDuplicate {
		w.Header().Set("X-Duplicate-Request", "true")
		JSONResponse(w, http.StatusOK, map[string]interface{}{
			"task":       task,
			"duplicate":  true,
			"message":    "task already exists with same idempotency key",
		})
		return
	}

	JSONResponse(w, http.StatusCreated, task)
}

func (h *TaskHandler) GetTask(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/tasks/")
	if id == "" {
		JSONError(w, http.StatusBadRequest, "task id is required", nil)
		return
	}

	task, err := h.taskService.GetTask(id)
	if err != nil {
		JSONError(w, http.StatusNotFound, "task not found", err)
		return
	}

	JSONResponse(w, http.StatusOK, task)
}

func (h *TaskHandler) GetTaskFullData(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/tasks/")
	id = id[:len(id)-len("/full")]
	if id == "" {
		JSONError(w, http.StatusBadRequest, "task id is required", nil)
		return
	}

	data, err := h.taskService.GetTaskFullData(id)
	if err != nil {
		JSONError(w, http.StatusNotFound, "task not found", err)
		return
	}

	JSONResponse(w, http.StatusOK, data)
}

func (h *TaskHandler) ListTasks(w http.ResponseWriter, r *http.Request) {
	page, pageSize := GetPagination(r)
	envID := r.URL.Query().Get("env_id")
	status := r.URL.Query().Get("status")

	var tasks []models.ProbeTask
	var total int64
	var err error

	if envID != "" {
		tasks, total, err = h.taskService.ListTasksByEnv(envID, page, pageSize)
	} else {
		tasks, total, err = h.taskService.ListTasksByStatus(status, page, pageSize)
	}

	if err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to list tasks", err)
		return
	}

	JSONResponse(w, http.StatusOK, map[string]interface{}{
		"items": tasks,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

func (h *TaskHandler) AssignTask(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/tasks/")
	id = id[:len(id)-len("/assign")]
	if id == "" {
		JSONError(w, http.StatusBadRequest, "task id is required", nil)
		return
	}

	var req struct {
		Agent string `json:"agent"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if err := h.taskService.AssignTask(id, req.Agent); err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to assign task", err)
		return
	}

	JSONResponse(w, http.StatusOK, map[string]string{"message": "task assigned"})
}

func (h *TaskHandler) StartTask(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/tasks/")
	id = id[:len(id)-len("/start")]
	if id == "" {
		JSONError(w, http.StatusBadRequest, "task id is required", nil)
		return
	}

	if err := h.taskService.StartTask(id); err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to start task", err)
		return
	}

	JSONResponse(w, http.StatusOK, map[string]string{"message": "task started"})
}

func (h *TaskHandler) CompleteTask(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/tasks/")
	id = id[:len(id)-len("/complete")]
	if id == "" {
		JSONError(w, http.StatusBadRequest, "task id is required", nil)
		return
	}

	var req struct {
		NetworkResult *models.NetworkResult `json:"network_result"`
		DNSRecords    []models.DNSRecord    `json:"dns_records"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if err := h.taskService.CompleteTask(id, req.NetworkResult, req.DNSRecords); err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to complete task", err)
		return
	}

	JSONResponse(w, http.StatusOK, map[string]string{"message": "task completed"})
}

func (h *TaskHandler) FailTask(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/tasks/")
	id = id[:len(id)-len("/fail")]
	if id == "" {
		JSONError(w, http.StatusBadRequest, "task id is required", nil)
		return
	}

	var req struct {
		ErrorMsg string `json:"error_msg"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		JSONError(w, http.StatusBadRequest, "invalid request body", err)
		return
	}

	if err := h.taskService.FailTask(id, req.ErrorMsg); err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to fail task", err)
		return
	}

	JSONResponse(w, http.StatusOK, map[string]string{"message": "task marked as failed"})
}

func (h *TaskHandler) TimeoutTask(w http.ResponseWriter, r *http.Request) {
	id := GetIDFromURL(r.URL.Path, "/api/tasks/")
	id = id[:len(id)-len("/timeout")]
	if id == "" {
		JSONError(w, http.StatusBadRequest, "task id is required", nil)
		return
	}

	if err := h.taskService.TimeoutTask(id); err != nil {
		JSONError(w, http.StatusInternalServerError, "failed to timeout task", err)
		return
	}

	JSONResponse(w, http.StatusOK, map[string]string{"message": "task marked as timeout"})
}

func (h *TaskHandler) GetTaskByIdempotencyKey(w http.ResponseWriter, r *http.Request) {
	key := r.URL.Query().Get("key")
	if key == "" {
		JSONError(w, http.StatusBadRequest, "idempotency key is required", nil)
		return
	}

	task, err := h.taskService.GetTaskByIdempotencyKey(key)
	if err != nil {
		JSONError(w, http.StatusNotFound, "task not found", err)
		return
	}

	JSONResponse(w, http.StatusOK, task)
}
