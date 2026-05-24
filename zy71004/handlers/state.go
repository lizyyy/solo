package handlers

import (
	"encoding/json"
	"museum-exhibit-condition-api/database"
	"museum-exhibit-condition-api/models"
	"net/http"
	"strconv"
	"time"
)

func (h *Handler) ValidateHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	operator := h.getOperator(r)
	record, err := h.versionSvc.TransitionState(id, models.StatusValidated, operator, "validated")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "validated", "r": record})
}

func (h *Handler) ProcessHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	operator := h.getOperator(r)
	record, err := h.versionSvc.TransitionState(id, models.StatusProcessing, operator, "processing")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "processing", "r": record})
}

func (h *Handler) DisputeHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	operator := h.getOperator(r)
	record, err := h.versionSvc.TransitionState(id, models.StatusDisputed, operator, "disputed")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "disputed", "r": record})
}

func (h *Handler) RejectHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	operator := h.getOperator(r)
	record, err := h.versionSvc.TransitionState(id, models.StatusRejected, operator, "rejected")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "rejected", "r": record})
}

func (h *Handler) CloseHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	operator := h.getOperator(r)
	record, err := h.versionSvc.TransitionState(id, models.StatusClosed, operator, "closed")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "closed", "r": record})
}

func (h *Handler) RevokeHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	operator := h.getOperator(r)
	record, err := h.versionSvc.TransitionState(id, models.StatusRevoked, operator, "revoked")
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "revoked", "r": record})
}

func (h *Handler) VersionsHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	operator := h.getOperator(r)
	var req struct {
		CheckPoint      string    `json:"check_point"`
		CheckTime       time.Time `json:"check_time"`
		ConditionDesc   string    `json:"condition_desc"`
		HasScratch      bool      `json:"has_scratch"`
		ScratchLocation string    `json:"scratch_location"`
		ScratchSize     string    `json:"scratch_size"`
		InsuranceRemark string    `json:"insurance_remark"`
		TransportNode   string    `json:"transport_node"`
		ChangeSummary   string    `json:"change_summary"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	versionID, version, err := h.versionSvc.CreateNewVersion(id, req.CheckPoint, req.CheckTime, req.ConditionDesc, req.HasScratch, req.ScratchLocation, req.ScratchSize, req.InsuranceRemark, req.TransportNode, req.ChangeSummary, operator)
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "version created", "version_id": versionID, "version": version})
}

func (h *Handler) DiffsHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	rows, _ := database.DB.Query("SELECT id, record_id, old_version_id, new_version_id, field_name, old_value, new_value, diff_type, changed_by, created_at FROM version_diffs WHERE record_id = ? ORDER BY created_at DESC", id)
	var diffs []map[string]interface{}
	for rows.Next() {
		var d struct {
			ID           int64
			RecordID     int64
			OldVersionID int64
			NewVersionID int64
			FieldName    string
			OldValue     string
			NewValue     string
			DiffType     string
			ChangedBy    string
			CreatedAt    time.Time
		}
		rows.Scan(&d.ID, &d.RecordID, &d.OldVersionID, &d.NewVersionID, &d.FieldName, &d.OldValue, &d.NewValue, &d.DiffType, &d.ChangedBy, &d.CreatedAt)
		diffs = append(diffs, map[string]interface{}{"id": d.ID, "field": d.FieldName, "old": d.OldValue, "new": d.NewValue, "type": d.DiffType, "by": d.ChangedBy})
	}
	rows.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"diffs": diffs})
}

func (h *Handler) LogsHandler(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.ParseInt(r.PathValue("id"), 10, 64)
	rows, _ := database.DB.Query("SELECT id, record_id, operation, operator, before_state, after_state, remark, created_at FROM operation_logs WHERE record_id = ? ORDER BY created_at DESC", id)
	var logs []map[string]interface{}
	for rows.Next() {
		var l struct {
			ID          int64
			RecordID    int64
			Operation   string
			Operator    string
			BeforeState string
			AfterState  string
			Remark      string
			CreatedAt   time.Time
		}
		rows.Scan(&l.ID, &l.RecordID, &l.Operation, &l.Operator, &l.BeforeState, &l.AfterState, &l.Remark, &l.CreatedAt)
		logs = append(logs, map[string]interface{}{"op": l.Operation, "by": l.Operator, "before": l.BeforeState, "after": l.AfterState, "remark": l.Remark, "at": l.CreatedAt})
	}
	rows.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"logs": logs})
}
