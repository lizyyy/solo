package dao

import (
	"database/sql"
	"time"

	"github.com/google/uuid"
	"print-proof-api/internal/database"
	"print-proof-api/internal/model"
)

func CreateProofVersion(version *model.ProofVersion) error {
	version.ID = uuid.New().String()
	version.Status = model.VersionStatusDraft
	version.IsColorApproved = false
	version.IsPaperApproved = false
	version.IsFinalVersion = false
	version.CreatedAt = time.Now()
	version.UpdatedAt = time.Now()

	query := `INSERT INTO proof_versions (id, order_id, version_no, paper_id, status,
	          is_color_approved, is_paper_approved, is_final_version, notes, created_by, created_at, updated_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := database.DB.Exec(query, version.ID, version.OrderID, version.VersionNo, version.PaperID,
		version.Status, version.IsColorApproved, version.IsPaperApproved, version.IsFinalVersion,
		version.Notes, version.CreatedBy, version.CreatedAt, version.UpdatedAt)
	return err
}

func GetProofVersionByID(id string) (*model.ProofVersion, error) {
	query := `SELECT id, order_id, version_no, paper_id, status, is_color_approved,
	          is_paper_approved, is_final_version, notes, created_by, created_at, updated_at
	          FROM proof_versions WHERE id = ?`

	var v model.ProofVersion
	err := database.DB.QueryRow(query, id).Scan(&v.ID, &v.OrderID, &v.VersionNo, &v.PaperID,
		&v.Status, &v.IsColorApproved, &v.IsPaperApproved, &v.IsFinalVersion, &v.Notes,
		&v.CreatedBy, &v.CreatedAt, &v.UpdatedAt)
	if err == sql.ErrNoRows {
		return nil, nil
	}
	return &v, err
}

func GetMaxVersionNo(orderID string) (int, error) {
	query := `SELECT COALESCE(MAX(version_no), 0) FROM proof_versions WHERE order_id = ?`

	var maxNo int
	err := database.DB.QueryRow(query, orderID).Scan(&maxNo)
	return maxNo, err
}

func GetProofVersionsByOrder(orderID string) ([]*model.ProofVersion, error) {
	query := `SELECT id, order_id, version_no, paper_id, status, is_color_approved,
	          is_paper_approved, is_final_version, notes, created_by, created_at, updated_at
	          FROM proof_versions WHERE order_id = ? ORDER BY version_no DESC`

	rows, err := database.DB.Query(query, orderID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var versions []*model.ProofVersion
	for rows.Next() {
		var v model.ProofVersion
		err := rows.Scan(&v.ID, &v.OrderID, &v.VersionNo, &v.PaperID, &v.Status,
			&v.IsColorApproved, &v.IsPaperApproved, &v.IsFinalVersion, &v.Notes,
			&v.CreatedBy, &v.CreatedAt, &v.UpdatedAt)
		if err != nil {
			return nil, err
		}
		versions = append(versions, &v)
	}
	return versions, nil
}

func UpdateProofVersionStatus(id, status string) error {
	query := `UPDATE proof_versions SET status = ?, updated_at = ? WHERE id = ?`
	_, err := database.DB.Exec(query, status, time.Now(), id)
	return err
}

func UpdateProofVersion(version *model.ProofVersion) error {
	version.UpdatedAt = time.Now()
	query := `UPDATE proof_versions SET paper_id = ?, status = ?, is_color_approved = ?,
	          is_paper_approved = ?, is_final_version = ?, notes = ?, updated_at = ?
	          WHERE id = ?`

	_, err := database.DB.Exec(query, version.PaperID, version.Status, version.IsColorApproved,
		version.IsPaperApproved, version.IsFinalVersion, version.Notes, version.UpdatedAt, version.ID)
	return err
}

func SetFinalVersion(id string) error {
	query := `UPDATE proof_versions SET is_final_version = 1, status = ?, updated_at = ? WHERE id = ?`
	_, err := database.DB.Exec(query, model.VersionStatusFinalized, time.Now(), id)
	return err
}

func HasFinalVersion(orderID string) (bool, error) {
	query := `SELECT COUNT(*) FROM proof_versions WHERE order_id = ? AND is_final_version = 1`
	var count int
	err := database.DB.QueryRow(query, orderID).Scan(&count)
	return count > 0, err
}
