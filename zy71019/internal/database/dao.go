package database

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"damage-arbitration/internal/models"
)

func CreateArbitration(a *models.Arbitration) (int64, error) {
	result, err := DB.Exec(`
		INSERT INTO arbitrations (order_id, vehicle_id, user_id, status, pickup_time, return_time, handler_id, handler_name)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, a.OrderID, a.VehicleID, a.UserID, a.Status, a.PickupTime, a.ReturnTime, a.HandlerID, a.HandlerName)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	a.ID = id
	return id, nil
}

func GetArbitrationByID(id int64) (*models.Arbitration, error) {
	var a models.Arbitration
	err := DB.QueryRow(`
		SELECT id, order_id, vehicle_id, user_id, status, pickup_time, return_time, handler_id, handler_name, created_at, updated_at
		FROM arbitrations WHERE id = ?
	`, id).Scan(&a.ID, &a.OrderID, &a.VehicleID, &a.UserID, &a.Status, &a.PickupTime, &a.ReturnTime, &a.HandlerID, &a.HandlerName, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func GetArbitrationByOrderID(orderID string) (*models.Arbitration, error) {
	var a models.Arbitration
	err := DB.QueryRow(`
		SELECT id, order_id, vehicle_id, user_id, status, pickup_time, return_time, handler_id, handler_name, created_at, updated_at
		FROM arbitrations WHERE order_id = ?
	`, orderID).Scan(&a.ID, &a.OrderID, &a.VehicleID, &a.UserID, &a.Status, &a.PickupTime, &a.ReturnTime, &a.HandlerID, &a.HandlerName, &a.CreatedAt, &a.UpdatedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &a, nil
}

func UpdateArbitrationStatus(id int64, status models.ArbitrationStatus, handlerID, handlerName string) error {
	_, err := DB.Exec(`
		UPDATE arbitrations SET status = ?, handler_id = ?, handler_name = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, status, handlerID, handlerName, id)
	return err
}

func CreateDamageDetail(d *models.DamageDetail) (int64, error) {
	result, err := DB.Exec(`
		INSERT INTO damage_details (arbitration_id, damage_type, location, severity, description, is_new, deduct_amount, fee_charged, matched_damage_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
	`, d.ArbitrationID, d.DamageType, d.Location, d.Severity, d.Description, d.IsNew, d.DeductAmount, d.FeeCharged, d.MatchedDamageID)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	d.ID = id
	return id, nil
}

func GetDamagesByArbitrationID(arbitrationID int64) ([]models.DamageDetail, error) {
	rows, err := DB.Query(`
		SELECT id, arbitration_id, damage_type, location, severity, description, is_new, deduct_amount, fee_charged, matched_damage_id, created_at, updated_at
		FROM damage_details WHERE arbitration_id = ?
	`, arbitrationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var damages []models.DamageDetail
	for rows.Next() {
		var d models.DamageDetail
		err := rows.Scan(&d.ID, &d.ArbitrationID, &d.DamageType, &d.Location, &d.Severity, &d.Description, &d.IsNew, &d.DeductAmount, &d.FeeCharged, &d.MatchedDamageID, &d.CreatedAt, &d.UpdatedAt)
		if err != nil {
			return nil, err
		}
		damages = append(damages, d)
	}
	return damages, nil
}

func CreatePhoto(p *models.Photo) (int64, error) {
	result, err := DB.Exec(`
		INSERT INTO photos (arbitration_id, photo_type, photo_url, photo_time, damage_id, remark)
		VALUES (?, ?, ?, ?, ?, ?)
	`, p.ArbitrationID, p.PhotoType, p.PhotoURL, p.PhotoTime, p.DamageID, p.Remark)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	p.ID = id
	return id, nil
}

func GetPhotosByArbitrationID(arbitrationID int64) ([]models.Photo, error) {
	rows, err := DB.Query(`
		SELECT id, arbitration_id, photo_type, photo_url, photo_time, damage_id, remark, created_at
		FROM photos WHERE arbitration_id = ? ORDER BY photo_time
	`, arbitrationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var photos []models.Photo
	for rows.Next() {
		var p models.Photo
		err := rows.Scan(&p.ID, &p.ArbitrationID, &p.PhotoType, &p.PhotoURL, &p.PhotoTime, &p.DamageID, &p.Remark, &p.CreatedAt)
		if err != nil {
			return nil, err
		}
		photos = append(photos, p)
	}
	return photos, nil
}

func CreateAppeal(a *models.Appeal) (int64, error) {
	evidenceJSON, _ := json.Marshal(a.EvidenceURLs)
	result, err := DB.Exec(`
		INSERT INTO appeals (arbitration_id, user_id, content, evidence_urls, submitted_at, handler_id, handler_remark, handled_at)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
	`, a.ArbitrationID, a.UserID, a.Content, string(evidenceJSON), a.SubmittedAt, a.HandlerID, a.HandlerRemark, a.HandledAt)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	a.ID = id
	return id, nil
}

func GetAppealByArbitrationID(arbitrationID int64) (*models.Appeal, error) {
	var a models.Appeal
	var evidenceStr sql.NullString
	err := DB.QueryRow(`
		SELECT id, arbitration_id, user_id, content, evidence_urls, submitted_at, handler_id, handler_remark, handled_at
		FROM appeals WHERE arbitration_id = ?
	`, arbitrationID).Scan(&a.ID, &a.ArbitrationID, &a.UserID, &a.Content, &evidenceStr, &a.SubmittedAt, &a.HandlerID, &a.HandlerRemark, &a.HandledAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	if evidenceStr.Valid {
		json.Unmarshal([]byte(evidenceStr.String), &a.EvidenceURLs)
	}
	return &a, nil
}

func UpdateAppeal(arbitrationID int64, handlerID, handlerRemark string, handledAt time.Time) error {
	_, err := DB.Exec(`
		UPDATE appeals SET handler_id = ?, handler_remark = ?, handled_at = ?
		WHERE arbitration_id = ?
	`, handlerID, handlerRemark, handledAt, arbitrationID)
	return err
}

func CreateProcessingLog(l *models.ProcessingLog) (int64, error) {
	result, err := DB.Exec(`
		INSERT INTO processing_logs (arbitration_id, action, operator_id, operator_name, old_status, new_status, remark)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, l.ArbitrationID, l.Action, l.OperatorID, l.OperatorName, l.OldStatus, l.NewStatus, l.Remark)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	l.ID = id
	return id, nil
}

func GetLogsByArbitrationID(arbitrationID int64) ([]models.ProcessingLog, error) {
	rows, err := DB.Query(`
		SELECT id, arbitration_id, action, operator_id, operator_name, old_status, new_status, remark, created_at
		FROM processing_logs WHERE arbitration_id = ? ORDER BY created_at DESC
	`, arbitrationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.ProcessingLog
	for rows.Next() {
		var l models.ProcessingLog
		err := rows.Scan(&l.ID, &l.ArbitrationID, &l.Action, &l.OperatorID, &l.OperatorName, &l.OldStatus, &l.NewStatus, &l.Remark, &l.CreatedAt)
		if err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}

func CreateChangeDiff(d *models.ChangeDiff) (int64, error) {
	result, err := DB.Exec(`
		INSERT INTO change_diffs (arbitration_id, table_name, record_id, field_name, old_value, new_value, operator_id)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, d.ArbitrationID, d.TableName, d.RecordID, d.FieldName, d.OldValue, d.NewValue, d.OperatorID)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	d.ID = id
	return id, nil
}

func GetDiffsByArbitrationID(arbitrationID int64) ([]models.ChangeDiff, error) {
	rows, err := DB.Query(`
		SELECT id, arbitration_id, table_name, record_id, field_name, old_value, new_value, operator_id, created_at
		FROM change_diffs WHERE arbitration_id = ? ORDER BY created_at DESC
	`, arbitrationID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var diffs []models.ChangeDiff
	for rows.Next() {
		var d models.ChangeDiff
		err := rows.Scan(&d.ID, &d.ArbitrationID, &d.TableName, &d.RecordID, &d.FieldName, &d.OldValue, &d.NewValue, &d.OperatorID, &d.CreatedAt)
		if err != nil {
			return nil, err
		}
		diffs = append(diffs, d)
	}
	return diffs, nil
}

func CreateConclusion(c *models.Conclusion) (int64, error) {
	result, err := DB.Exec(`
		INSERT INTO conclusions (arbitration_id, final_result, final_remark, refund_amount, handler_id, handler_name, closed_at)
		VALUES (?, ?, ?, ?, ?, ?, ?)
	`, c.ArbitrationID, c.FinalResult, c.FinalRemark, c.RefundAmount, c.HandlerID, c.HandlerName, c.ClosedAt)
	if err != nil {
		return 0, err
	}
	id, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}
	c.ID = id
	return id, nil
}

func GetConclusionByArbitrationID(arbitrationID int64) (*models.Conclusion, error) {
	var c models.Conclusion
	err := DB.QueryRow(`
		SELECT id, arbitration_id, final_result, final_remark, refund_amount, handler_id, handler_name, closed_at
		FROM conclusions WHERE arbitration_id = ?
	`, arbitrationID).Scan(&c.ID, &c.ArbitrationID, &c.FinalResult, &c.FinalRemark, &c.RefundAmount, &c.HandlerID, &c.HandlerName, &c.ClosedAt)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

func FindVehicleDamageHistory(vehicleID string, damageType models.DamageType, location string) (*models.DamageMatchResult, error) {
	var historyID int64
	var reportCount int
	var lastOrderID string
	err := DB.QueryRow(`
		SELECT id, report_count, last_report_order_id
		FROM vehicle_damage_history
		WHERE vehicle_id = ? AND damage_type = ? AND location = ? AND is_resolved = 0
		LIMIT 1
	`, vehicleID, damageType, location).Scan(&historyID, &reportCount, &lastOrderID)
	if err != nil {
		if err == sql.ErrNoRows {
			return &models.DamageMatchResult{IsDuplicate: false}, nil
		}
		return nil, err
	}

	similarity := 0.85
	if reportCount > 1 {
		similarity = 0.95
	}

	return &models.DamageMatchResult{
		IsDuplicate:     true,
		MatchedDamageID: historyID,
		Similarity:      similarity,
		Remark:          fmt.Sprintf("历史重复损伤，首次上报订单: %s, 上报次数: %d", lastOrderID, reportCount),
	}, nil
}

func UpsertVehicleDamageHistory(vehicleID string, damageType models.DamageType, location, severity, description, orderID string, reportTime time.Time) error {
	var existingID int64
	err := DB.QueryRow(`
		SELECT id FROM vehicle_damage_history
		WHERE vehicle_id = ? AND damage_type = ? AND location = ?
		LIMIT 1
	`, vehicleID, damageType, location).Scan(&existingID)

	if err == sql.ErrNoRows {
		_, err = DB.Exec(`
			INSERT INTO vehicle_damage_history (vehicle_id, damage_type, location, severity, description, first_report_order_id, first_report_time, last_report_order_id, last_report_time)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		`, vehicleID, damageType, location, severity, description, orderID, reportTime, orderID, reportTime)
		return err
	}

	if err != nil {
		return err
	}

	_, err = DB.Exec(`
		UPDATE vehicle_damage_history
		SET report_count = report_count + 1, last_report_order_id = ?, last_report_time = ?, updated_at = CURRENT_TIMESTAMP
		WHERE id = ?
	`, orderID, reportTime, existingID)
	return err
}

func QueryArbitrations(query *models.QueryRequest) ([]models.Arbitration, int64, error) {
	where := []string{"1=1"}
	args := []interface{}{}

	if query.OrderID != "" {
		where = append(where, "order_id LIKE ?")
		args = append(args, "%"+query.OrderID+"%")
	}
	if query.VehicleID != "" {
		where = append(where, "vehicle_id LIKE ?")
		args = append(args, "%"+query.VehicleID+"%")
	}
	if query.UserID != "" {
		where = append(where, "user_id LIKE ?")
		args = append(args, "%"+query.UserID+"%")
	}
	if query.Status != "" {
		where = append(where, "status = ?")
		args = append(args, query.Status)
	}
	if query.StartDate != "" {
		where = append(where, "created_at >= ?")
		args = append(args, query.StartDate)
	}
	if query.EndDate != "" {
		where = append(where, "created_at <= ?")
		args = append(args, query.EndDate)
	}

	whereClause := strings.Join(where, " AND ")

	var total int64
	err := DB.QueryRow(fmt.Sprintf("SELECT COUNT(*) FROM arbitrations WHERE %s", whereClause), args...).Scan(&total)
	if err != nil {
		return nil, 0, err
	}

	page := query.Page
	if page < 1 {
		page = 1
	}
	pageSize := query.PageSize
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	offset := (page - 1) * pageSize

	rows, err := DB.Query(fmt.Sprintf(`
		SELECT id, order_id, vehicle_id, user_id, status, pickup_time, return_time, handler_id, handler_name, created_at, updated_at
		FROM arbitrations WHERE %s ORDER BY created_at DESC LIMIT ? OFFSET ?
	`, whereClause), append(args, pageSize, offset)...)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var list []models.Arbitration
	for rows.Next() {
		var a models.Arbitration
		err := rows.Scan(&a.ID, &a.OrderID, &a.VehicleID, &a.UserID, &a.Status, &a.PickupTime, &a.ReturnTime, &a.HandlerID, &a.HandlerName, &a.CreatedAt, &a.UpdatedAt)
		if err != nil {
			return nil, 0, err
		}
		list = append(list, a)
	}

	return list, total, nil
}
