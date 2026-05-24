package handlers

import (
	"encoding/json"
	"museum-exhibit-condition-api/database"
	"museum-exhibit-condition-api/models"
	"museum-exhibit-condition-api/services"
	"net/http"
	"strconv"
	"strings"
	"time"
)

type Handler struct {
	versionSvc   *services.VersionService
	liabilitySvc *services.LiabilityService
	reportSvc    *services.ReportService
}

func NewHandler() *Handler {
	return &Handler{
		versionSvc:   services.NewVersionService(),
		liabilitySvc: services.NewLiabilityService(),
		reportSvc:    services.NewReportService(),
	}
}

func (h *Handler) getOperator(r *http.Request) string {
	op := r.Header.Get("X-Operator")
	if op == "" {
		op = "system"
	}
	return op
}

func (h *Handler) Health(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
}

func (h *Handler) RecordsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == "POST" {
		h.ImportRecord(w, r)
	} else if r.Method == "GET" {
		h.ListRecords(w, r)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) RecordDetailHandler(w http.ResponseWriter, r *http.Request) {
	path := strings.TrimPrefix(r.URL.Path, "/api/records/")
	idStr := path
	if strings.Contains(path, "/") {
		idStr = strings.Split(path, "/")[0]
	}
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		http.Error(w, "Invalid ID", http.StatusBadRequest)
		return
	}
	if r.Method == "GET" {
		h.GetRecord(w, r, id)
	} else {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (h *Handler) ListRecords(w http.ResponseWriter, r *http.Request) {
	limit := 20
	offset := 0
	if l := r.URL.Query().Get("limit"); l != "" {
		limit, _ = strconv.Atoi(l)
	}
	if o := r.URL.Query().Get("offset"); o != "" {
		offset, _ = strconv.Atoi(o)
	}
	rows, err := database.DB.Query("SELECT id, exhibit_no, contract_no, current_version, liability_status, final_conclusion, created_at, updated_at, created_by, updated_by, idempotent_key FROM exhibit_records ORDER BY created_at DESC LIMIT ? OFFSET ?", limit, offset)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()
	var records []models.ExhibitRecord
	for rows.Next() {
		var r models.ExhibitRecord
		rows.Scan(&r.ID, &r.ExhibitNo, &r.ContractNo, &r.CurrentVersion, &r.LiabilityStatus, &r.FinalConclusion, &r.CreatedAt, &r.UpdatedAt, &r.CreatedBy, &r.UpdatedBy, &r.IdempotentKey)
		records = append(records, r)
	}
	var total int
	database.DB.QueryRow("SELECT COUNT(*) FROM exhibit_records").Scan(&total)
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"data": records, "total": total, "limit": limit, "offset": offset})
}

func (h *Handler) GetRecord(w http.ResponseWriter, r *http.Request, id int64) {
	record, err := h.versionSvc.GetRecordByID(id)
	if err != nil {
		http.Error(w, "Record not found", http.StatusNotFound)
		return
	}
	versionRows, _ := database.DB.Query("SELECT id, record_id, version, check_point, check_time, condition_desc, has_scratch, scratch_location, scratch_size, insurance_remark, handler, transport_node, created_at, prev_version_id, change_summary FROM condition_versions WHERE record_id = ? ORDER BY version DESC", id)
	var versions []models.ConditionVersion
	for versionRows.Next() {
		var v models.ConditionVersion
		versionRows.Scan(&v.ID, &v.RecordID, &v.Version, &v.CheckPoint, &v.CheckTime, &v.ConditionDesc, &v.HasScratch, &v.ScratchLocation, &v.ScratchSize, &v.InsuranceRemark, &v.Handler, &v.TransportNode, &v.CreatedAt, &v.PrevVersionID, &v.ChangeSummary)
		versions = append(versions, v)
	}
	versionRows.Close()
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"record": record, "versions": versions})
}


func (h *Handler) ImportRecord(w http.ResponseWriter, r *http.Request) {
	var req struct {
		ExhibitNo       string    `json:"exhibit_no"`
		ContractNo      string    `json:"contract_no"`
		CheckPoint      string    `json:"check_point"`
		CheckTime       time.Time `json:"check_time"`
		ConditionDesc   string    `json:"condition_desc"`
		HasScratch      bool      `json:"has_scratch"`
		ScratchLocation string    `json:"scratch_location"`
		ScratchSize     string    `json:"scratch_size"`
		InsuranceRemark string    `json:"insurance_remark"`
		TransportNode   string    `json:"transport_node"`
		IdempotentKey   string    `json:"idempotent_key"`
	}
	json.NewDecoder(r.Body).Decode(&req)
	operator := h.getOperator(r)
	if req.IdempotentKey != "" {
		existing, exists, _ := h.versionSvc.CheckIdempotent(req.IdempotentKey)
		if exists {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusOK)
			json.NewEncoder(w).Encode(map[string]interface{}{"m": "idempotent", "r": existing})
			return
		}
	}
	svcReq := &services.ImportRequest{
		ExhibitNo:       req.ExhibitNo,
		ContractNo:      req.ContractNo,
		CheckPoint:      req.CheckPoint,
		CheckTime:       req.CheckTime,
		ConditionDesc:   req.ConditionDesc,
		ScratchLocation: req.ScratchLocation,
		ScratchSize:     req.ScratchSize,
		InsuranceRemark: req.InsuranceRemark,
		TransportNode:   req.TransportNode,
		IdempotentKey:   req.IdempotentKey,
	}
	record, err := h.versionSvc.CreateRecord(svcReq, operator)
	if err != nil {
		http.Error(w, err.Error(), 500)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{"m": "imported", "r": record})
}
