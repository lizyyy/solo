package services

import (
	"car-wash-queue-api/config"
	"car-wash-queue-api/database"
	"car-wash-queue-api/models"
	"database/sql"
	"fmt"
	"time"
)

func generateQueueNo() (string, error) {
	today := time.Now().Format("20060102")
	prefix := fmt.Sprintf("Q%s", today)
	
	var lastQueueNo string
	err := database.DB.QueryRow(`
		SELECT queue_no FROM queue_numbers 
		WHERE queue_no LIKE ? 
		ORDER BY id DESC LIMIT 1
	`, prefix+"%").Scan(&lastQueueNo)
	
	if err == sql.ErrNoRows {
		return fmt.Sprintf("%s001", prefix), nil
	}
	if err != nil {
		return "", err
	}

	var seq int
	fmt.Sscanf(lastQueueNo, prefix+"%d", &seq)
	return fmt.Sprintf("%s%03d", prefix, seq+1), nil
}

func getNextPosition() (int, error) {
	var maxPos sql.NullInt64
	err := database.DB.QueryRow(`
		SELECT MAX(position) as max_pos FROM queue_numbers 
		WHERE status IN ('等待中', '服务中')
	`).Scan(&maxPos)
	if err != nil {
		return 0, err
	}

	if maxPos.Valid {
		return int(maxPos.Int64) + 1, nil
	}
	return 1, nil
}

func checkDuplicateQueue(memberID *int) (bool, error) {
	if memberID == nil {
		return false, nil
	}

	var count int
	err := database.DB.QueryRow(`
		SELECT COUNT(*) FROM queue_numbers 
		WHERE member_id = ? AND status IN ('等待中', '服务中')
	`, *memberID).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func CreateQueueNumber(memberID, appointmentID *int, serviceType string) (*models.QueueNumber, error) {
	cfg := config.GetConfig()

	if !config.Contains(cfg.ServiceTypes, serviceType) {
		return nil, fmt.Errorf("无效的服务类型")
	}

	duplicate, err := checkDuplicateQueue(memberID)
	if err != nil {
		return nil, err
	}
	if duplicate {
		return nil, fmt.Errorf("该会员已有正在等待或服务中的排队号")
	}

	queueNo, err := generateQueueNo()
	if err != nil {
		return nil, err
	}

	position, err := getNextPosition()
	if err != nil {
		return nil, err
	}

	result, err := database.DB.Exec(`
		INSERT INTO queue_numbers (queue_no, member_id, appointment_id, service_type, position, status)
		VALUES (?, ?, ?, ?, ?, '等待中')
	`, queueNo, memberID, appointmentID, serviceType, position)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return GetQueueByID(int(id))
}

func GetQueueByID(id int) (*models.QueueNumber, error) {
	var q models.QueueNumber
	var memberID, appointmentID, stationID sql.NullInt64
	var calledAt, startedAt, completedAt sql.NullTime
	var memberName, memberPhone, stationName sql.NullString

	err := database.DB.QueryRow(`
		SELECT q.id, q.queue_no, q.member_id, q.appointment_id, q.service_type, 
		       q.status, q.station_id, q.position, q.called_at, q.started_at, 
		       q.completed_at, q.created_at, q.updated_at,
		       m.name, m.phone, s.name
		FROM queue_numbers q
		LEFT JOIN members m ON q.member_id = m.id
		LEFT JOIN stations s ON q.station_id = s.id
		WHERE q.id = ?
	`, id).Scan(&q.ID, &q.QueueNo, &memberID, &appointmentID, &q.ServiceType,
		&q.Status, &stationID, &q.Position, &calledAt, &startedAt,
		&completedAt, &q.CreatedAt, &q.UpdatedAt,
		&memberName, &memberPhone, &stationName)
	if err != nil {
		return nil, err
	}

	if memberID.Valid {
		idInt := int(memberID.Int64)
		q.MemberID = &idInt
	}
	if appointmentID.Valid {
		idInt := int(appointmentID.Int64)
		q.AppointmentID = &idInt
	}
	if stationID.Valid {
		idInt := int(stationID.Int64)
		q.StationID = &idInt
	}
	if calledAt.Valid {
		q.CalledAt = &calledAt.Time
	}
	if startedAt.Valid {
		q.StartedAt = &startedAt.Time
	}
	if completedAt.Valid {
		q.CompletedAt = &completedAt.Time
	}
	if memberName.Valid {
		q.MemberName = &memberName.String
	}
	if memberPhone.Valid {
		q.MemberPhone = &memberPhone.String
	}
	if stationName.Valid {
		q.StationName = &stationName.String
	}

	return &q, nil
}

func GetQueueList(status string) ([]models.QueueNumber, error) {
	var rows *sql.Rows
	var err error

	if status != "" {
		rows, err = database.DB.Query(`
			SELECT q.id, q.queue_no, q.member_id, q.appointment_id, q.service_type, 
			       q.status, q.station_id, q.position, q.called_at, q.started_at, 
			       q.completed_at, q.created_at, q.updated_at,
			       m.name, m.phone, s.name
			FROM queue_numbers q
			LEFT JOIN members m ON q.member_id = m.id
			LEFT JOIN stations s ON q.station_id = s.id
			WHERE q.status = ?
			ORDER BY q.position ASC
		`, status)
	} else {
		rows, err = database.DB.Query(`
			SELECT q.id, q.queue_no, q.member_id, q.appointment_id, q.service_type, 
			       q.status, q.station_id, q.position, q.called_at, q.started_at, 
			       q.completed_at, q.created_at, q.updated_at,
			       m.name, m.phone, s.name
			FROM queue_numbers q
			LEFT JOIN members m ON q.member_id = m.id
			LEFT JOIN stations s ON q.station_id = s.id
			ORDER BY q.position ASC
		`)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var queues []models.QueueNumber
	for rows.Next() {
		var q models.QueueNumber
		var memberID, appointmentID, stationID sql.NullInt64
		var calledAt, startedAt, completedAt sql.NullTime
		var memberName, memberPhone, stationName sql.NullString

		err := rows.Scan(&q.ID, &q.QueueNo, &memberID, &appointmentID, &q.ServiceType,
			&q.Status, &stationID, &q.Position, &calledAt, &startedAt,
			&completedAt, &q.CreatedAt, &q.UpdatedAt,
			&memberName, &memberPhone, &stationName)
		if err != nil {
			return nil, err
		}

		if memberID.Valid {
			idInt := int(memberID.Int64)
			q.MemberID = &idInt
		}
		if appointmentID.Valid {
			idInt := int(appointmentID.Int64)
			q.AppointmentID = &idInt
		}
		if stationID.Valid {
			idInt := int(stationID.Int64)
			q.StationID = &idInt
		}
		if calledAt.Valid {
			q.CalledAt = &calledAt.Time
		}
		if startedAt.Valid {
			q.StartedAt = &startedAt.Time
		}
		if completedAt.Valid {
			q.CompletedAt = &completedAt.Time
		}
		if memberName.Valid {
			q.MemberName = &memberName.String
		}
		if memberPhone.Valid {
			q.MemberPhone = &memberPhone.String
		}
		if stationName.Valid {
			q.StationName = &stationName.String
		}

		queues = append(queues, q)
	}
	return queues, nil
}

func CallNextQueue() (*models.QueueNumber, error) {
	var nextQueueID int
	err := database.DB.QueryRow(`
		SELECT id FROM queue_numbers 
		WHERE status = '等待中' 
		ORDER BY position ASC LIMIT 1
	`).Scan(&nextQueueID)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("没有等待中的排队号")
	}
	if err != nil {
		return nil, err
	}

	var freeStationID sql.NullInt64
	database.DB.QueryRow(`
		SELECT id FROM stations WHERE status = '空闲' LIMIT 1
	`).Scan(&freeStationID)

	now := time.Now()
	var stationID interface{} = nil
	if freeStationID.Valid {
		stationID = int(freeStationID.Int64)
	}

	_, err = database.DB.Exec(`
		UPDATE queue_numbers SET status = '服务中', called_at = ?, station_id = ?, started_at = ? WHERE id = ?
	`, now, stationID, now, nextQueueID)
	if err != nil {
		return nil, err
	}

	if freeStationID.Valid {
		_, err = database.DB.Exec(`
			UPDATE stations SET status = '忙碌', current_queue_id = ? WHERE id = ?
		`, nextQueueID, int(freeStationID.Int64))
		if err != nil {
			return nil, err
		}
	}

	return GetQueueByID(nextQueueID)
}

func CompleteQueue(id int) (*models.QueueNumber, error) {
	queue, err := GetQueueByID(id)
	if err != nil {
		return nil, fmt.Errorf("排队号不存在")
	}

	now := time.Now()
	_, err = database.DB.Exec(`
		UPDATE queue_numbers SET status = '已完成', completed_at = ? WHERE id = ?
	`, now, id)
	if err != nil {
		return nil, err
	}

	if queue.StationID != nil {
		_, err = database.DB.Exec(`
			UPDATE stations SET status = '空闲', current_queue_id = NULL WHERE id = ?
		`, *queue.StationID)
		if err != nil {
			return nil, err
		}
	}

	return GetQueueByID(id)
}

func MarkOvernumber(id int, reason string) (*models.QueueNumber, error) {
	queue, err := GetQueueByID(id)
	if err != nil {
		return nil, fmt.Errorf("排队号不存在")
	}

	if queue.Status != "等待中" && queue.Status != "服务中" {
		return nil, fmt.Errorf("该状态下无法标记过号")
	}

	_, err = database.DB.Exec(`UPDATE queue_numbers SET status = '已过号' WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}

	if queue.StationID != nil {
		_, err = database.DB.Exec(`
			UPDATE stations SET status = '空闲', current_queue_id = NULL WHERE id = ?
		`, *queue.StationID)
		if err != nil {
			return nil, err
		}
	}

	if reason == "" {
		reason = "客户未到场"
	}

	_, err = database.DB.Exec(`
		INSERT INTO overnumber_records (queue_id, original_queue_no, reason)
		VALUES (?, ?, ?)
	`, id, queue.QueueNo, reason)
	if err != nil {
		return nil, err
	}

	return GetQueueByID(id)
}

func RequeueOvernumber(id int) (*models.QueueNumber, error) {
	var overRecord struct {
		ID          int
		NewQueueID  sql.NullInt64
		RequeueCount int
	}
	err := database.DB.QueryRow(`
		SELECT id, new_queue_id, requeue_count 
		FROM overnumber_records 
		WHERE queue_id = ? ORDER BY id DESC LIMIT 1
	`, id).Scan(&overRecord.ID, &overRecord.NewQueueID, &overRecord.RequeueCount)
	if err != nil {
		return nil, fmt.Errorf("未找到过号记录")
	}

	if overRecord.NewQueueID.Valid {
		return nil, fmt.Errorf("该过号记录已补排过")
	}

	originalQueue, err := GetQueueByID(id)
	if err != nil {
		return nil, err
	}

	cfg := config.GetConfig()
	nextPos, err := getNextPosition()
	if err != nil {
		return nil, err
	}
	newPosition := nextPos + cfg.OvernumberWaitCount

	newQueueNo, err := generateQueueNo()
	if err != nil {
		return nil, err
	}

	result, err := database.DB.Exec(`
		INSERT INTO queue_numbers (queue_no, member_id, service_type, position, status)
		VALUES (?, ?, ?, ?, '等待中')
	`, newQueueNo, originalQueue.MemberID, originalQueue.ServiceType, newPosition)
	if err != nil {
		return nil, err
	}

	newQueueID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	_, err = database.DB.Exec(`
		UPDATE overnumber_records SET new_queue_id = ?, requeue_count = requeue_count + 1 WHERE id = ?
	`, newQueueID, overRecord.ID)
	if err != nil {
		return nil, err
	}

	return GetQueueByID(int(newQueueID))
}

func CancelQueue(id int) (*models.QueueNumber, error) {
	queue, err := GetQueueByID(id)
	if err != nil {
		return nil, fmt.Errorf("排队号不存在")
	}

	if queue.Status == "已完成" || queue.Status == "已取消" {
		return nil, fmt.Errorf("该状态下无法取消")
	}

	if queue.StationID != nil {
		_, err = database.DB.Exec(`
			UPDATE stations SET status = '空闲', current_queue_id = NULL WHERE id = ?
		`, *queue.StationID)
		if err != nil {
			return nil, err
		}
	}

	_, err = database.DB.Exec(`UPDATE queue_numbers SET status = '已取消' WHERE id = ?`, id)
	if err != nil {
		return nil, err
	}

	return GetQueueByID(id)
}

func ManualUpdateQueue(id int, data map[string]interface{}) (*models.QueueNumber, error) {
	_, err := GetQueueByID(id)
	if err != nil {
		return nil, fmt.Errorf("排队号不存在")
	}

	cfg := config.GetConfig()

	updates := ""
	params := []interface{}{}
	first := true

	allowedFields := []string{"status", "position", "station_id"}
	for _, field := range allowedFields {
		if val, ok := data[field]; ok {
			if field == "status" {
				statusStr := val.(string)
				if !config.Contains(cfg.QueueStatuses, statusStr) {
					return nil, fmt.Errorf("无效的状态值")
				}
			}
			if !first {
				updates += ", "
			}
			updates += fmt.Sprintf("%s = ?", field)
			params = append(params, val)
			first = false
		}
	}

	if updates == "" {
		return nil, fmt.Errorf("没有有效更新字段")
	}

	params = append(params, id)
	_, err = database.DB.Exec(`UPDATE queue_numbers SET `+updates+` WHERE id = ?`, params...)
	if err != nil {
		return nil, err
	}

	return GetQueueByID(id)
}
