package services

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

func (s *VersionService) CreateNewVersion(recordID int64, checkPoint string, checkTime time.Time, conditionDesc string, hasScratch bool, scratchLocation, scratchSize, insuranceRemark, transportNode, changeSummary, operator string) (int64, int, error) {
	var currentVersion int
	var prevVersionID int64
	database.DB.QueryRow(`SELECT current_version FROM exhibit_records WHERE id = ?`, recordID).Scan(&currentVersion)
	database.DB.QueryRow(`SELECT id FROM condition_versions WHERE record_id = ? AND version = ?`, recordID, currentVersion).Scan(&prevVersionID)
	newVersion := currentVersion + 1
	tx, err := database.DB.Begin()
	if err != nil {
		return 0, 0, err
	}
	defer tx.Rollback()
	result, err := tx.Exec(`INSERT INTO condition_versions (record_id, version, check_point, check_time, condition_desc, has_scratch, scratch_location, scratch_size, insurance_remark, handler, transport_node, prev_version_id, change_summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, recordID, newVersion, checkPoint, checkTime, conditionDesc, hasScratch, scratchLocation, scratchSize, insuranceRemark, operator, transportNode, prevVersionID, changeSummary)
	if err != nil {
		return 0, 0, err
	}
	newVersionID, _ := result.LastInsertId()
	tx.Exec(`UPDATE exhibit_records SET current_version = ?, updated_by = ?, updated_at = ? WHERE id = ?`, newVersion, operator, time.Now(), recordID)
	tx.Exec(`INSERT INTO version_diffs (record_id, old_version_id, new_version_id, field_name, old_value, new_value, diff_type, changed_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, recordID, prevVersionID, newVersionID, "version", fmt.Sprint(currentVersion), fmt.Sprint(newVersion), "version", operator)
	tx.Exec(`INSERT INTO operation_logs (record_id, operation, operator, before_state, after_state, remark) VALUES (?, ?, ?, ?, ?, ?)`, recordID, "new_version", operator, fmt.Sprintf("v%d", currentVersion), fmt.Sprintf("v%d", newVersion), changeSummary)
	tx.Commit()
	return newVersionID, newVersion, nil
}
