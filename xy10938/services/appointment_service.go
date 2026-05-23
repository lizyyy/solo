package services

import (
	"car-wash-queue-api/config"
	"car-wash-queue-api/database"
	"car-wash-queue-api/models"
	"database/sql"
	"fmt"
	"time"
)

func generateAppointmentNo() (string, error) {
	today := time.Now().Format("20060102")
	prefix := fmt.Sprintf("A%s", today)
	
	var lastApptNo string
	err := database.DB.QueryRow(`
		SELECT appointment_no FROM appointments 
		WHERE appointment_no LIKE ? 
		ORDER BY id DESC LIMIT 1
	`, prefix+"%").Scan(&lastApptNo)
	
	if err == sql.ErrNoRows {
		return fmt.Sprintf("%s001", prefix), nil
	}
	if err != nil {
		return "", err
	}

	var seq int
	fmt.Sscanf(lastApptNo, prefix+"%d", &seq)
	return fmt.Sprintf("%s%03d", prefix, seq+1), nil
}

func CreateAppointment(memberID int, serviceType, appointmentDate, appointmentTime string) (*models.Appointment, error) {
	cfg := config.GetConfig()

	if !config.Contains(cfg.ServiceTypes, serviceType) {
		return nil, fmt.Errorf("无效的服务类型")
	}

	var memberExists int
	err := database.DB.QueryRow(`SELECT id FROM members WHERE id = ?`, memberID).Scan(&memberExists)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("会员不存在")
	}
	if err != nil {
		return nil, err
	}

	var existingID int
	err = database.DB.QueryRow(`
		SELECT id FROM appointments 
		WHERE member_id = ? AND appointment_date = ? AND status IN ('待确认', '已确认')
		LIMIT 1
	`, memberID, appointmentDate).Scan(&existingID)
	if err == nil {
		return nil, fmt.Errorf("该会员今日已有预约")
	}
	if err != sql.ErrNoRows {
		return nil, err
	}

	appointmentNo, err := generateAppointmentNo()
	if err != nil {
		return nil, err
	}

	lockedUntil := time.Now().Add(30 * time.Minute)

	result, err := database.DB.Exec(`
		INSERT INTO appointments (appointment_no, member_id, service_type, appointment_date, appointment_time, locked_until)
		VALUES (?, ?, ?, ?, ?, ?)
	`, appointmentNo, memberID, serviceType, appointmentDate, appointmentTime, lockedUntil)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return GetAppointmentByID(int(id))
}

func GetAppointmentByID(id int) (*models.Appointment, error) {
	var a models.Appointment
	var stationID sql.NullInt64
	var lockedUntil sql.NullTime
	var memberName, memberPhone, stationName sql.NullString

	err := database.DB.QueryRow(`
		SELECT a.id, a.appointment_no, a.member_id, a.service_type, 
		       a.appointment_date, a.appointment_time, a.status, 
		       a.station_id, a.locked_until, a.created_at, a.updated_at,
		       m.name, m.phone, s.name
		FROM appointments a
		LEFT JOIN members m ON a.member_id = m.id
		LEFT JOIN stations s ON a.station_id = s.id
		WHERE a.id = ?
	`, id).Scan(&a.ID, &a.AppointmentNo, &a.MemberID, &a.ServiceType,
		&a.AppointmentDate, &a.AppointmentTime, &a.Status,
		&stationID, &lockedUntil, &a.CreatedAt, &a.UpdatedAt,
		&memberName, &memberPhone, &stationName)
	if err != nil {
		return nil, err
	}

	if stationID.Valid {
		idInt := int(stationID.Int64)
		a.StationID = &idInt
	}
	if lockedUntil.Valid {
		a.LockedUntil = &lockedUntil.Time
	}
	if memberName.Valid {
		a.MemberName = &memberName.String
	}
	if memberPhone.Valid {
		a.MemberPhone = &memberPhone.String
	}
	if stationName.Valid {
		a.StationName = &stationName.String
	}

	return &a, nil
}

func GetAppointmentList(date string) ([]models.Appointment, error) {
	var rows *sql.Rows
	var err error

	if date != "" {
		rows, err = database.DB.Query(`
			SELECT a.id, a.appointment_no, a.member_id, a.service_type, 
			       a.appointment_date, a.appointment_time, a.status, 
			       a.station_id, a.locked_until, a.created_at, a.updated_at,
			       m.name, m.phone, s.name
			FROM appointments a
			LEFT JOIN members m ON a.member_id = m.id
			LEFT JOIN stations s ON a.station_id = s.id
			WHERE a.appointment_date = ?
			ORDER BY a.appointment_date DESC, a.appointment_time ASC
		`, date)
	} else {
		rows, err = database.DB.Query(`
			SELECT a.id, a.appointment_no, a.member_id, a.service_type, 
			       a.appointment_date, a.appointment_time, a.status, 
			       a.station_id, a.locked_until, a.created_at, a.updated_at,
			       m.name, m.phone, s.name
			FROM appointments a
			LEFT JOIN members m ON a.member_id = m.id
			LEFT JOIN stations s ON a.station_id = s.id
			ORDER BY a.appointment_date DESC, a.appointment_time ASC
		`)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var appointments []models.Appointment
	for rows.Next() {
		var a models.Appointment
		var stationID sql.NullInt64
		var lockedUntil sql.NullTime
		var memberName, memberPhone, stationName sql.NullString

		err := rows.Scan(&a.ID, &a.AppointmentNo, &a.MemberID, &a.ServiceType,
			&a.AppointmentDate, &a.AppointmentTime, &a.Status,
			&stationID, &lockedUntil, &a.CreatedAt, &a.UpdatedAt,
			&memberName, &memberPhone, &stationName)
		if err != nil {
			return nil, err
		}

		if stationID.Valid {
			idInt := int(stationID.Int64)
			a.StationID = &idInt
		}
		if lockedUntil.Valid {
			a.LockedUntil = &lockedUntil.Time
		}
		if memberName.Valid {
			a.MemberName = &memberName.String
		}
		if memberPhone.Valid {
			a.MemberPhone = &memberPhone.String
		}
		if stationName.Valid {
			a.StationName = &stationName.String
		}

		appointments = append(appointments, a)
	}
	return appointments, nil
}

func LockAppointment(id, stationID int) (*models.Appointment, error) {
	appointment, err := GetAppointmentByID(id)
	if err != nil {
		return nil, fmt.Errorf("预约不存在")
	}

	if appointment.Status != "待确认" {
		return nil, fmt.Errorf("该预约状态不允许锁位")
	}

	var stationStatus string
	err = database.DB.QueryRow(`SELECT status FROM stations WHERE id = ?`, stationID).Scan(&stationStatus)
	if err != nil {
		return nil, fmt.Errorf("工位不存在")
	}
	if stationStatus != "空闲" {
		return nil, fmt.Errorf("工位不可用")
	}

	lockedUntil := time.Now().Add(15 * time.Minute)

	_, err = database.DB.Exec(`
		UPDATE appointments SET station_id = ?, status = '已确认', locked_until = ? WHERE id = ?
	`, stationID, lockedUntil, id)
	if err != nil {
		return nil, err
	}

	_, err = database.DB.Exec(`UPDATE stations SET status = '忙碌' WHERE id = ?`, stationID)
	if err != nil {
		return nil, err
	}

	return GetAppointmentByID(id)
}

func CancelAppointment(id int) (*models.Appointment, error) {
	appointment, err := GetAppointmentByID(id)
	if err != nil {
		return nil, fmt.Errorf("预约不存在")
	}

	if appointment.Status == "已完成" || appointment.Status == "已取消" {
		return nil, fmt.Errorf("该状态下无法取消")
	}

	if appointment.StationID != nil {
		_, err = database.DB.Exec(`
			UPDATE stations SET status = '空闲' WHERE id = ?
		`, *appointment.StationID)
		if err != nil {
			return nil, err
		}
	}

	_, err = database.DB.Exec(`
		UPDATE appointments SET status = '已取消', station_id = NULL WHERE id = ?
	`, id)
	if err != nil {
		return nil, err
	}

	return GetAppointmentByID(id)
}
