package service

import (
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"
	"visitor-pass/internal/config"
	"visitor-pass/internal/model"
	"visitor-pass/internal/repository"
)

type ReconciliationService struct{}

func NewReconciliationService() *ReconciliationService {
	return &ReconciliationService{}
}

type ValidationError struct {
	RowNumber int
	Errors    map[string]string
}

func (s *ReconciliationService) ValidateAppointment(data map[string]string) (map[string]string, *ValidationError) {
	errs := make(map[string]string)
	result := make(map[string]string)

	result["visitor_name"] = strings.TrimSpace(data["visitor_name"])
	if result["visitor_name"] == "" {
		errs["visitor_name"] = "访客姓名不能为空"
	}

	result["visitor_id_card"] = strings.TrimSpace(data["visitor_id_card"])
	if result["visitor_id_card"] == "" {
		errs["visitor_id_card"] = "身份证号不能为空"
	} else if len(result["visitor_id_card"]) != 18 {
		errs["visitor_id_card"] = "身份证号格式不正确"
	}

	result["license_plate"] = strings.TrimSpace(data["license_plate"])

	visitDateStr := strings.TrimSpace(data["visit_date"])
	if visitDateStr == "" {
		errs["visit_date"] = "访问日期不能为空"
	} else {
		if _, err := time.Parse("2006-01-02", visitDateStr); err != nil {
			if _, err2 := time.Parse(time.RFC3339, visitDateStr); err2 != nil {
				errs["visit_date"] = "日期格式不正确，请使用YYYY-MM-DD或RFC3339格式"
			}
		}
	}
	result["visit_date"] = visitDateStr

	visitEndDateStr := strings.TrimSpace(data["visit_end_date"])
	if visitEndDateStr == "" {
		visitEndDateStr = visitDateStr
	}
	result["visit_end_date"] = visitEndDateStr

	result["visit_reason"] = strings.TrimSpace(data["visit_reason"])
	result["visitor_company"] = strings.TrimSpace(data["visitor_company"])
	result["host_name"] = strings.TrimSpace(data["host_name"])
	result["host_department"] = strings.TrimSpace(data["host_department"])
	result["access_area"] = strings.TrimSpace(data["access_area"])
	result["visitor_phone"] = strings.TrimSpace(data["visitor_phone"])

	if len(errs) > 0 {
		return result, &ValidationError{Errors: errs}
	}
	return result, nil
}

func (s *ReconciliationService) ValidateGateRecord(data map[string]string) (map[string]string, *ValidationError) {
	errs := make(map[string]string)
	result := make(map[string]string)

	result["gate_name"] = strings.TrimSpace(data["gate_name"])
	if result["gate_name"] == "" {
		errs["gate_name"] = "闸机名称不能为空"
	}

	result["pass_direction"] = strings.TrimSpace(data["pass_direction"])
	if result["pass_direction"] == "" {
		errs["pass_direction"] = "通行方向不能为空"
	} else if result["pass_direction"] != "in" && result["pass_direction"] != "out" {
		errs["pass_direction"] = "通行方向必须是in或out"
	}

	passTimeStr := strings.TrimSpace(data["pass_time"])
	if passTimeStr == "" {
		errs["pass_time"] = "通行时间不能为空"
	} else {
		if _, err := time.Parse("2006-01-02 15:04:05", passTimeStr); err != nil {
			if _, err2 := time.Parse(time.RFC3339, passTimeStr); err2 != nil {
				errs["pass_time"] = "时间格式不正确，请使用YYYY-MM-DD HH:MM:SS或RFC3339格式"
			}
		}
	}
	result["pass_time"] = passTimeStr

	result["license_plate"] = strings.TrimSpace(data["license_plate"])
	result["visitor_name"] = strings.TrimSpace(data["visitor_name"])
	result["visitor_id_card"] = strings.TrimSpace(data["visitor_id_card"])
	result["staff_name"] = strings.TrimSpace(data["staff_name"])

	if temp := strings.TrimSpace(data["temperature"]); temp != "" {
		if _, err := strconv.ParseFloat(temp, 64); err != nil {
			errs["temperature"] = "体温格式不正确"
		}
		result["temperature"] = temp
	}

	if len(errs) > 0 {
		return result, &ValidationError{Errors: errs}
	}
	return result, nil
}

func (s *ReconciliationService) ValidatePlateImage(data map[string]string) (map[string]string, *ValidationError) {
	errs := make(map[string]string)
	result := make(map[string]string)

	result["image_file_name"] = strings.TrimSpace(data["image_file_name"])
	if result["image_file_name"] == "" {
		errs["image_file_name"] = "图片文件名不能为空"
	}

	result["image_hash"] = strings.TrimSpace(data["image_hash"])
	if result["image_hash"] == "" {
		errs["image_hash"] = "图片哈希不能为空"
	}

	captureTimeStr := strings.TrimSpace(data["capture_time"])
	if captureTimeStr == "" {
		errs["capture_time"] = "抓拍时间不能为空"
	} else {
		if _, err := time.Parse("2006-01-02 15:04:05", captureTimeStr); err != nil {
			if _, err2 := time.Parse(time.RFC3339, captureTimeStr); err2 != nil {
				errs["capture_time"] = "时间格式不正确"
			}
		}
	}
	result["capture_time"] = captureTimeStr

	result["license_plate"] = strings.TrimSpace(data["license_plate"])
	result["recognized_plate"] = strings.TrimSpace(data["recognized_plate"])
	result["capture_gate"] = strings.TrimSpace(data["capture_gate"])

	if conf := strings.TrimSpace(data["recognition_confidence"]); conf != "" {
		if _, err := strconv.ParseFloat(conf, 64); err != nil {
			errs["recognition_confidence"] = "置信度格式不正确"
		}
		result["recognition_confidence"] = conf
	}

	if len(errs) > 0 {
		return result, &ValidationError{Errors: errs}
	}
	return result, nil
}

func parseTime(s string) time.Time {
	if t, err := time.Parse("2006-01-02", s); err == nil {
		return t
	}
	if t, err := time.Parse("2006-01-02 15:04:05", s); err == nil {
		return t
	}
	if t, err := time.Parse(time.RFC3339, s); err == nil {
		return t
	}
	return time.Time{}
}

type ImportResult struct {
	BatchID       string
	TotalRecords  int
	FailedRecords int
}

func (s *ReconciliationService) ImportAppointments(batchName string, records []map[string]string, userID string) (*ImportResult, error) {
	batchID := uuid.NewString()
	batch := &model.Batch{
		ID:         batchID,
		Name:       batchName,
		Source:     "appointment_import",
		Status:     "importing",
		CreatedBy:  userID,
	}
	if err := repository.CreateBatch(batch); err != nil {
		return nil, err
	}

	total := len(records)
	failed := 0

	for i, record := range records {
		rowNum := i + 1
		validated, valErr := s.ValidateAppointment(record)
		if valErr != nil {
			failed++
			rawData, _ := json.Marshal(record)
			fieldErrs, _ := json.Marshal(valErr.Errors)
			repository.CreateImportFailure(&model.ImportFailure{
				BatchID:       batchID,
				SourceType:    "appointment",
				RowNumber:     rowNum,
				RawData:       string(rawData),
				FailureReason: "数据验证失败",
				FieldErrors:   string(fieldErrs),
			})
			continue
		}

		appt := &model.VisitorAppointment{
			ID:             uuid.NewString(),
			BatchID:        batchID,
			VisitorName:    validated["visitor_name"],
			VisitorIDCard:  validated["visitor_id_card"],
			VisitorPhone:   validated["visitor_phone"],
			LicensePlate:   validated["license_plate"],
			VisitDate:      parseTime(validated["visit_date"]),
			VisitEndDate:   parseTime(validated["visit_end_date"]),
			VisitReason:    validated["visit_reason"],
			VisitorCompany: validated["visitor_company"],
			HostName:       validated["host_name"],
			HostDepartment: validated["host_department"],
			AccessArea:     validated["access_area"],
			Status:         "pending_review",
			CreatedBy:      userID,
		}
		if err := repository.CreateAppointment(appt); err != nil {
			failed++
			rawData, _ := json.Marshal(record)
			repository.CreateImportFailure(&model.ImportFailure{
				BatchID:       batchID,
				SourceType:    "appointment",
				RowNumber:     rowNum,
				RawData:       string(rawData),
				FailureReason: fmt.Sprintf("数据库错误: %v", err),
			})
		}
	}

	db := repository.GetDB()
	_, err := db.Exec(`UPDATE batches SET status = 'completed', total_records = ?, failed_records = ?, updated_at = ? WHERE id = ?`,
		total, failed, time.Now(), batchID)

	return &ImportResult{
		BatchID:       batchID,
		TotalRecords:  total,
		FailedRecords: failed,
	}, err
}

func (s *ReconciliationService) ImportGateRecords(batchName string, records []map[string]string, userID string) (*ImportResult, error) {
	batchID := uuid.NewString()
	batch := &model.Batch{
		ID:         batchID,
		Name:       batchName,
		Source:     "gate_record_import",
		Status:     "importing",
		CreatedBy:  userID,
	}
	if err := repository.CreateBatch(batch); err != nil {
		return nil, err
	}

	total := len(records)
	failed := 0

	for i, record := range records {
		rowNum := i + 1
		validated, valErr := s.ValidateGateRecord(record)
		if valErr != nil {
			failed++
			rawData, _ := json.Marshal(record)
			fieldErrs, _ := json.Marshal(valErr.Errors)
			repository.CreateImportFailure(&model.ImportFailure{
				BatchID:       batchID,
				SourceType:    "gate_record",
				RowNumber:     rowNum,
				RawData:       string(rawData),
				FailureReason: "数据验证失败",
				FieldErrors:   string(fieldErrs),
			})
			continue
		}

		temp, _ := strconv.ParseFloat(validated["temperature"], 64)
		gr := &model.GateRecord{
			ID:            uuid.NewString(),
			BatchID:       batchID,
			GateName:      validated["gate_name"],
			PassDirection: validated["pass_direction"],
			PassTime:      parseTime(validated["pass_time"]),
			LicensePlate:  validated["license_plate"],
			VisitorName:   validated["visitor_name"],
			VisitorIDCard: validated["visitor_id_card"],
			Temperature:   temp,
			StaffName:     validated["staff_name"],
			Status:        "imported",
			MatchStatus:   "pending",
			CreatedBy:     userID,
		}
		if err := repository.CreateGateRecord(gr); err != nil {
			failed++
			rawData, _ := json.Marshal(record)
			repository.CreateImportFailure(&model.ImportFailure{
				BatchID:       batchID,
				SourceType:    "gate_record",
				RowNumber:     rowNum,
				RawData:       string(rawData),
				FailureReason: fmt.Sprintf("数据库错误: %v", err),
			})
		}
	}

	db := repository.GetDB()
	_, err := db.Exec(`UPDATE batches SET status = 'completed', total_records = ?, failed_records = ?, updated_at = ? WHERE id = ?`,
		total, failed, time.Now(), batchID)

	return &ImportResult{
		BatchID:       batchID,
		TotalRecords:  total,
		FailedRecords: failed,
	}, err
}

func (s *ReconciliationService) ImportPlateImages(batchName string, records []map[string]string, userID string) (*ImportResult, error) {
	batchID := uuid.NewString()
	batch := &model.Batch{
		ID:         batchID,
		Name:       batchName,
		Source:     "plate_image_import",
		Status:     "importing",
		CreatedBy:  userID,
	}
	if err := repository.CreateBatch(batch); err != nil {
		return nil, err
	}

	total := len(records)
	failed := 0

	for i, record := range records {
		rowNum := i + 1
		validated, valErr := s.ValidatePlateImage(record)
		if valErr != nil {
			failed++
			rawData, _ := json.Marshal(record)
			fieldErrs, _ := json.Marshal(valErr.Errors)
			repository.CreateImportFailure(&model.ImportFailure{
				BatchID:       batchID,
				SourceType:    "plate_image",
				RowNumber:     rowNum,
				RawData:       string(rawData),
				FailureReason: "数据验证失败",
				FieldErrors:   string(fieldErrs),
			})
			continue
		}

		conf, _ := strconv.ParseFloat(validated["recognition_confidence"], 64)
		pi := &model.TempPlateImage{
			ID:              uuid.NewString(),
			BatchID:         batchID,
			ImageFileName:   validated["image_file_name"],
			ImageHash:       validated["image_hash"],
			LicensePlate:    validated["license_plate"],
			RecognizedPlate: validated["recognized_plate"],
			RecognitionConf: conf,
			CaptureTime:     parseTime(validated["capture_time"]),
			CaptureGate:     validated["capture_gate"],
			Status:          "imported",
			MatchStatus:     "pending",
			CreatedBy:       userID,
		}
		if err := repository.CreatePlateImage(pi); err != nil {
			failed++
			rawData, _ := json.Marshal(record)
			repository.CreateImportFailure(&model.ImportFailure{
				BatchID:       batchID,
				SourceType:    "plate_image",
				RowNumber:     rowNum,
				RawData:       string(rawData),
				FailureReason: fmt.Sprintf("数据库错误: %v", err),
			})
		}
	}

	db := repository.GetDB()
	_, err := db.Exec(`UPDATE batches SET status = 'completed', total_records = ?, failed_records = ?, updated_at = ? WHERE id = ?`,
		total, failed, time.Now(), batchID)

	return &ImportResult{
		BatchID:       batchID,
		TotalRecords:  total,
		FailedRecords: failed,
	}, err
}

type ReconcileResult struct {
	ID                string
	TotalAppointments int
	TotalGateRecords  int
	TotalPlateImages  int
	MatchedCount      int
	UnmatchedCount    int
	CrossDayRiskCount int
	ExpiredNotRevoked int
	Details           []ReconcileDetail
}

type ReconcileDetail struct {
	Type         string `json:"type"`
	RecordID     string `json:"record_id"`
	RecordInfo   string `json:"record_info"`
	Issue        string `json:"issue"`
	RelatedAppt  string `json:"related_appt,omitempty"`
}

func (s *ReconciliationService) RunReconciliation(batchID string, userID string) (*ReconcileResult, error) {
	db := repository.GetDB()
	now := time.Now()

	appts, _, err := repository.ListAppointments(batchID, 0, 10000)
	if err != nil {
		return nil, err
	}

	gates, _, err := repository.ListGateRecords(batchID, 0, 10000)
	if err != nil {
		return nil, err
	}

	plates, _, err := repository.ListPlateImages(batchID, 0, 10000)
	if err != nil {
		return nil, err
	}

	matched := 0
	unmatched := 0
	crossDayRisk := 0
	expiredNotRevoked := 0
	var details []ReconcileDetail

	apptByPlate := make(map[string][]model.VisitorAppointment)
	apptByID := make(map[string]model.VisitorAppointment)
	for _, a := range appts {
		apptByID[a.ID] = a
		if a.LicensePlate != "" {
			apptByPlate[a.LicensePlate] = append(apptByPlate[a.LicensePlate], a)
		}
	}

	tx, err := db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	for i := range gates {
		g := &gates[i]
		matchFound := false

		if g.LicensePlate != "" {
			if candidates, ok := apptByPlate[g.LicensePlate]; ok {
				for _, appt := range candidates {
					if g.PassTime.After(appt.VisitDate.Add(-1*time.Hour)) && g.PassTime.Before(appt.VisitEndDate.Add(24*time.Hour)) {
						matchFound = true
						g.MatchedApptID = appt.ID
						g.MatchStatus = "matched"
						g.Reconciled = true
						matched++
						break
					}
				}
			}
		}

		if !matchFound {
			unmatched++
			g.MatchStatus = "unmatched"
			details = append(details, ReconcileDetail{
				Type:       "gate_unmatched",
				RecordID:   g.ID,
				RecordInfo: fmt.Sprintf("%s at %s", g.GateName, g.PassTime.Format("2006-01-02 15:04")),
				Issue:      "无匹配预约记录",
			})
		}

		_, err = tx.Exec(`UPDATE gate_records SET matched_appt_id = ?, match_status = ?, reconciled = 1 WHERE id = ?`,
			g.MatchedApptID, g.MatchStatus, g.ID)
		if err != nil {
			return nil, err
		}
	}

	for i := range plates {
		p := &plates[i]
		matchFound := false

		for _, g := range gates {
			if p.LicensePlate != "" && p.LicensePlate == g.LicensePlate {
				timeDiff := p.CaptureTime.Sub(g.PassTime)
				if timeDiff > -5*time.Minute && timeDiff < 5*time.Minute {
					matchFound = true
					p.MatchedGateID = g.ID
					p.MatchStatus = "matched"
					p.Reconciled = true
					break
				}
			}
		}

		if !matchFound {
			p.MatchStatus = "unmatched"
		}

		_, err = tx.Exec(`UPDATE temp_plate_images SET matched_gate_id = ?, match_status = ?, reconciled = 1 WHERE id = ?`,
			p.MatchedGateID, p.MatchStatus, p.ID)
		if err != nil {
			return nil, err
		}
	}

	for _, a := range appts {
		if a.VisitEndDate.Before(now.AddDate(0, 0, -1)) && a.Status != "revoked" && a.Status != "completed" {
			expiredNotRevoked++
			details = append(details, ReconcileDetail{
				Type:       "expired_not_revoked",
				RecordID:   a.ID,
				RecordInfo: fmt.Sprintf("%s - %s", a.VisitorName, a.LicensePlate),
				Issue:      fmt.Sprintf("预约已过期(%s)但权限未收回", a.VisitEndDate.Format("2006-01-02")),
			})
		}

		hasEntry := false
		hasExit := false
		for _, g := range gates {
			if g.MatchedApptID == a.ID {
				if g.PassDirection == "in" {
					hasEntry = true
				}
				if g.PassDirection == "out" {
					hasExit = true
				}
			}
		}
		if hasEntry && !hasExit && a.VisitEndDate.Before(now.AddDate(0, 0, -1)) {
			crossDayRisk++
			details = append(details, ReconcileDetail{
				Type:       "cross_day_risk",
				RecordID:   a.ID,
				RecordInfo: fmt.Sprintf("%s - %s", a.VisitorName, a.LicensePlate),
				Issue:      "跨日未出场，存在权限未收回风险",
			})
		}
	}

	resultID := uuid.NewString()
	result := &model.ReconciliationResult{
		ID:                resultID,
		BatchID:           batchID,
		ReconcileDate:     now,
		TotalAppointments: len(appts),
		TotalGateRecords:  len(gates),
		TotalPlateImages:  len(plates),
		MatchedCount:      matched,
		UnmatchedCount:    unmatched,
		CrossDayRiskCount: crossDayRisk,
		ExpiredNotRevoked: expiredNotRevoked,
		Status:            "completed",
		CreatedBy:         userID,
	}
	if err := repository.CreateReconciliationResult(result); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &ReconcileResult{
		ID:                resultID,
		TotalAppointments: len(appts),
		TotalGateRecords:  len(gates),
		TotalPlateImages:  len(plates),
		MatchedCount:      matched,
		UnmatchedCount:    unmatched,
		CrossDayRiskCount: crossDayRisk,
		ExpiredNotRevoked: expiredNotRevoked,
		Details:           details,
	}, nil
}

func (s *ReconciliationService) ExportReport(resultID string) (string, error) {
	db := repository.GetDB()
	var result model.ReconciliationResult
	err := db.QueryRow(
		`SELECT id, batch_id, reconcile_date, total_appointments, total_gate_records, total_plate_images,
		 matched_count, unmatched_count, cross_day_risk_count, expired_not_revoked, status, created_by, created_at
		 FROM reconciliation_results WHERE id = ?`,
		resultID,
	).Scan(&result.ID, &result.BatchID, &result.ReconcileDate, &result.TotalAppointments, &result.TotalGateRecords,
		&result.TotalPlateImages, &result.MatchedCount, &result.UnmatchedCount, &result.CrossDayRiskCount,
		&result.ExpiredNotRevoked, &result.Status, &result.CreatedBy, &result.CreatedAt)
	if err != nil {
		return "", err
	}

	reportDir := filepath.Join(config.AppConfig.DataDir, "reports")
	os.MkdirAll(reportDir, 0755)
	reportPath := filepath.Join(reportDir, fmt.Sprintf("reconcile_%s_%s.csv", resultID, time.Now().Format("20060102_150405")))

	file, err := os.Create(reportPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	w := csv.NewWriter(file)
	defer w.Flush()

	w.Write([]string{"对账汇总报表"})
	w.Write([]string{"对账ID", result.ID})
	w.Write([]string{"批次ID", result.BatchID})
	w.Write([]string{"对账时间", result.ReconcileDate.String()})
	w.Write([]string{})
	w.Write([]string{"指标", "数值"})
	w.Write([]string{"预约总数", strconv.Itoa(result.TotalAppointments)})
	w.Write([]string{"闸机记录总数", strconv.Itoa(result.TotalGateRecords)})
	w.Write([]string{"车牌抓拍总数", strconv.Itoa(result.TotalPlateImages)})
	w.Write([]string{"匹配成功数", strconv.Itoa(result.MatchedCount)})
	w.Write([]string{"未匹配数", strconv.Itoa(result.UnmatchedCount)})
	w.Write([]string{"跨日风险数", strconv.Itoa(result.CrossDayRiskCount)})
	w.Write([]string{"过期未收回数", strconv.Itoa(result.ExpiredNotRevoked)})

	return reportPath, nil
}

func (s *ReconciliationService) ReviewAppointment(apptID, reviewerID string) error {
	appt, err := repository.GetAppointment(apptID)
	if err != nil {
		return err
	}
	if appt == nil {
		return sql.ErrNoRows
	}
	if appt.IsFrozen {
		return fmt.Errorf("记录已冻结，无法修改")
	}

	now := time.Now()
	appt.Status = "reviewed"
	appt.ReviewedBy = reviewerID
	appt.ReviewedAt = &now

	return repository.UpdateAppointment(appt)
}
