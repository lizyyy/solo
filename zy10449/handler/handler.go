package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"webhook-migration/service"

	"github.com/gorilla/mux"
)

type MigrationHandler struct {
	migrationService *service.MigrationService
	eventService     *service.EventService
}

func NewMigrationHandler() *MigrationHandler {
	return &MigrationHandler{
		migrationService: service.NewMigrationService(),
		eventService:     service.NewEventService(),
	}
}

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func respondJSON(w http.ResponseWriter, code int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(Response{
		Code:    code,
		Message: "success",
		Data:    data,
	})
}

func respondError(w http.ResponseWriter, code int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(Response{
		Code:    code,
		Message: message,
	})
}

func (h *MigrationHandler) CreateMigration(w http.ResponseWriter, r *http.Request) {
	var req service.CreateMigrationRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	migration, err := h.migrationService.CreateMigration(&req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "创建迁移失败: "+err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, migration)
}

func (h *MigrationHandler) GetMigration(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	migration, err := h.migrationService.GetMigration(migrationID)
	if err != nil {
		respondError(w, http.StatusNotFound, "迁移记录不存在")
		return
	}

	respondJSON(w, http.StatusOK, migration)
}

func (h *MigrationHandler) ListMigrations(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	migrations, total, err := h.migrationService.ListMigrations(page, pageSize)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "查询失败: "+err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"list":     migrations,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *MigrationHandler) StartDualSend(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	if err := h.migrationService.StartDualSend(migrationID, req.Operator); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "DUAL_SEND"})
}

func (h *MigrationHandler) StartReconciliation(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	if err := h.migrationService.StartReconciliation(migrationID, req.Operator); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "RECONCILING"})
}

func (h *MigrationHandler) ReconcileEvents(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	if err := h.migrationService.ReconcileEvents(migrationID); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "对账完成"})
}

func (h *MigrationHandler) ConfirmSwitch(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	var req struct {
		Operator string `json:"operator"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	if err := h.migrationService.ConfirmSwitch(migrationID, req.Operator); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "SWITCHED"})
}

func (h *MigrationHandler) Rollback(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	var req struct {
		Operator string `json:"operator"`
		Reason   string `json:"reason"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	if err := h.migrationService.Rollback(migrationID, req.Operator, req.Reason); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"status": "ROLLED_BACK"})
}

func (h *MigrationHandler) ManualFix(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	var req struct {
		Operator string                 `json:"operator"`
		Updates  map[string]interface{} `json:"updates"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	if err := h.migrationService.ManualFix(migrationID, req.Operator, req.Updates); err != nil {
		respondError(w, http.StatusBadRequest, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]string{"message": "修正完成"})
}

func (h *MigrationHandler) GetTransitions(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	transitions, err := h.migrationService.GetTransitions(migrationID)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, transitions)
}

func (h *MigrationHandler) RecordEvent(w http.ResponseWriter, r *http.Request) {
	var req service.RecordEventRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		respondError(w, http.StatusBadRequest, "无效的请求参数")
		return
	}

	event, err := h.eventService.RecordEvent(&req)
	if err != nil {
		respondError(w, http.StatusInternalServerError, "记录事件失败: "+err.Error())
		return
	}

	respondJSON(w, http.StatusCreated, event)
}

func (h *MigrationHandler) GetEvents(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 10
	}

	events, total, err := h.eventService.GetEvents(migrationID, page, pageSize)
	if err != nil {
		respondError(w, http.StatusInternalServerError, err.Error())
		return
	}

	respondJSON(w, http.StatusOK, map[string]interface{}{
		"list":     events,
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
	})
}

func (h *MigrationHandler) ExportMigration(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	migrationID := vars["id"]

	filename := "migration_" + migrationID + ".csv"
	if err := h.migrationService.ExportToCSV(migrationID, filename); err != nil {
		respondError(w, http.StatusInternalServerError, "导出失败: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	http.ServeFile(w, r, filename)
}

func (h *MigrationHandler) ExportAll(w http.ResponseWriter, r *http.Request) {
	filename := "all_migrations.csv"
	if err := h.migrationService.ExportAllToCSV(filename); err != nil {
		respondError(w, http.StatusInternalServerError, "导出失败: "+err.Error())
		return
	}

	w.Header().Set("Content-Type", "text/csv")
	w.Header().Set("Content-Disposition", "attachment; filename="+filename)
	http.ServeFile(w, r, filename)
}
