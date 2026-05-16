package handlers

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sampling-budget-api/models"
	"sampling-budget-api/storage"
	"strconv"
	"time"

	"github.com/gorilla/mux"
)

type Handler struct {
	db *storage.DB
}

func NewHandler(db *storage.DB) *Handler {
	return &Handler{db: db}
}

func respondJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func respondError(w http.ResponseWriter, status int, message string, errCode string) {
	response := models.ApiResponse{
		Status:    models.StatusBlocked,
		Message:   message,
		ErrorCode: errCode,
	}
	respondJSON(w, status, response)
}

func (h *Handler) logException(serviceName, operation, rawInput, errType, errMsg, conclusion string) {
	log := &models.ExceptionLog{
		ServiceName:          serviceName,
		Operation:            operation,
		RawInput:             rawInput,
		ErrorType:            errType,
		ErrorMessage:         errMsg,
		ProcessingConclusion: conclusion,
		ResolutionStatus:     "UNRESOLVED",
	}
	h.db.CreateExceptionLog(log)
}

func (h *Handler) CreateService(w http.ResponseWriter, r *http.Request) {
	var service models.Service
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &service); err != nil {
		h.logException("", "CreateService", string(body), "JSON_PARSE_ERROR", err.Error(), "请求格式错误")
		respondError(w, http.StatusBadRequest, "Invalid request body", "JSON_PARSE_ERROR")
		return
	}

	if service.Name == "" {
		h.logException("", "CreateService", string(body), "VALIDATION_ERROR", "Service name is required", "缺少必要字段")
		respondError(w, http.StatusBadRequest, "Service name is required", "VALIDATION_ERROR")
		return
	}

	service.IsActive = true
	if err := h.db.CreateService(&service); err != nil {
		h.logException(service.Name, "CreateService", string(body), "DB_ERROR", err.Error(), "创建服务失败")
		respondError(w, http.StatusInternalServerError, "Failed to create service", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Service created successfully",
		Data:    service,
	}
	respondJSON(w, http.StatusCreated, response)
}

func (h *Handler) GetService(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	service, err := h.db.GetService(serviceName)
	if err != nil {
		respondError(w, http.StatusNotFound, "Service not found", "NOT_FOUND")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Service retrieved successfully",
		Data:    service,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) ListServices(w http.ResponseWriter, r *http.Request) {
	services, err := h.db.ListServices()
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list services", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Services retrieved successfully",
		Data:    services,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) UpdateService(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	var service models.Service
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &service); err != nil {
		h.logException(serviceName, "UpdateService", string(body), "JSON_PARSE_ERROR", err.Error(), "请求格式错误")
		respondError(w, http.StatusBadRequest, "Invalid request body", "JSON_PARSE_ERROR")
		return
	}
	service.Name = serviceName

	if err := h.db.UpdateService(&service); err != nil {
		h.logException(serviceName, "UpdateService", string(body), "DB_ERROR", err.Error(), "更新服务失败")
		respondError(w, http.StatusInternalServerError, "Failed to update service", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Service updated successfully",
		Data:    service,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) CreateSamplingRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	var rule models.SamplingRule
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &rule); err != nil {
		h.logException(serviceName, "CreateSamplingRule", string(body), "JSON_PARSE_ERROR", err.Error(), "请求格式错误")
		respondError(w, http.StatusBadRequest, "Invalid request body", "JSON_PARSE_ERROR")
		return
	}
	rule.ServiceName = serviceName
	rule.Status = "ACTIVE"

	if rule.IdempotencyKey != "" {
		exists, err := h.db.CheckIdempotentRule(rule.IdempotencyKey)
		if err == nil && exists {
			response := models.ApiResponse{
				Status:  models.StatusSuccess,
				Message: "Rule already exists (idempotent)",
			}
			respondJSON(w, http.StatusOK, response)
			return
		}
	}

	if err := h.db.CreateSamplingRule(&rule); err != nil {
		h.logException(serviceName, "CreateSamplingRule", string(body), "DB_ERROR", err.Error(), "创建采样规则失败")
		respondError(w, http.StatusInternalServerError, "Failed to create sampling rule", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Sampling rule created successfully",
		Data:    rule,
	}
	respondJSON(w, http.StatusCreated, response)
}

func (h *Handler) GetSamplingRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]
	ruleID, _ := strconv.ParseInt(vars["ruleID"], 10, 64)

	rule, err := h.db.GetSamplingRule(serviceName, ruleID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Sampling rule not found", "NOT_FOUND")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Sampling rule retrieved successfully",
		Data:    rule,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) ListSamplingRules(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	rules, err := h.db.ListSamplingRules(serviceName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list sampling rules", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Sampling rules retrieved successfully",
		Data:    rules,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) UpdateSamplingRule(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]
	ruleID, _ := strconv.ParseInt(vars["ruleID"], 10, 64)

	var rule models.SamplingRule
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &rule); err != nil {
		h.logException(serviceName, "UpdateSamplingRule", string(body), "JSON_PARSE_ERROR", err.Error(), "请求格式错误")
		respondError(w, http.StatusBadRequest, "Invalid request body", "JSON_PARSE_ERROR")
		return
	}
	rule.ID = ruleID
	rule.ServiceName = serviceName

	if err := h.db.UpdateSamplingRule(&rule); err != nil {
		h.logException(serviceName, "UpdateSamplingRule", string(body), "DB_ERROR", err.Error(), "更新采样规则失败")
		respondError(w, http.StatusInternalServerError, "Failed to update sampling rule", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Sampling rule updated successfully",
		Data:    rule,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) UpdateRuleStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]
	ruleID, _ := strconv.ParseInt(vars["ruleID"], 10, 64)

	var req struct {
		Status string `json:"status"`
	}
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &req); err != nil {
		h.logException(serviceName, "UpdateRuleStatus", string(body), "JSON_PARSE_ERROR", err.Error(), "请求格式错误")
		respondError(w, http.StatusBadRequest, "Invalid request body", "JSON_PARSE_ERROR")
		return
	}

	if err := h.db.UpdateRuleStatus(ruleID, req.Status); err != nil {
		h.logException(serviceName, "UpdateRuleStatus", string(body), "DB_ERROR", err.Error(), "更新规则状态失败")
		respondError(w, http.StatusInternalServerError, "Failed to update rule status", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Rule status updated successfully",
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) GetBudget(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	budget, err := h.db.GetBudget(serviceName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get budget", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Budget retrieved successfully",
		Data:    budget,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) DeductBudget(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	var req models.BudgetDeductRequest
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &req); err != nil {
		h.logException(serviceName, "DeductBudget", string(body), "JSON_PARSE_ERROR", err.Error(), "请求格式错误")
		respondError(w, http.StatusBadRequest, "Invalid request body", "JSON_PARSE_ERROR")
		return
	}

	if req.IdempotencyKey != "" {
		exists, err := h.db.CheckIdempotentTransaction(req.IdempotencyKey)
		if err == nil && exists {
			response := models.BudgetDeductResponse{
				Status:         models.StatusSuccess,
				Success:        true,
				Message:        "Transaction already processed (idempotent)",
				DeductedAmount: 0,
			}
			respondJSON(w, http.StatusOK, response)
			return
		}
	}

	budget, err := h.db.GetBudget(serviceName)
	if err != nil {
		h.logException(serviceName, "DeductBudget", string(body), "DB_ERROR", err.Error(), "获取预算失败")
		respondError(w, http.StatusInternalServerError, "Failed to get budget", "DB_ERROR")
		return
	}

	if budget.RemainingBudget < req.DeductCount {
		h.logException(serviceName, "DeductBudget", string(body), "BUDGET_EXHAUSTED", fmt.Sprintf("remaining: %d, requested: %d", budget.RemainingBudget, req.DeductCount), "预算不足被拦截")
		
		tx := &models.BudgetTransaction{
			ServiceName:     serviceName,
			TransactionType: "DEDUCT_BLOCKED",
			Amount:          req.DeductCount,
			TraceID:         req.TraceID,
			Reason:          "Budget exhausted",
			IdempotencyKey:  req.IdempotencyKey,
		}
		h.db.CreateTransaction(tx)

		response := models.BudgetDeductResponse{
			Status:          models.StatusBlocked,
			Success:         false,
			Message:         "Budget exhausted",
			RemainingBudget: budget.RemainingBudget,
			DeductedAmount:  0,
		}
		respondJSON(w, http.StatusOK, response)
		return
	}

	budget.UsedBudget += req.DeductCount
	budget.RemainingBudget -= req.DeductCount
	if err := h.db.UpdateBudget(budget); err != nil {
		h.logException(serviceName, "DeductBudget", string(body), "DB_ERROR", err.Error(), "更新预算失败")
		respondError(w, http.StatusInternalServerError, "Failed to update budget", "DB_ERROR")
		return
	}

	tx := &models.BudgetTransaction{
		ServiceName:     serviceName,
		TransactionType: "DEDUCT",
		Amount:          req.DeductCount,
		TraceID:         req.TraceID,
		Reason:          req.Reason,
		IdempotencyKey:  req.IdempotencyKey,
	}
	h.db.CreateTransaction(tx)

	response := models.BudgetDeductResponse{
		Status:          models.StatusSuccess,
		Success:         true,
		Message:         "Budget deducted successfully",
		RemainingBudget: budget.RemainingBudget,
		DeductedAmount:  req.DeductCount,
		TransactionID:   fmt.Sprintf("%d", tx.ID),
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) CompensateBudget(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	var req struct {
		Amount          int64  `json:"amount"`
		Reason          string `json:"reason"`
		IdempotencyKey  string `json:"idempotency_key"`
	}
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &req); err != nil {
		h.logException(serviceName, "CompensateBudget", string(body), "JSON_PARSE_ERROR", err.Error(), "请求格式错误")
		respondError(w, http.StatusBadRequest, "Invalid request body", "JSON_PARSE_ERROR")
		return
	}

	if req.IdempotencyKey != "" {
		exists, err := h.db.CheckIdempotentTransaction(req.IdempotencyKey)
		if err == nil && exists {
			response := models.ApiResponse{
				Status:  models.StatusSuccess,
				Message: "Compensation already processed (idempotent)",
			}
			respondJSON(w, http.StatusOK, response)
			return
		}
	}

	budget, err := h.db.GetBudget(serviceName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get budget", "DB_ERROR")
		return
	}

	budget.CompensatedBudget += req.Amount
	budget.RemainingBudget += req.Amount
	if err := h.db.UpdateBudget(budget); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update budget", "DB_ERROR")
		return
	}

	tx := &models.BudgetTransaction{
		ServiceName:     serviceName,
		TransactionType: "COMPENSATE",
		Amount:          req.Amount,
		Reason:          req.Reason,
		IdempotencyKey:  req.IdempotencyKey,
	}
	h.db.CreateTransaction(tx)

	response := models.ApiResponse{
		Status:  models.StatusCompensated,
		Message: "Budget compensated successfully",
		Data:    budget,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) ManualCorrection(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	var req models.ManualCorrectionRequest
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &req); err != nil {
		h.logException(serviceName, "ManualCorrection", string(body), "JSON_PARSE_ERROR", err.Error(), "请求格式错误")
		respondError(w, http.StatusBadRequest, "Invalid request body", "JSON_PARSE_ERROR")
		return
	}

	budget, err := h.db.GetBudget(serviceName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get budget", "DB_ERROR")
		return
	}

	switch req.CorrectionType {
	case "INCREASE_TOTAL":
		budget.TotalBudget += req.AdjustmentValue
		budget.RemainingBudget += req.AdjustmentValue
	case "DECREASE_TOTAL":
		budget.TotalBudget -= req.AdjustmentValue
		if budget.RemainingBudget > req.AdjustmentValue {
			budget.RemainingBudget -= req.AdjustmentValue
		} else {
			budget.RemainingBudget = 0
		}
	case "RESET_USAGE":
		budget.UsedBudget = 0
		budget.RemainingBudget = budget.TotalBudget
	}

	if err := h.db.UpdateBudget(budget); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to update budget", "DB_ERROR")
		return
	}

	tx := &models.BudgetTransaction{
		ServiceName:     serviceName,
		TransactionType: "MANUAL_CORRECTION",
		Amount:          req.AdjustmentValue,
		Reason:          fmt.Sprintf("%s by %s", req.Reason, req.Operator),
	}
	h.db.CreateTransaction(tx)

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Manual correction applied successfully",
		Data:    budget,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) CreateAdjustment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	var adj models.AdjustmentRequest
	body, _ := io.ReadAll(r.Body)
	if err := json.Unmarshal(body, &adj); err != nil {
		h.logException(serviceName, "CreateAdjustment", string(body), "JSON_PARSE_ERROR", err.Error(), "请求格式错误")
		respondError(w, http.StatusBadRequest, "Invalid request body", "JSON_PARSE_ERROR")
		return
	}
	adj.ServiceName = serviceName
	adj.Status = "PENDING"

	if adj.IdempotencyKey != "" {
		exists, err := h.db.CheckIdempotentAdjustment(adj.IdempotencyKey)
		if err == nil && exists {
			response := models.ApiResponse{
				Status:  models.StatusSuccess,
				Message: "Adjustment already exists (idempotent)",
			}
			respondJSON(w, http.StatusOK, response)
			return
		}
	}

	if err := h.db.CreateAdjustmentRequest(&adj); err != nil {
		h.logException(serviceName, "CreateAdjustment", string(body), "DB_ERROR", err.Error(), "创建调整申请失败")
		respondError(w, http.StatusInternalServerError, "Failed to create adjustment request", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusPending,
		Message: "Adjustment request created successfully, pending approval",
		Data:    adj,
	}
	respondJSON(w, http.StatusCreated, response)
}

func (h *Handler) GetAdjustment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]
	adjID, _ := strconv.ParseInt(vars["adjustmentID"], 10, 64)

	adj, err := h.db.GetAdjustmentRequest(serviceName, adjID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Adjustment request not found", "NOT_FOUND")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Adjustment request retrieved successfully",
		Data:    adj,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) ListAdjustments(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	adjustments, err := h.db.ListAdjustmentRequests(serviceName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list adjustment requests", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Adjustment requests retrieved successfully",
		Data:    adjustments,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) ApproveAdjustment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]
	adjID, _ := strconv.ParseInt(vars["adjustmentID"], 10, 64)

	var req struct {
		Approver string `json:"approver"`
	}
	body, _ := io.ReadAll(r.Body)
	json.Unmarshal(body, &req)

	adj, err := h.db.GetAdjustmentRequest(serviceName, adjID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Adjustment request not found", "NOT_FOUND")
		return
	}

	if adj.Status != "PENDING" {
		respondError(w, http.StatusBadRequest, "Adjustment already processed", "ALREADY_PROCESSED")
		return
	}

	if err := h.db.ApproveAdjustment(adjID, req.Approver); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to approve adjustment", "DB_ERROR")
		return
	}

	budget, err := h.db.GetBudget(serviceName)
	if err == nil {
		switch adj.AdjustmentType {
		case "INCREASE":
			budget.TotalBudget += adj.AdjustmentValue
			budget.RemainingBudget += adj.AdjustmentValue
		case "DECREASE":
			budget.TotalBudget -= adj.AdjustmentValue
		}
		h.db.UpdateBudget(budget)
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Adjustment approved successfully",
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) RejectAdjustment(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]
	adjID, _ := strconv.ParseInt(vars["adjustmentID"], 10, 64)

	var req struct {
		Approver string `json:"approver"`
	}
	body, _ := io.ReadAll(r.Body)
	json.Unmarshal(body, &req)

	adj, err := h.db.GetAdjustmentRequest(serviceName, adjID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Adjustment request not found", "NOT_FOUND")
		return
	}

	if adj.Status != "PENDING" {
		respondError(w, http.StatusBadRequest, "Adjustment already processed", "ALREADY_PROCESSED")
		return
	}

	if err := h.db.RejectAdjustment(adjID, req.Approver); err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to reject adjustment", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Adjustment rejected successfully",
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) GenerateReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	budget, err := h.db.GetBudget(serviceName)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get budget", "DB_ERROR")
		return
	}

	adjCount, _ := h.db.GetAdjustmentCount(serviceName, "APPROVED")
	exceptionCount, _ := h.db.ListExceptionLogs(serviceName, 1000)
	topTraces, _ := h.db.GetTraceSummary(serviceName, 10)

	utilizationRate := 0.0
	if budget.TotalBudget > 0 {
		utilizationRate = float64(budget.UsedBudget) / float64(budget.TotalBudget) * 100
	}

	report := models.BudgetReport{
		ServiceName:       serviceName,
		ReportPeriod:      time.Now().Format("2006-01"),
		TotalBudget:       budget.TotalBudget,
		UsedBudget:        budget.UsedBudget,
		RemainingBudget:   budget.RemainingBudget,
		CompensatedBudget: budget.CompensatedBudget,
		UtilizationRate:   utilizationRate,
		AdjustmentCount:   adjCount,
		ExceptionCount:    len(exceptionCount),
		GeneratedAt:       time.Now(),
		TopTraces:         topTraces,
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Report generated successfully",
		Data:    report,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) ExportReport(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	serviceName := vars["serviceName"]

	transactions, err := h.db.ListTransactions(serviceName, 10000)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to get transactions", "DB_ERROR")
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=\"budget_report_%s_%s.csv\"", serviceName, time.Now().Format("20060102")))

	writer := csv.NewWriter(w)
	defer writer.Flush()

	writer.Write([]string{"ID", "Service Name", "Transaction Type", "Amount", "Trace ID", "Reason", "Created At"})

	for _, tx := range transactions {
		writer.Write([]string{
			fmt.Sprintf("%d", tx.ID),
			tx.ServiceName,
			tx.TransactionType,
			fmt.Sprintf("%d", tx.Amount),
			tx.TraceID,
			tx.Reason,
			tx.CreatedAt.Format(time.RFC3339),
		})
	}
}

func (h *Handler) GetExceptionLog(w http.ResponseWriter, r *http.Request) {
	logID, _ := strconv.ParseInt(mux.Vars(r)["logID"], 10, 64)

	log, err := h.db.GetExceptionLog(logID)
	if err != nil {
		respondError(w, http.StatusNotFound, "Exception log not found", "NOT_FOUND")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Exception log retrieved successfully",
		Data:    log,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) ListExceptionLogs(w http.ResponseWriter, r *http.Request) {
	serviceName := r.URL.Query().Get("service")
	limit := 100
	if l, err := strconv.Atoi(r.URL.Query().Get("limit")); err == nil {
		limit = l
	}

	logs, err := h.db.ListExceptionLogs(serviceName, limit)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "Failed to list exception logs", "DB_ERROR")
		return
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Exception logs retrieved successfully",
		Data:    logs,
	}
	respondJSON(w, http.StatusOK, response)
}

func (h *Handler) LoadSampleData(w http.ResponseWriter, r *http.Request) {
	services := []models.Service{
		{Name: "user-service", Description: "用户中心服务", IsActive: true},
		{Name: "order-service", Description: "订单服务", IsActive: true},
		{Name: "payment-service", Description: "支付服务", IsActive: true},
	}

	for _, s := range services {
		h.db.CreateService(&s)

		rules := []models.SamplingRule{
			{
				ServiceName:   s.Name,
				RuleName:      "默认采样规则",
				Description:   "生产环境默认采样率",
				Priority:      10,
				SampleRate:    0.01,
				Tags:          map[string]string{"env": "prod", "level": "info"},
				Status:        "ACTIVE",
			},
			{
				ServiceName:   s.Name,
				RuleName:      "错误采样规则",
				Description:   "错误日志全量采样",
				Priority:      100,
				SampleRate:    1.0,
				Tags:          map[string]string{"level": "error"},
				Status:        "ACTIVE",
			},
		}

		for _, rule := range rules {
			h.db.CreateSamplingRule(&rule)
		}

		budget, _ := h.db.GetBudget(s.Name)
		budget.TotalBudget = 5000000
		budget.UsedBudget = 2345678
		budget.RemainingBudget = 2654322
		h.db.UpdateBudget(budget)
	}

	response := models.ApiResponse{
		Status:  models.StatusSuccess,
		Message: "Sample data loaded successfully",
	}
	respondJSON(w, http.StatusOK, response)
}
