package dao

import (
	"time"

	"github.com/google/uuid"
	"print-proof-api/internal/database"
	"print-proof-api/internal/model"
)

func CreateConfirmation(conf *model.Confirmation) error {
	conf.ID = uuid.New().String()
	conf.ConfirmedAt = time.Now()

	query := `INSERT INTO confirmations (id, proof_version_id, confirmer, confirm_type, result, comments, confirmed_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?)`

	_, err := database.DB.Exec(query, conf.ID, conf.ProofVersionID, conf.Confirmer,
		conf.ConfirmType, conf.Result, conf.Comments, conf.ConfirmedAt)
	return err
}

func GetConfirmationsByVersion(versionID string) ([]*model.Confirmation, error) {
	query := `SELECT id, proof_version_id, confirmer, confirm_type, result, comments, confirmed_at
	          FROM confirmations WHERE proof_version_id = ? ORDER BY confirmed_at DESC`

	rows, err := database.DB.Query(query, versionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var confs []*model.Confirmation
	for rows.Next() {
		var c model.Confirmation
		err := rows.Scan(&c.ID, &c.ProofVersionID, &c.Confirmer, &c.ConfirmType,
			&c.Result, &c.Comments, &c.ConfirmedAt)
		if err != nil {
			return nil, err
		}
		confs = append(confs, &c)
	}
	return confs, nil
}

func HasApprovedConfirmation(versionID, confirmType string) (bool, error) {
	query := `SELECT COUNT(*) FROM confirmations WHERE proof_version_id = ? AND confirm_type = ? AND result = ?`
	var count int
	err := database.DB.QueryRow(query, versionID, confirmType, model.ConfirmResultApprove).Scan(&count)
	return count > 0, err
}
