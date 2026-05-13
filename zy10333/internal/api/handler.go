package api

import (
	"encoding/json"
	"env-switch-guard/internal/model"
	"env-switch-guard/internal/service"
	"env-switch-guard/pkg/errors"
	"net/http"
	"strconv"
	"time"
)

type Handler struct {
	service *service.SwitchService
}

func NewHandler(s *service.SwitchService) *Handler {
	return &Handler{service: s}
}

func (h *Handler) respond(w http.ResponseWriter, code int, message string, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(model.ApiResponse{
		Code:    code,
		Message: message,
		Data:    data,
	})
}

func (h *Handler) respondError(w http.ResponseWriter, err *errors.ServiceError) {
	w.Header().Set("Content-Type", "application/json")
	statusCode := http.StatusInternalServerError
	switch err.Code {
	case errors.CodeInvalidParams, errors.CodeInvalidEnvironment, errors.CodeRiskLevelBlocked:
		statusCode = http.StatusBadRequest
	case errors.CodeNotFound, errors.CodeSwitchNotFound:
		statusCode = http.StatusNotFound
	case errors.CodeConflict, errors.CodeIdempotentConflict:
		statusCode = http.StatusConflict
	case errors.CodeInvalidStatus, errors.CodeApprovalRequired:
		statusCode = http.StatusBadRequest
	}
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(model.ErrorResponse{
		Code:    err.Code,
		Message: err.Message,
		Details: err.Details,
	})
}

func (h *Handler) CreateSwitchItem(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name        string `json:"name"`
		Description string `json:"description"`
		Category    string `json:"category"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, errors.InvalidParams("请求格式错误"))
		return
	}
	if req.Name == "" {
		h.respondError(w, errors.InvalidParams("开关名称不能为空"))
		return
	}

	item, err := h.service.CreateSwitchItem(req.Name, req.Description, req.Category)
	if err != nil {
		h.respondError(w, err.(*errors.ServiceError))
		return
	}

	h.respond(w, 0, "创建成功", item)
}

func (h *Handler) CreateTicket(w http.ResponseWriter, r *http.Request) {
	var req model.CreateTicketRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, errors.InvalidParams("请求格式错误"))
		return
	}

	ticket, err := h.service.CreateTicket(&req)
	if err != nil {
		h.respondError(w, err.(*errors.ServiceError))
		return
	}

	h.respond(w, 0, "创建成功", ticket)
}

func (h *Handler) ValidateTicket(w http.ResponseWriter, r *http.Request) {
	var req model.ValidateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, errors.InvalidParams("请求格式错误"))
		return
	}
	if req.TicketID == "" {
		h.respondError(w, errors.InvalidParams("审批票ID不能为空"))
		return
	}

	ticket, err := h.service.ValidateTicket(req.TicketID)
	if err != nil {
		h.respondError(w, err.(*errors.ServiceError))
		return
	}

	h.respond(w, 0, "校验通过", ticket)
}

func (h *Handler) ApproveTicket(w http.ResponseWriter, r *http.Request) {
	var req model.ApproveRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, errors.InvalidParams("请求格式错误"))
		return
	}
	if req.TicketID == "" {
		h.respondError(w, errors.InvalidParams("审批票ID不能为空"))
		return
	}
	if req.ApproverID == "" {
		h.respondError(w, errors.InvalidParams("审批人ID不能为空"))
		return
	}

	ticket, err := h.service.ApproveTicket(req.TicketID, req.ApproverID)
	if err != nil {
		h.respondError(w, err.(*errors.ServiceError))
		return
	}

	h.respond(w, 0, "审批成功", ticket)
}

func (h *Handler) ExecuteTicket(w http.ResponseWriter, r *http.Request) {
	var req model.ExecuteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		h.respondError(w, errors.InvalidParams("请求格式错误"))
		return
	}
	if req.TicketID == "" {
		h.respondError(w, errors.InvalidParams("审批票ID不能为空"))
		return
	}

	result, err := h.service.ExecuteTicket(req.TicketID)
	if err != nil {
		h.respondError(w, err.(*errors.ServiceError))
		return
	}

	h.respond(w, 0, "执行成功", result)
}

func (h *Handler) GetTicket(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		h.respondError(w, errors.InvalidParams("审批票ID不能为空"))
		return
	}

	ticket, err := h.service.GetTicket(id)
	if err != nil {
		h.respondError(w, err.(*errors.ServiceError))
		return
	}

	h.respond(w, 0, "查询成功", ticket)
}

func (h *Handler) ListTickets(w http.ResponseWriter, r *http.Request) {
	query := &model.HistoryQuery{}

	switchID := r.URL.Query().Get("switch_id")
	if switchID != "" {
		query.SwitchID = &switchID
	}
	operatorID := r.URL.Query().Get("operator_id")
	if operatorID != "" {
		query.OperatorID = &operatorID
	}
	env := r.URL.Query().Get("environment")
	if env != "" {
		e := model.Environment(env)
		query.Environment = &e
	}
	status := r.URL.Query().Get("status")
	if status != "" {
		s := model.SwitchStatus(status)
		query.Status = &s
	}
	startTime := r.URL.Query().Get("start_time")
	if startTime != "" {
		if t, err := time.Parse(time.RFC3339, startTime); err == nil {
			query.StartTime = &t
		}
	}
	endTime := r.URL.Query().Get("end_time")
	if endTime != "" {
		if t, err := time.Parse(time.RFC3339, endTime); err == nil {
			query.EndTime = &t
		}
	}

	pageStr := r.URL.Query().Get("page")
	if pageStr != "" {
		page, _ := strconv.Atoi(pageStr)
		query.Page = page
	}
	pageSizeStr := r.URL.Query().Get("page_size")
	if pageSizeStr != "" {
		pageSize, _ := strconv.Atoi(pageSizeStr)
		query.PageSize = pageSize
	}

	tickets, total, err := h.service.ListTickets(query)
	if err != nil {
		h.respondError(w, err.(*errors.ServiceError))
		return
	}

	h.respond(w, 0, "查询成功", map[string]interface{}{
		"list":  tickets,
		"total": total,
		"page":  query.Page,
		"size":  query.PageSize,
	})
}

func (h *Handler) GetResult(w http.ResponseWriter, r *http.Request) {
	id := r.URL.Query().Get("id")
	if id == "" {
		h.respondError(w, errors.InvalidParams("结果ID不能为空"))
		return
	}

	result, err := h.service.GetResult(id)
	if err != nil {
		h.respondError(w, err.(*errors.ServiceError))
		return
	}

	h.respond(w, 0, "查询成功", result)
}

func (h *Handler) ExportTickets(w http.ResponseWriter, r *http.Request) {
	query := &model.HistoryQuery{}
	query.Page = 1
	query.PageSize = 1000

	tickets, _, err := h.service.ListTickets(query)
	if err != nil {
		h.respondError(w, err.(*errors.ServiceError))
		return
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=tickets.json")
	json.NewEncoder(w).Encode(tickets)
}
