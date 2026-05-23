package services

import (
	"car-wash-queue-api/database"
	"car-wash-queue-api/models"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

func LogException(apiPath, requestMethod, rawInput, errorMessage, handlingConclusion string) error {
	_, err := database.DB.Exec(`
		INSERT INTO exception_logs (api_path, request_method, raw_input, error_message, handling_conclusion)
		VALUES (?, ?, ?, ?, ?)
	`, apiPath, requestMethod, rawInput, errorMessage, handlingConclusion)
	return err
}

func GenerateDailyReport(date string) (*models.QueueReport, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	var queueStats struct {
		Total      int
		Completed  int
		Overnumber int
	}
	err := database.DB.QueryRow(`
		SELECT 
			COUNT(*) as total,
			SUM(CASE WHEN status = '已完成' THEN 1 ELSE 0 END) as completed,
			SUM(CASE WHEN status = '已过号' THEN 1 ELSE 0 END) as overnumber
		FROM queue_numbers 
		WHERE DATE(created_at) = ?
	`, date).Scan(&queueStats.Total, &queueStats.Completed, &queueStats.Overnumber)
	if err != nil {
		return nil, err
	}

	var timeStats struct {
		AvgWait    sql.NullFloat64
		AvgService sql.NullFloat64
	}
	database.DB.QueryRow(`
		SELECT 
			AVG((julianday(started_at) - julianday(created_at)) * 24 * 60) as avg_wait,
			AVG((julianday(completed_at) - julianday(started_at)) * 24 * 60) as avg_service
		FROM queue_numbers 
		WHERE DATE(created_at) = ? AND status = '已完成'
	`, date).Scan(&timeStats.AvgWait, &timeStats.AvgService)

	var peakHour sql.NullString
	database.DB.QueryRow(`
		SELECT strftime('%H', created_at) as hour
		FROM queue_numbers 
		WHERE DATE(created_at) = ?
		GROUP BY hour
		ORDER BY COUNT(*) DESC
		LIMIT 1
	`, date).Scan(&peakHour)

	var existingID int
	err = database.DB.QueryRow(`SELECT id FROM queue_reports WHERE report_date = ?`, date).Scan(&existingID)

	avgWait := 0.0
	if timeStats.AvgWait.Valid {
		avgWait = timeStats.AvgWait.Float64
	}
	avgService := 0.0
	if timeStats.AvgService.Valid {
		avgService = timeStats.AvgService.Float64
	}

	var peakHourPtr *string
	if peakHour.Valid {
		peakHourStr := peakHour.String
		peakHourPtr = &peakHourStr
	}

	if err == nil {
		_, err = database.DB.Exec(`
			UPDATE queue_reports SET 
				total_queue = ?, completed_count = ?, overnumber_count = ?,
				avg_wait_time = ?, avg_service_time = ?, peak_hour = ?
			WHERE report_date = ?
		`, queueStats.Total, queueStats.Completed, queueStats.Overnumber,
			avgWait, avgService, peakHourPtr, date)
	} else {
		_, err = database.DB.Exec(`
			INSERT INTO queue_reports 
				(report_date, total_queue, completed_count, overnumber_count, avg_wait_time, avg_service_time, peak_hour)
			VALUES (?, ?, ?, ?, ?, ?, ?)
		`, date, queueStats.Total, queueStats.Completed, queueStats.Overnumber,
			avgWait, avgService, peakHourPtr)
	}

	if err != nil {
		return nil, err
	}

	return GetReportByDate(date)
}

func GetReportByDate(date string) (*models.QueueReport, error) {
	var r models.QueueReport
	var peakHour sql.NullString

	err := database.DB.QueryRow(`
		SELECT id, report_date, total_queue, completed_count, overnumber_count,
		       avg_wait_time, avg_service_time, peak_hour, created_at, updated_at
		FROM queue_reports WHERE report_date = ?
	`, date).Scan(&r.ID, &r.ReportDate, &r.TotalQueue, &r.CompletedCount, &r.OvernumberCount,
		&r.AvgWaitTime, &r.AvgServiceTime, &peakHour, &r.CreatedAt, &r.UpdatedAt)
	if err != nil {
		return nil, err
	}

	if peakHour.Valid {
		peakHourStr := peakHour.String
		r.PeakHour = &peakHourStr
	}

	return &r, nil
}

func GetReportList(startDate, endDate string) ([]models.QueueReport, error) {
	var rows *sql.Rows
	var err error

	if startDate != "" && endDate != "" {
		rows, err = database.DB.Query(`
			SELECT id, report_date, total_queue, completed_count, overnumber_count,
			       avg_wait_time, avg_service_time, peak_hour, created_at, updated_at
			FROM queue_reports
			WHERE report_date BETWEEN ? AND ?
			ORDER BY report_date DESC
		`, startDate, endDate)
	} else {
		rows, err = database.DB.Query(`
			SELECT id, report_date, total_queue, completed_count, overnumber_count,
			       avg_wait_time, avg_service_time, peak_hour, created_at, updated_at
			FROM queue_reports
			ORDER BY report_date DESC
		`)
	}

	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var reports []models.QueueReport
	for rows.Next() {
		var r models.QueueReport
		var peakHour sql.NullString

		err := rows.Scan(&r.ID, &r.ReportDate, &r.TotalQueue, &r.CompletedCount, &r.OvernumberCount,
			&r.AvgWaitTime, &r.AvgServiceTime, &peakHour, &r.CreatedAt, &r.UpdatedAt)
		if err != nil {
			return nil, err
		}

		if peakHour.Valid {
			peakHourStr := peakHour.String
			r.PeakHour = &peakHourStr
		}

		reports = append(reports, r)
	}
	return reports, nil
}

func ExportReportToCSV(date string) (string, string, string, error) {
	if date == "" {
		date = time.Now().Format("2006-01-02")
	}

	report, err := GenerateDailyReport(date)
	if err != nil {
		return "", "", "", err
	}

	rows, err := database.DB.Query(`
		SELECT queue_no, service_type, status, position, created_at, started_at, completed_at
		FROM queue_numbers WHERE DATE(created_at) = ? ORDER BY position ASC
	`, date)
	if err != nil {
		return "", "", "", err
	}
	defer rows.Close()

	var csv strings.Builder
	csv.WriteString("洗车会员排队日报\n")
	csv.WriteString(fmt.Sprintf("日期,%s\n", date))
	csv.WriteString(fmt.Sprintf("总排队数,%d\n", report.TotalQueue))
	csv.WriteString(fmt.Sprintf("已完成数,%d\n", report.CompletedCount))
	csv.WriteString(fmt.Sprintf("过号数,%d\n", report.OvernumberCount))
	csv.WriteString(fmt.Sprintf("平均等待时间(分钟),%.2f\n", report.AvgWaitTime))
	csv.WriteString(fmt.Sprintf("平均服务时间(分钟),%.2f\n", report.AvgServiceTime))
	peakHourStr := "-"
	if report.PeakHour != nil {
		peakHourStr = *report.PeakHour
	}
	csv.WriteString(fmt.Sprintf("高峰时段,%s\n", peakHourStr))
	csv.WriteString("\n排队明细\n")
	csv.WriteString("排队号,服务类型,状态,位置,创建时间,开始服务时间,完成时间\n")

	for rows.Next() {
		var queueNo, serviceType, status string
		var position int
		var createdAt, startedAt, completedAt sql.NullTime

		err := rows.Scan(&queueNo, &serviceType, &status, &position, &createdAt, &startedAt, &completedAt)
		if err != nil {
			return "", "", "", err
		}

		createdAtStr := "-"
		if createdAt.Valid {
			createdAtStr = createdAt.Time.Format("2006-01-02 15:04:05")
		}
		startedAtStr := "-"
		if startedAt.Valid {
			startedAtStr = startedAt.Time.Format("2006-01-02 15:04:05")
		}
		completedAtStr := "-"
		if completedAt.Valid {
			completedAtStr = completedAt.Time.Format("2006-01-02 15:04:05")
		}

		csv.WriteString(fmt.Sprintf("%s,%s,%s,%d,%s,%s,%s\n",
			queueNo, serviceType, status, position, createdAtStr, startedAtStr, completedAtStr))
	}

	filename := fmt.Sprintf("queue_report_%s.csv", date)
	return csv.String(), filename, date, nil
}

func GetOvernumberRecords() ([]models.OvernumberRecord, error) {
	rows, err := database.DB.Query(`
		SELECT o.id, o.queue_id, o.original_queue_no, o.new_queue_id, 
		       o.reason, o.requeue_count, o.created_at,
		       q.queue_no, q.service_type, m.name
		FROM overnumber_records o
		LEFT JOIN queue_numbers q ON o.queue_id = q.id
		LEFT JOIN members m ON q.member_id = m.id
		ORDER BY o.created_at DESC
	`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var records []models.OvernumberRecord
	for rows.Next() {
		var r models.OvernumberRecord
		var newQueueID sql.NullInt64
		var queueNo, serviceType, memberName sql.NullString

		err := rows.Scan(&r.ID, &r.QueueID, &r.OriginalQueueNo, &newQueueID,
			&r.Reason, &r.RequeueCount, &r.CreatedAt,
			&queueNo, &serviceType, &memberName)
		if err != nil {
			return nil, err
		}

		if newQueueID.Valid {
			idInt := int(newQueueID.Int64)
			r.NewQueueID = &idInt
		}
		if queueNo.Valid {
			r.QueueNo = &queueNo.String
		}
		if serviceType.Valid {
			r.ServiceType = &serviceType.String
		}
		if memberName.Valid {
			r.MemberName = &memberName.String
		}

		records = append(records, r)
	}
	return records, nil
}

func GetExceptionLogs(limit int) ([]models.ExceptionLog, error) {
	if limit <= 0 {
		limit = 50
	}

	rows, err := database.DB.Query(`
		SELECT id, api_path, request_method, raw_input, error_message, handling_conclusion, created_at
		FROM exception_logs ORDER BY created_at DESC LIMIT ?
	`, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var logs []models.ExceptionLog
	for rows.Next() {
		var l models.ExceptionLog
		err := rows.Scan(&l.ID, &l.APIPath, &l.RequestMethod, &l.RawInput,
			&l.ErrorMessage, &l.HandlingConclusion, &l.CreatedAt)
		if err != nil {
			return nil, err
		}
		logs = append(logs, l)
	}
	return logs, nil
}
