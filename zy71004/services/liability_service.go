package services

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
