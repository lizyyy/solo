#!/usr/bin/env python3
import os

os.makedirs('services', exist_ok=True)
os.makedirs('handlers', exist_ok=True)

# 1. services/state_machine.go
with open('services/state_machine.go', 'w') as f:
    f.write('''package services

import (
	"errors"
	"museum-exhibit-condition-api/models"
)

type StateMachine struct{}

func NewStateMachine() *StateMachine {
	return &StateMachine{}
}

var validTransitions = map[models.LiabilityStatus][]models.LiabilityStatus{
	models.StatusPending:    {models.StatusImported, models.StatusRevoked},
	models.StatusImported:   {models.StatusValidated, models.StatusRejected, models.StatusRevoked},
	models.StatusValidated:  {models.StatusProcessing, models.StatusDisputed, models.StatusRevoked},
	models.StatusProcessing: {models.StatusConfirmed, models.StatusDisputed, models.StatusRevoked},
	models.StatusDisputed:   {models.StatusProcessing, models.StatusConfirmed, models.StatusRejected, models.StatusRevoked},
	models.StatusConfirmed:  {models.StatusClosed, models.StatusDisputed, models.StatusRevoked},
	models.StatusRejected:   {models.StatusProcessing, models.StatusRevoked},
	models.StatusClosed:     {models.StatusRevoked},
	models.StatusRevoked:    {models.StatusPending},
}

func (sm *StateMachine) CanTransition(from, to models.LiabilityStatus) bool {
	validTos, ok := validTransitions[from]
	if !ok {
		return false
	}
	for _, valid := range validTos {
		if valid == to {
			return true
		}
	}
	return false
}

func (sm *StateMachine) ValidateTransition(from, to models.LiabilityStatus) error {
	if !sm.CanTransition(from, to) {
		return errors.New("invalid state transition from " + string(from) + " to " + string(to))
	}
	return nil
}
''')
print("Created: services/state_machine.go")

# 2. services/version_service.go
with open('services/version_service.go', 'w') as f:
    f.write('''package services

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"fmt"
	"museum-exhibit-condition-api/database"
	"museum-exhibit-condition-api/models"
	"time"
)

type ImportRequest struct {
	ExhibitNo       string
	ContractNo      string
	CheckPoint      string
	CheckTime       time.Time
	ConditionDesc   string
	HasScratch      bool
	ScratchLocation string
	ScratchSize     string
	InsuranceRemark string
	TransportNode   string
	IdempotentKey   string
}

type VersionService struct {
	sm *StateMachine
}

func NewVersionService() *VersionService {
	return &VersionService{sm: NewStateMachine()}
}

func (s *VersionService) GenerateIdempotentKey(exhibitNo, contractNo string) string {
	data := fmt.Sprintf("%s:%s:%d", exhibitNo, contractNo, time.Now().UnixNano())
	hash := sha256.Sum256([]byte(data))
	return hex.EncodeToString(hash[:])
}

func (s *VersionService) CheckIdempotent(key string) (*models.ExhibitRecord, bool, error) {
	var record models.ExhibitRecord
	query := `SELECT id, exhibit_no, contract_no, current_version, liability_status, final_conclusion, created_at, updated_at, created_by, updated_by, idempotent_key FROM exhibit_records WHERE idempotent_key = ?`
	err := database.DB.QueryRow(query, key).Scan(&record.ID, &record.ExhibitNo, &record.ContractNo, &record.CurrentVersion, &record.LiabilityStatus, &record.FinalConclusion, &record.CreatedAt, &record.UpdatedAt, &record.CreatedBy, &record.UpdatedBy, &record.IdempotentKey)
	if err == sql.ErrNoRows {
		return nil, false, nil
	}
	if err != nil {
		return nil, false, err
	}
	return &record, true, nil
}

func (s *VersionService) CreateRecord(req *ImportRequest, operator string) (*models.ExhibitRecord, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	idempotentKey := req.IdempotentKey
	if idempotentKey == "" {
		idempotentKey = s.GenerateIdempotentKey(req.ExhibitNo, req.ContractNo)
	}
	result, err := tx.Exec(`INSERT INTO exhibit_records (exhibit_no, contract_no, liability_status, created_by, updated_by, idempotent_key) VALUES (?, ?, ?, ?, ?, ?)`, req.ExhibitNo, req.ContractNo, models.StatusImported, operator, operator, idempotentKey)
	if err != nil {
		return nil, err
	}
	recordID, _ := result.LastInsertId()
	_, err = tx.Exec(`INSERT INTO condition_versions (record_id, version, check_point, check_time, condition_desc, has_scratch, scratch_location, scratch_size, insurance_remark, handler, transport_node, change_summary) VALUES (?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, recordID, req.CheckPoint, req.CheckTime, req.ConditionDesc, req.HasScratch, req.ScratchLocation, req.ScratchSize, req.InsuranceRemark, operator, req.TransportNode, "Initial version")
	if err != nil {
		return nil, err
	}
	tx.Exec(`INSERT INTO operation_logs (record_id, operation, operator, before_state, after_state, remark) VALUES (?, ?, ?, ?, ?, ?)`, recordID, "import", operator, "", string(models.StatusImported), "Initial import")
	tx.Commit()
	return s.GetRecordByID(recordID)
}

func (s *VersionService) GetRecordByID(id int64) (*models.ExhibitRecord, error) {
	var record models.ExhibitRecord
	query := `SELECT id, exhibit_no, contract_no, current_version, liability_status, final_conclusion, created_at, updated_at, created_by, updated_by, idempotent_key FROM exhibit_records WHERE id = ?`
	err := database.DB.QueryRow(query, id).Scan(&record.ID, &record.ExhibitNo, &record.ContractNo, &record.CurrentVersion, &record.LiabilityStatus, &record.FinalConclusion, &record.CreatedAt, &record.UpdatedAt, &record.CreatedBy, &record.UpdatedBy, &record.IdempotentKey)
	if err != nil {
		return nil, err
	}
	return &record, nil
}

func (s *VersionService) TransitionState(id int64, newStatus models.LiabilityStatus, operator, remark string) (*models.ExhibitRecord, error) {
	record, err := s.GetRecordByID(id)
	if err != nil {
		return nil, err
	}
	if err := s.sm.ValidateTransition(record.LiabilityStatus, newStatus); err != nil {
		return nil, err
	}
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	_, err = tx.Exec(`UPDATE exhibit_records SET liability_status = ?, updated_by = ?, updated_at = ? WHERE id = ?`, newStatus, operator, time.Now(), id)
	if err != nil {
		return nil, err
	}
	_, err = tx.Exec(`INSERT INTO operation_logs (record_id, operation, operator, before_state, after_state, remark) VALUES (?, ?, ?, ?, ?, ?)`, id, "state_change", operator, string(record.LiabilityStatus), string(newStatus), remark)
	if err != nil {
		return nil, err
	}
	tx.Commit()
	return s.GetRecordByID(id)
}
''')
print("Created: services/version_service.go")

# 3. services/liability_service.go
with open('services/liability_service.go', 'w') as f:
    f.write('''package services

import (
	"museum-exhibit-condition-api/database"
	"museum-exhibit-condition-api/models"
	"time"
)

type LiabilityService struct {
	versionSvc *VersionService
}

func NewLiabilityService() *LiabilityService {
	return &LiabilityService{versionSvc: NewVersionService()}
}

func (s *LiabilityService) ConfirmLiability(recordID, versionID int64, liableParty, liableReason string, confidence float64, operator string) (*models.ExhibitRecord, error) {
	tx, err := database.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	_, err = tx.Exec(`INSERT INTO liability_conclusions (record_id, version_id, liable_party, liable_reason, confidence_level, status) VALUES (?, ?, ?, ?, ?, ?)`, recordID, versionID, liableParty, liableReason, confidence, models.StatusConfirmed)
	if err != nil {
		return nil, err
	}
	tx.Commit()
	return s.versionSvc.TransitionState(recordID, models.StatusConfirmed, operator, "Liability confirmed: "+liableParty)
}

func (s *LiabilityService) ReviewConclusion(conclusionID int64, approved bool, comment, reviewer string) error {
	tx, err := database.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()
	status := models.StatusConfirmed
	if !approved {
		status = models.StatusDisputed
	}
	_, err = tx.Exec(`UPDATE liability_conclusions SET status = ?, reviewer = ?, review_time = ?, review_comment = ? WHERE id = ?`, status, reviewer, time.Now(), comment, conclusionID)
	if err != nil {
		return err
	}
	var recordID int64
	database.DB.QueryRow(`SELECT record_id FROM liability_conclusions WHERE id = ?`, conclusionID).Scan(&recordID)
	tx.Exec(`UPDATE exhibit_records SET liability_status = ?, updated_by = ?, updated_at = ? WHERE id = ?`, status, reviewer, time.Now(), recordID)
	tx.Exec(`INSERT INTO operation_logs (record_id, operation, operator, before_state, after_state, remark) VALUES (?, ?, ?, ?, ?, ?)`, recordID, "review", reviewer, "", string(status), comment)
	tx.Commit()
	return nil
}
''')
print("Created: services/liability_service.go")

# 4. services/report_service.go
with open('services/report_service.go', 'w') as f:
    f.write('''package services

import (
	"encoding/json"
	"fmt"
	"museum-exhibit-condition-api/database"
	"museum-exhibit-condition-api/models"
	"net/http"
)

type ReportService struct{}

func NewReportService() *ReportService {
	return &ReportService{}
}

func (s *ReportService) ExportJSON(w http.ResponseWriter, recordID int64) {
	var record models.ExhibitRecord
	database.DB.QueryRow(`SELECT id, exhibit_no, contract_no, current_version, liability_status, final_conclusion, created_at, updated_at, created_by, updated_by, idempotent_key FROM exhibit_records WHERE id = ?`, recordID).Scan(&record.ID, &record.ExhibitNo, &record.ContractNo, &record.CurrentVersion, &record.LiabilityStatus, &record.FinalConclusion, &record.CreatedAt, &record.UpdatedAt, &record.CreatedBy, &record.UpdatedBy, &record.IdempotentKey)
	versionRows, _ := database.DB.Query(`SELECT id, record_id, version, check_point, check_time, condition_desc, has_scratch, scratch_location, scratch_size, insurance_remark, handler, transport_node, created_at, prev_version_id, change_summary FROM condition_versions WHERE record_id = ? ORDER BY version DESC`, recordID)
	var versions []models.ConditionVersion
	for versionRows.Next() {
		var v models.ConditionVersion
		versionRows.Scan(&v.ID, &v.RecordID, &v.Version, &v.CheckPoint, &v.CheckTime, &v.ConditionDesc, &v.HasScratch, &v.ScratchLocation, &v.ScratchSize, &v.InsuranceRemark, &v.Handler, &v.TransportNode, &v.CreatedAt, &v.PrevVersionID, &v.ChangeSummary)
		versions = append(versions, v)
	}
	versionRows.Close()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=report.json")
	json.NewEncoder(w).Encode(map[string]interface{}{"record": record, "versions": versions})
}

func (s *ReportService) ExportCSV(w http.ResponseWriter, recordID int64) {
	var record models.ExhibitRecord
	database.DB.QueryRow(`SELECT id, exhibit_no, contract_no, current_version, liability_status, final_conclusion, created_at, updated_at, created_by FROM exhibit_records WHERE id = ?`, recordID).Scan(&record.ID, &record.ExhibitNo, &record.ContractNo, &record.CurrentVersion, &record.LiabilityStatus, &record.FinalConclusion, &record.CreatedAt, &record.UpdatedAt, &record.CreatedBy)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=report.csv")
	fmt.Fprintf(w, "Museum Exhibit Condition Report\\n")
	fmt.Fprintf(w, "Generated,%s\\n", record.UpdatedAt.Format("2006-01-02 15:04:05"))
	fmt.Fprintf(w, "\\n【Basic Info】\\n")
	fmt.Fprintf(w, "Exhibit No,%s\\n", record.ExhibitNo)
	fmt.Fprintf(w, "Contract No,%s\\n", record.ContractNo)
	fmt.Fprintf(w, "Status,%s\\n", record.LiabilityStatus)
	fmt.Fprintf(w, "Conclusion,%s\\n", record.FinalConclusion)
	fmt.Fprintf(w, "\\n【Versions】\\n")
	fmt.Fprintf(w, "Version,CheckPoint,CheckTime,HasScratch,Handler\\n")
	versionRows, _ := database.DB.Query(`SELECT version, check_point, check_time, has_scratch, handler FROM condition_versions WHERE record_id = ? ORDER BY version`, recordID)
	for versionRows.Next() {
		var v models.ConditionVersion
		versionRows.Scan(&v.Version, &v.CheckPoint, &v.CheckTime, &v.HasScratch, &v.Handler)
		fmt.Fprintf(w, "%d,%s,%s,%v,%s\\n", v.Version, v.CheckPoint, v.CheckTime.Format("2006-01-02 15:04:05"), v.HasScratch, v.Handler)
	}
	versionRows.Close()
}

func (s *ReportService) GetStatistics() (map[string]interface{}, error) {
	rows, _ := database.DB.Query(`SELECT liability_status, COUNT(*) FROM exhibit_records GROUP BY liability_status`)
	stats := make(map[string]int)
	var total int
	for rows.Next() {
		var status string
		var count int
		rows.Scan(&status, &count)
		stats[status] = count
		total += count
	}
	rows.Close()
	return map[string]interface{}{"total": total, "by_status": stats}, nil
}
''')
print("Created: services/report_service.go")

print("All services created!")
