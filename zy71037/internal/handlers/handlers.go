package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/gorilla/mux"
	"night-market-api/internal/models"
	"night-market-api/internal/services"
)

type Handler struct {
	dataService       *services.DataService
	rotationService   *services.RotationService
	validationService *services.ValidationService
	complaintService  *services.ComplaintService
	swapService       *services.SwapService
}

func NewHandler() *Handler {
	return &Handler{
		dataService:       services.NewDataService(),
		rotationService:   services.NewRotationService(),
		validationService: services.NewValidationService(),
		complaintService:  services.NewComplaintService(),
		swapService:       services.NewSwapService(),
	}
}

func jsonResponse(w http.ResponseWriter, status int, success bool, message string, data interface{}, errors interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(models.ApiResponse{
		Success: success,
		Message: message,
		Data:    data,
		Errors:  errors,
	})
}

func (h *Handler) CreateStall(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Code          string `json:"code"`
		Name          string `json:"name"`
		PowerCapacity int    `json:"power_capacity"`
		HasExhaust    bool   `json:"has_exhaust"`
		Zone          string `json:"zone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	stall, err := h.dataService.CreateStall(req.Code, req.Name, req.PowerCapacity, req.HasExhaust, req.Zone)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "创建摊位失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, true, "摊位创建成功", stall, nil)
}

func (h *Handler) ListStalls(w http.ResponseWriter, r *http.Request) {
	stalls, err := h.dataService.ListStalls()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "获取摊位列表失败", nil, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, true, "", stalls, nil)
}

func (h *Handler) CreateVendor(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name            string `json:"name"`
		Phone           string `json:"phone"`
		Category        string `json:"category"`
		PowerUsage      int    `json:"power_usage"`
		RequiresExhaust bool   `json:"requires_exhaust"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	vendor, err := h.dataService.CreateVendor(req.Name, req.Phone, req.Category, req.PowerUsage, req.RequiresExhaust)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "创建摊主失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, true, "摊主创建成功", vendor, nil)
}

func (h *Handler) ListVendors(w http.ResponseWriter, r *http.Request) {
	vendors, err := h.dataService.ListVendors()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "获取摊主列表失败", nil, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, true, "", vendors, nil)
}

func (h *Handler) CreateCycle(w http.ResponseWriter, r *http.Request) {
	var req struct {
		Name      string `json:"name"`
		StartDate string `json:"start_date"`
		EndDate   string `json:"end_date"`
		CreatedBy string `json:"created_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	cycle, err := h.rotationService.CreateCycle(req.Name, req.StartDate, req.EndDate, req.CreatedBy)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "创建轮换周期失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, true, "轮换周期创建成功", cycle, nil)
}

func (h *Handler) ListCycles(w http.ResponseWriter, r *http.Request) {
	cycles, err := h.rotationService.ListCycles()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "获取轮换周期列表失败", nil, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, true, "", cycles, nil)
}

func (h *Handler) CreateAssignment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CycleID  string `json:"cycle_id"`
		VendorID string `json:"vendor_id"`
		StallID  string `json:"stall_id"`
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	assignment, err := h.rotationService.CreateAssignment(req.CycleID, req.VendorID, req.StallID, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "创建分配失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, true, "分配创建成功", assignment, nil)
}

func (h *Handler) RemoveAssignment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	err := h.rotationService.RemoveAssignment(id, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "删除分配失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "分配删除成功", nil, nil)
}

func (h *Handler) GetCycleAssignments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cycleID := vars["cycleId"]

	assignments, err := h.rotationService.GetCycleAssignments(cycleID)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "获取分配列表失败", nil, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, true, "", assignments, nil)
}

func (h *Handler) ValidateCycle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cycleID := vars["cycleId"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	result, err := h.rotationService.ValidateCycle(cycleID, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "校验失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "校验完成", result, nil)
}

func (h *Handler) ValidateAssignment(w http.ResponseWriter, r *http.Request) {
	var req struct {
		VendorID string `json:"vendor_id"`
		StallID  string `json:"stall_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	result := h.validationService.ValidateAssignment(req.VendorID, req.StallID)
	jsonResponse(w, http.StatusOK, true, "", result, nil)
}

func (h *Handler) FinalizeCycle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cycleID := vars["cycleId"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	err := h.rotationService.FinalizeCycle(cycleID, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "定稿失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "轮换周期已定稿", nil, nil)
}

func (h *Handler) ReopenCycle(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cycleID := vars["cycleId"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	err := h.rotationService.ReopenCycle(cycleID, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "重新打开失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "轮换周期已重新打开", nil, nil)
}

func (h *Handler) CreateComplaint(w http.ResponseWriter, r *http.Request) {
	var req struct {
		VendorID    string `json:"vendor_id"`
		Type        string `json:"type"`
		Description string `json:"description"`
		Severity    string `json:"severity"`
		ReportedBy  string `json:"reported_by"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	complaint, err := h.complaintService.CreateComplaint(req.VendorID, req.Type, req.Description, req.Severity, req.ReportedBy)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "创建投诉失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, true, "投诉创建成功", complaint, nil)
}

func (h *Handler) ResolveComplaint(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Operator       string `json:"operator"`
		ApplyDeduction bool   `json:"apply_deduction"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	complaint, err := h.complaintService.ResolveComplaint(id, req.Operator, req.ApplyDeduction)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "处理投诉失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "投诉已处理", complaint, nil)
}

func (h *Handler) RejectComplaint(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	complaint, err := h.complaintService.RejectComplaint(id, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "驳回投诉失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "投诉已驳回", complaint, nil)
}

func (h *Handler) GetPendingComplaints(w http.ResponseWriter, r *http.Request) {
	complaints, err := h.complaintService.GetPendingComplaints()
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "获取待处理投诉失败", nil, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, true, "", complaints, nil)
}

func (h *Handler) CreateSwapRequest(w http.ResponseWriter, r *http.Request) {
	var req struct {
		CycleID            string `json:"cycle_id"`
		RequestingVendorID string `json:"requesting_vendor_id"`
		TargetVendorID     string `json:"target_vendor_id"`
		Reason             string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	swap, err := h.swapService.CreateSwapRequest(req.CycleID, req.RequestingVendorID, req.TargetVendorID, req.Reason)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "创建换位申请失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusCreated, true, "换位申请创建成功", swap, nil)
}

func (h *Handler) ApproveSwap(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	swap, err := h.swapService.ApproveSwap(id, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "批准换位失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "换位已批准", swap, nil)
}

func (h *Handler) RejectSwap(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	swap, err := h.swapService.RejectSwap(id, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "拒绝换位失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "换位已拒绝", swap, nil)
}

func (h *Handler) CompleteSwap(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	swap, err := h.swapService.CompleteSwap(id, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "完成换位失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "换位已完成", swap, nil)
}

func (h *Handler) CancelSwap(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	id := vars["id"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "请求参数错误", nil, err.Error())
		return
	}

	swap, err := h.swapService.CancelSwap(id, req.Operator)
	if err != nil {
		jsonResponse(w, http.StatusBadRequest, false, "取消换位失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "换位已取消", swap, nil)
}

func (h *Handler) GetCycleSwaps(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cycleID := vars["cycleId"]

	swaps, err := h.swapService.GetCycleSwaps(cycleID)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "获取换位列表失败", nil, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, true, "", swaps, nil)
}

func (h *Handler) GenerateReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cycleID := vars["cycleId"]

	report, err := h.rotationService.GenerateReport(cycleID)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "生成报告失败", nil, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, true, "", report, nil)
}

func (h *Handler) ExportReportCSV(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cycleID := vars["cycleId"]

	outputPath := "rotation_report.csv"
	err := h.rotationService.ExportReportCSV(cycleID, outputPath)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "导出CSV失败", nil, err.Error())
		return
	}

	jsonResponse(w, http.StatusOK, true, "CSV导出成功", map[string]string{"file": outputPath}, nil)
}

func (h *Handler) SuggestAssignments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	cycleID := vars["cycleId"]

	suggestions, err := h.rotationService.SuggestAssignment(cycleID)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "生成建议失败", nil, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, true, "", suggestions, nil)
}

func (h *Handler) GetAuditLogs(w http.ResponseWriter, r *http.Request) {
	entityType := r.URL.Query().Get("entity_type")
	entityID := r.URL.Query().Get("entity_id")

	logs, err := h.dataService.GetAuditLogs(entityType, entityID)
	if err != nil {
		jsonResponse(w, http.StatusInternalServerError, false, "获取审计日志失败", nil, err.Error())
		return
	}
	jsonResponse(w, http.StatusOK, true, "", logs, nil)
}
