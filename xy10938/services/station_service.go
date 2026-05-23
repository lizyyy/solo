package services

import (
	"car-wash-queue-api/config"
	"car-wash-queue-api/database"
	"car-wash-queue-api/models"
	"database/sql"
	"fmt"
)

func generateStationNo() (string, error) {
	var lastStationNo string
	err := database.DB.QueryRow(`
		SELECT station_no FROM stations ORDER BY id DESC LIMIT 1
	`).Scan(&lastStationNo)
	
	if err == sql.ErrNoRows {
		return "S001", nil
	}
	if err != nil {
		return "", err
	}

	var seq int
	fmt.Sscanf(lastStationNo, "S%d", &seq)
	return fmt.Sprintf("S%03d", seq+1), nil
}

func CreateStation(name string, serviceType ...string) (*models.Station, error) {
	if name == "" {
		return nil, fmt.Errorf("工位名称不能为空")
	}

	stationNo, err := generateStationNo()
	if err != nil {
		return nil, err
	}

	result, err := database.DB.Exec(`
		INSERT INTO stations (station_no, name, status)
		VALUES (?, ?, '空闲')
	`, stationNo, name)
	if err != nil {
		return nil, err
	}

	id, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return GetStationByID(int(id))
}

func UpdateStationStatus(id int, status string) error {
	_, err := database.DB.Exec(`UPDATE stations SET status = ? WHERE id = ?`, status, id)
	return err
}

func GetStationByID(id int) (*models.Station, error) {
	var station models.Station
	var currentQueueID sql.NullInt64
	err := database.DB.QueryRow(`
		SELECT id, station_no, name, status, current_queue_id, created_at, updated_at
		FROM stations WHERE id = ?
	`, id).Scan(&station.ID, &station.StationNo, &station.Name, &station.Status,
		&currentQueueID, &station.CreatedAt, &station.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if currentQueueID.Valid {
		idInt := int(currentQueueID.Int64)
		station.CurrentQueueID = &idInt
	}

	return &station, nil
}

func GetStationList() ([]models.Station, error) {
	rows, err := database.DB.Query(`
		SELECT id, station_no, name, status, current_queue_id, created_at, updated_at
		FROM stations ORDER BY station_no ASC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var stations []models.Station
	for rows.Next() {
		var s models.Station
		var currentQueueID sql.NullInt64
		err := rows.Scan(&s.ID, &s.StationNo, &s.Name, &s.Status,
			&currentQueueID, &s.CreatedAt, &s.UpdatedAt)
		if err != nil {
			return nil, err
		}

		if currentQueueID.Valid {
			idInt := int(currentQueueID.Int64)
			s.CurrentQueueID = &idInt
		}

		stations = append(stations, s)
	}
	return stations, nil
}

func UpdateStation(id int, data map[string]interface{}) (*models.Station, error) {
	_, err := GetStationByID(id)
	if err != nil {
		return nil, fmt.Errorf("工位不存在")
	}

	cfg := config.GetConfig()

	updates := ""
	params := []interface{}{}
	first := true

	allowedFields := []string{"name", "status"}
	for _, field := range allowedFields {
		if val, ok := data[field]; ok {
			if field == "status" {
				statusStr := val.(string)
				if !config.Contains(cfg.StationStatuses, statusStr) {
					return nil, fmt.Errorf("无效的工位状态")
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
	_, err = database.DB.Exec(`UPDATE stations SET `+updates+` WHERE id = ?`, params...)
	if err != nil {
		return nil, err
	}

	return GetStationByID(id)
}
