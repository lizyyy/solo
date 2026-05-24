package dao

import (
	"time"

	"github.com/google/uuid"
	"print-proof-api/internal/database"
	"print-proof-api/internal/model"
)

func CreateChangeLog(log *model.ChangeLog) error {
	log.ID = uuid.New().String()
	log.ChangedAt = time.Now()

	query := `INSERT INTO change_logs (id, proof_version_id, field_name, old_value, new_value, changed_by, change_type, changed_at)
	          VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	_, err := database.DB.Exec(query, log.ID, log.ProofVersionID, log.FieldName,
		log.OldValue, log.NewValue, log.ChangedBy, log.ChangeType, log.ChangedAt)
	return err
}

func GetChangeLogsByVersion(versionID string) ([]*model.ChangeLog, error) {
	query := `SELECT id, proof_version_id, field_name, old_value, new_value, changed_by, change_type, changed_at
	          FROM change_logs WHERE proof_version_id = ? ORDER BY changed_at DESC`

	rows, err := database.DB.Query(query, versionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []*model.ChangeLog
	for rows.Next() {
		var l model.ChangeLog
		err := rows.Scan(&l.ID, &l.ProofVersionID, &l.FieldName, &l.OldValue,
			&l.NewValue, &l.ChangedBy, &l.ChangeType, &l.ChangedAt)
		if err != nil {
			return nil, err
		}
		logs = append(logs, &l)
	}
	return logs, nil
}
