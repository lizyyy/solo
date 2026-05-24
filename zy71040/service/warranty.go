package service

import (
	"crypto/md5"
	"database/sql"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"pv-inverter-warranty/store"
)

type WarrantyService struct {
	db *store.SQLiteDB
}

func NewWarrantyService(db *store.SQLiteDB) *WarrantyService {
	return &WarrantyService{db: db}
}

const (
	StatusDraft        = "draft"
	StatusVerifying    = "verifying"
	StatusVerified     = "verified"
	StatusReviewing    = "reviewing"
	StatusReviewed     = "reviewed"
	StatusAccepted     = "accepted"
	StatusRejected     = "rejected"
	StatusWarrantyFail = "warranty_failed"
)

var StatusTransitions = map[string][]string{
	StatusDraft:        {StatusVerified, StatusRejected, StatusWarrantyFail},
	StatusVerified:     {StatusReviewed, StatusRejected},
	StatusReviewed:     {StatusAccepted, StatusRejected},
	StatusAccepted:     {},
	StatusRejected:     {StatusDraft},
	StatusWarrantyFail: {},
}

func (s *WarrantyService) RegisterInverter(inv *Inverter) error {
	query := `INSERT INTO inverters (sn, model, manufacturer, production_date, installation_date, station, warranty_period_months) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, inv.SN, inv.Model, inv.Manufacturer, inv.ProductionDate, inv.InstallationDate, inv.Station, inv.WarrantyPeriodMonths)
	return err
}

func (s *WarrantyService) GetInverter(sn string) (*Inverter, error) {
	query := `SELECT sn, model, manufacturer, production_date, installation_date, station, warranty_period_months, created_at FROM inverters WHERE sn = ?`
	row := s.db.QueryRow(query, sn)
	var inv Inverter
	err := row.Scan(&inv.SN, &inv.Model, &inv.Manufacturer, &inv.ProductionDate, &inv.InstallationDate, &inv.Station, &inv.WarrantyPeriodMonths, &inv.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &inv, nil
}

func (s *WarrantyService) ListInverters() ([]Inverter, error) {
	query := `SELECT sn, model, manufacturer, production_date, installation_date, station, warranty_period_months, created_at FROM inverters`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var inverters []Inverter
	for rows.Next() {
		var inv Inverter
		err := rows.Scan(&inv.SN, &inv.Model, &inv.Manufacturer, &inv.ProductionDate, &inv.InstallationDate, &inv.Station, &inv.WarrantyPeriodMonths, &inv.CreatedAt)
		if err != nil {
			return nil, err
		}
		inverters = append(inverters, inv)
	}
	return inverters, nil
}

func (s *WarrantyService) RegisterFaultCode(fc *FaultCode) error {
	query := `INSERT INTO fault_codes (code, description, is_warranty_covered, severity) VALUES (?, ?, ?, ?)`
	isCovered := 0
	if fc.IsWarrantyCovered {
		isCovered = 1
	}
	_, err := s.db.Exec(query, fc.Code, fc.Description, isCovered, fc.Severity)
	return err
}

func (s *WarrantyService) GetFaultCode(code string) (*FaultCode, error) {
	query := `SELECT code, description, is_warranty_covered, severity, created_at FROM fault_codes WHERE code = ?`
	row := s.db.QueryRow(query, code)
	var fc FaultCode
	var isCovered int
	err := row.Scan(&fc.Code, &fc.Description, &isCovered, &fc.Severity, &fc.CreatedAt)
	if err != nil {
		return nil, err
	}
	fc.IsWarrantyCovered = isCovered == 1
	return &fc, nil
}

func (s *WarrantyService) ListFaultCodes() ([]FaultCode, error) {
	query := `SELECT code, description, is_warranty_covered, severity, created_at FROM fault_codes`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var codes []FaultCode
	for rows.Next() {
		var fc FaultCode
		var isCovered int
		err := rows.Scan(&fc.Code, &fc.Description, &isCovered, &fc.Severity, &fc.CreatedAt)
		if err != nil {
			return nil, err
		}
		fc.IsWarrantyCovered = isCovered == 1
		codes = append(codes, fc)
	}
	return codes, nil
}

func (s *WarrantyService) RegisterSparePart(sp *SparePart) (*SparePart, error) {
	exists, err := s.checkSerialNumberExists(sp.SN)
	if err != nil {
		return nil, fmt.Errorf("检查序列号失败: %v", err)
	}
	if exists {
		return nil, fmt.Errorf("序列号 %s 已存在，禁止重复登记", sp.SN)
	}

	query := `INSERT INTO spare_parts (sn, type, model, manufacturer, production_date, status) VALUES (?, ?, ?, ?, ?, ?)`
	_, err = s.db.Exec(query, sp.SN, sp.Type, sp.Model, sp.Manufacturer, sp.ProductionDate, sp.Status)
	if err != nil {
		return nil, err
	}
	return s.GetSparePart(sp.SN)
}

func (s *WarrantyService) checkSerialNumberExists(sn string) (bool, error) {
	var count int
	query := `SELECT COUNT(*) FROM spare_parts WHERE sn = ?`
	err := s.db.QueryRow(query, sn).Scan(&count)
	if err != nil {
		return false, err
	}
	return count > 0, nil
}

func (s *WarrantyService) GetSparePart(sn string) (*SparePart, error) {
	query := `SELECT sn, type, model, manufacturer, production_date, status, created_at FROM spare_parts WHERE sn = ?`
	row := s.db.QueryRow(query, sn)
	var sp SparePart
	err := row.Scan(&sp.SN, &sp.Type, &sp.Model, &sp.Manufacturer, &sp.ProductionDate, &sp.Status, &sp.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &sp, nil
}

func (s *WarrantyService) ListSpareParts() ([]SparePart, error) {
	query := `SELECT sn, type, model, manufacturer, production_date, status, created_at FROM spare_parts`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var parts []SparePart
	for rows.Next() {
		var sp SparePart
		err := rows.Scan(&sp.SN, &sp.Type, &sp.Model, &sp.Manufacturer, &sp.ProductionDate, &sp.Status, &sp.CreatedAt)
		if err != nil {
			return nil, err
		}
		parts = append(parts, sp)
	}
	return parts, nil
}

func (s *WarrantyService) RegisterFactoryOrder(fo *FactoryOrder) error {
	query := `INSERT INTO factory_orders (id, inverter_sn, fault_code, spare_part_sn, issue_date, description, status) VALUES (?, ?, ?, ?, ?, ?, ?)`
	_, err := s.db.Exec(query, fo.ID, fo.InverterSN, fo.FaultCode, fo.SparePartSN, fo.IssueDate, fo.Description, fo.Status)
	return err
}

func (s *WarrantyService) GetFactoryOrder(id string) (*FactoryOrder, error) {
	query := `SELECT id, inverter_sn, fault_code, spare_part_sn, issue_date, description, status, created_at FROM factory_orders WHERE id = ?`
	row := s.db.QueryRow(query, id)
	var fo FactoryOrder
	err := row.Scan(&fo.ID, &fo.InverterSN, &fo.FaultCode, &fo.SparePartSN, &fo.IssueDate, &fo.Description, &fo.Status, &fo.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &fo, nil
}

func (s *WarrantyService) ListFactoryOrders() ([]FactoryOrder, error) {
	query := `SELECT id, inverter_sn, fault_code, spare_part_sn, issue_date, description, status, created_at FROM factory_orders`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var orders []FactoryOrder
	for rows.Next() {
		var fo FactoryOrder
		err := rows.Scan(&fo.ID, &fo.InverterSN, &fo.FaultCode, &fo.SparePartSN, &fo.IssueDate, &fo.Description, &fo.Status, &fo.CreatedAt)
		if err != nil {
			return nil, err
		}
		orders = append(orders, fo)
	}
	return orders, nil
}

func (s *WarrantyService) CreateReplacement(rep *Replacement) (*Replacement, error) {
	var validationErrors []string

	if _, err := s.GetInverter(rep.InverterSN); err != nil {
		validationErrors = append(validationErrors, fmt.Sprintf("逆变器序列号 %s 不存在", rep.InverterSN))
	}

	if _, err := s.GetFaultCode(rep.FaultCode); err != nil {
		validationErrors = append(validationErrors, fmt.Sprintf("故障码 %s 不存在", rep.FaultCode))
	}

	if rep.SparePartSN != "" {
		if _, err := s.GetSparePart(rep.SparePartSN); err != nil {
			validationErrors = append(validationErrors, fmt.Sprintf("备件序列号 %s 不存在", rep.SparePartSN))
		}
	}

	if rep.FactoryOrderID != "" {
		if _, err := s.GetFactoryOrder(rep.FactoryOrderID); err != nil {
			validationErrors = append(validationErrors, fmt.Sprintf("厂家工单 %s 不存在", rep.FactoryOrderID))
		}
	}

	if len(validationErrors) > 0 {
		return nil, fmt.Errorf("材料预校验失败: %s", strings.Join(validationErrors, "; "))
	}

	tx, err := s.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	query := `INSERT INTO replacements (id, inverter_sn, new_inverter_sn, fault_code, spare_part_sn, factory_order_id, old_inverter_photo_url, new_inverter_photo_url, fault_photo_url, warranty_certificate_url, replacement_date, technician, remark, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`

	var newInvSN, sparePartSN, factoryOrderID interface{}
	if rep.NewInverterSN != "" {
		newInvSN = rep.NewInverterSN
	}
	if rep.SparePartSN != "" {
		sparePartSN = rep.SparePartSN
	}
	if rep.FactoryOrderID != "" {
		factoryOrderID = rep.FactoryOrderID
	}

	_, err = tx.Exec(query, rep.ID, rep.InverterSN, newInvSN, rep.FaultCode, sparePartSN, factoryOrderID, rep.OldInverterPhotoURL, rep.NewInverterPhotoURL, rep.FaultPhotoURL, rep.WarrantyCertificateURL, rep.ReplacementDate, rep.Technician, rep.Remark, StatusDraft)
	if err != nil {
		return nil, err
	}

	initialEvidence := []Evidence{
		{EvidenceType: "inverter_sn", EvidenceValue: rep.InverterSN, Operator: rep.Technician},
		{EvidenceType: "fault_code", EvidenceValue: rep.FaultCode, Operator: rep.Technician},
	}
	if rep.SparePartSN != "" {
		initialEvidence = append(initialEvidence, Evidence{EvidenceType: "spare_part_sn", EvidenceValue: rep.SparePartSN, Operator: rep.Technician})
	}
	if rep.FactoryOrderID != "" {
		initialEvidence = append(initialEvidence, Evidence{EvidenceType: "factory_order_id", EvidenceValue: rep.FactoryOrderID, Operator: rep.Technician})
	}
	if rep.OldInverterPhotoURL != "" {
		initialEvidence = append(initialEvidence, Evidence{EvidenceType: "old_inverter_photo", EvidenceValue: rep.OldInverterPhotoURL, FileURL: rep.OldInverterPhotoURL, Operator: rep.Technician})
	}
	if rep.FaultPhotoURL != "" {
		initialEvidence = append(initialEvidence, Evidence{EvidenceType: "fault_photo", EvidenceValue: rep.FaultPhotoURL, FileURL: rep.FaultPhotoURL, Operator: rep.Technician})
	}
	if rep.WarrantyCertificateURL != "" {
		initialEvidence = append(initialEvidence, Evidence{EvidenceType: "warranty_certificate", EvidenceValue: rep.WarrantyCertificateURL, FileURL: rep.WarrantyCertificateURL, Operator: rep.Technician})
	}

	for _, ev := range initialEvidence {
		_, err = tx.Exec(`INSERT INTO evidence_chain (replacement_id, evidence_type, evidence_value, file_url, operator) VALUES (?, ?, ?, ?, ?)`, rep.ID, ev.EvidenceType, ev.EvidenceValue, ev.FileURL, ev.Operator)
		if err != nil {
			return nil, err
		}
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return s.GetReplacement(rep.ID)
}

func (s *WarrantyService) canTransition(from, to string) bool {
	allowed, ok := StatusTransitions[from]
	if !ok {
		return false
	}
	for _, a := range allowed {
		if a == to {
			return true
		}
	}
	return false
}

func (s *WarrantyService) transitionStatus(replacementID, fromStatus, toStatus, operator, remark string) error {
	if !s.canTransition(fromStatus, toStatus) {
		return fmt.Errorf("状态流转不合法: %s -> %s", fromStatus, toStatus)
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`UPDATE replacements SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, toStatus, replacementID)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`INSERT INTO replacement_status_logs (replacement_id, from_status, to_status, operator, remark) VALUES (?, ?, ?, ?, ?)`, replacementID, fromStatus, toStatus, operator, remark)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *WarrantyService) VerifyReplacement(id string, req *VerificationRequest) (string, error) {
	rep, err := s.GetReplacement(id)
	if err != nil {
		return "", err
	}

	if rep.Status != StatusDraft {
		return "", fmt.Errorf("只有草稿状态才能发起核对")
	}

	var notes []string
	var hasCriticalError bool

	fc, err := s.GetFaultCode(rep.FaultCode)
	if err != nil {
		notes = append(notes, fmt.Sprintf("故障码 %s 不存在", rep.FaultCode))
		hasCriticalError = true
	} else if !fc.IsWarrantyCovered {
		notes = append(notes, fmt.Sprintf("故障码 %s 不在质保范围内: %s", fc.Code, fc.Description))
		if err := s.transitionStatus(id, rep.Status, StatusWarrantyFail, req.Operator, req.Remark); err != nil {
			return "", err
		}
		notes = append(notes, "状态已变更为: 质保失败")
		result := strings.Join(notes, "; ")
		s.db.Exec(`UPDATE replacements SET verification_result = ? WHERE id = ?`, result, id)
		return result, fmt.Errorf("故障码不在质保范围内")
	} else {
		notes = append(notes, fmt.Sprintf("故障码 %s 验证通过，在质保范围内", fc.Code))
	}

	if rep.SparePartSN != "" {
		sp, err := s.GetSparePart(rep.SparePartSN)
		if err != nil {
			notes = append(notes, fmt.Sprintf("备件序列号 %s 不存在", rep.SparePartSN))
			hasCriticalError = true
		} else if sp.Status != "available" {
			notes = append(notes, fmt.Sprintf("备件 %s 状态为 %s，不可用", sp.SN, sp.Status))
			hasCriticalError = true
		} else {
			notes = append(notes, fmt.Sprintf("备件 %s 验证通过，状态可用", sp.SN))
		}
	}

	if hasCriticalError {
		notes = append(notes, "核对失败，存在关键材料问题，状态保持为 draft")
		result := strings.Join(notes, "; ")
		s.db.Exec(`UPDATE replacements SET verification_result = ? WHERE id = ?`, result, id)
		return result, fmt.Errorf("明细核对未通过: %s", result)
	}

	notes = append(notes, "证据链完整度检查: 已收集故障码、逆变器序列号、备件信息")

	if err := s.transitionStatus(id, rep.Status, StatusVerified, req.Operator, req.Remark); err != nil {
		return "", err
	}
	notes = append(notes, "状态已变更为: 已核对")

	result := strings.Join(notes, "; ")
	_, err = s.db.Exec(`UPDATE replacements SET verification_result = ? WHERE id = ?`, result, id)
	return result, err
}

func (s *WarrantyService) ReviewReplacement(id string, req *ReviewRequest) error {
	rep, err := s.GetReplacement(id)
	if err != nil {
		return err
	}

	if rep.Status != StatusVerified {
		return fmt.Errorf("只有已核对状态才能发起复核")
	}

	if req.Approved {
		if err := s.transitionStatus(id, rep.Status, StatusReviewed, req.Operator, req.Remark); err != nil {
			return err
		}
		_, err = s.db.Exec(`UPDATE replacements SET review_result = ? WHERE id = ?`, "复核通过", id)
		return err
	}

	if err := s.transitionStatus(id, rep.Status, StatusRejected, req.Operator, req.Remark); err != nil {
		return err
	}
	_, err = s.db.Exec(`UPDATE replacements SET review_result = ? WHERE id = ?`, "复核驳回", id)
	return err
}

func (s *WarrantyService) AcceptReplacement(id string, req *AcceptanceRequest) error {
	rep, err := s.GetReplacement(id)
	if err != nil {
		return err
	}

	if rep.Status != StatusReviewed {
		return fmt.Errorf("只有已复核状态才能发起验收")
	}

	if req.Approved {
		if err := s.transitionStatus(id, rep.Status, StatusAccepted, req.Operator, req.Remark); err != nil {
			return err
		}
		_, err = s.db.Exec(`UPDATE replacements SET acceptance_result = ? WHERE id = ?`, "验收通过", id)
		if err != nil {
			return err
		}

		if rep.SparePartSN != "" {
			_, err = s.db.Exec(`UPDATE spare_parts SET status = 'used' WHERE sn = ?`, rep.SparePartSN)
			if err != nil {
				return err
			}
		}

		return s.GenerateWarrantyReport(id)
	}

	if err := s.transitionStatus(id, rep.Status, StatusRejected, req.Operator, req.Remark); err != nil {
		return err
	}
	_, err = s.db.Exec(`UPDATE replacements SET acceptance_result = ? WHERE id = ?`, "验收驳回", id)
	return err
}

func (s *WarrantyService) RejectReplacement(id string, req *AcceptanceRequest) error {
	rep, err := s.GetReplacement(id)
	if err != nil {
		return err
	}

	return s.transitionStatus(id, rep.Status, StatusRejected, req.Operator, req.Remark)
}

func (s *WarrantyService) UpdateEvidence(id string, req *EvidenceUpdateRequest) error {
	rep, err := s.GetReplacement(id)
	if err != nil {
		return err
	}

	if rep.Status == StatusAccepted {
		return fmt.Errorf("已验收的记录不能更新证据")
	}

	tx, err := s.db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	_, err = tx.Exec(`DELETE FROM evidence_chain WHERE replacement_id = ? AND evidence_type = ?`, id, req.EvidenceType)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`INSERT INTO evidence_chain (replacement_id, evidence_type, evidence_value, file_url, operator) VALUES (?, ?, ?, ?, ?)`, id, req.EvidenceType, req.EvidenceValue, req.FileURL, req.Operator)
	if err != nil {
		return err
	}

	_, err = tx.Exec(`UPDATE replacements SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`, id)
	if err != nil {
		return err
	}

	return tx.Commit()
}

func (s *WarrantyService) GetReplacement(id string) (*Replacement, error) {
	query := `SELECT id, inverter_sn, new_inverter_sn, fault_code, spare_part_sn, factory_order_id, old_inverter_photo_url, new_inverter_photo_url, fault_photo_url, warranty_certificate_url, replacement_date, technician, remark, status, verification_result, review_result, acceptance_result, created_at, updated_at FROM replacements WHERE id = ?`
	row := s.db.QueryRow(query, id)
	var rep Replacement
	var newInvSN, sparePartSN, factoryOrderID, oldPhoto, newPhoto, faultPhoto, warrantyCert, repDate, tech, remark, verResult, revResult, accResult sql.NullString
	err := row.Scan(&rep.ID, &rep.InverterSN, &newInvSN, &rep.FaultCode, &sparePartSN, &factoryOrderID, &oldPhoto, &newPhoto, &faultPhoto, &warrantyCert, &repDate, &tech, &remark, &rep.Status, &verResult, &revResult, &accResult, &rep.CreatedAt, &rep.UpdatedAt)
	if err != nil {
		return nil, err
	}
	rep.NewInverterSN = newInvSN.String
	rep.SparePartSN = sparePartSN.String
	rep.FactoryOrderID = factoryOrderID.String
	rep.OldInverterPhotoURL = oldPhoto.String
	rep.NewInverterPhotoURL = newPhoto.String
	rep.FaultPhotoURL = faultPhoto.String
	rep.WarrantyCertificateURL = warrantyCert.String
	rep.ReplacementDate = repDate.String
	rep.Technician = tech.String
	rep.Remark = remark.String
	rep.VerificationResult = verResult.String
	rep.ReviewResult = revResult.String
	rep.AcceptanceResult = accResult.String

	rep.StatusLogs, _ = s.getStatusLogs(id)
	rep.EvidenceChain, _ = s.getEvidenceChain(id)

	return &rep, nil
}

func (s *WarrantyService) getStatusLogs(replacementID string) ([]StatusLog, error) {
	query := `SELECT id, from_status, to_status, operator, remark, created_at FROM replacement_status_logs WHERE replacement_id = ? ORDER BY created_at`
	rows, err := s.db.Query(query, replacementID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var logs []StatusLog
	for rows.Next() {
		var log StatusLog
		var remark sql.NullString
		err := rows.Scan(&log.ID, &log.FromStatus, &log.ToStatus, &log.Operator, &remark, &log.CreatedAt)
		if err != nil {
			return nil, err
		}
		log.Remark = remark.String
		logs = append(logs, log)
	}
	return logs, nil
}

func (s *WarrantyService) getEvidenceChain(replacementID string) ([]Evidence, error) {
	query := `SELECT id, evidence_type, evidence_value, file_url, operator, created_at FROM evidence_chain WHERE replacement_id = ? ORDER BY created_at`
	rows, err := s.db.Query(query, replacementID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var evidence []Evidence
	for rows.Next() {
		var ev Evidence
		var fileURL, operator sql.NullString
		err := rows.Scan(&ev.ID, &ev.EvidenceType, &ev.EvidenceValue, &fileURL, &operator, &ev.CreatedAt)
		if err != nil {
			return nil, err
		}
		ev.FileURL = fileURL.String
		ev.Operator = operator.String
		evidence = append(evidence, ev)
	}
	return evidence, nil
}

func (s *WarrantyService) ListReplacements() ([]Replacement, error) {
	query := `SELECT id, inverter_sn, new_inverter_sn, fault_code, spare_part_sn, factory_order_id, status, created_at, updated_at FROM replacements ORDER BY created_at DESC`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var reps []Replacement
	for rows.Next() {
		var rep Replacement
		var newInvSN, sparePartSN, factoryOrderID sql.NullString
		err := rows.Scan(&rep.ID, &rep.InverterSN, &newInvSN, &rep.FaultCode, &sparePartSN, &factoryOrderID, &rep.Status, &rep.CreatedAt, &rep.UpdatedAt)
		if err != nil {
			return nil, err
		}
		rep.NewInverterSN = newInvSN.String
		rep.SparePartSN = sparePartSN.String
		rep.FactoryOrderID = factoryOrderID.String
		reps = append(reps, rep)
	}
	return reps, nil
}

func (s *WarrantyService) GenerateWarrantyReport(replacementID string) error {
	rep, err := s.GetReplacement(replacementID)
	if err != nil {
		return err
	}

	inv, err := s.GetInverter(rep.InverterSN)
	if err != nil {
		return err
	}

	fc, err := s.GetFaultCode(rep.FaultCode)
	if err != nil {
		return err
	}

	reportID := generateID("RPT")
	reportNum := fmt.Sprintf("WR-%s-%s", time.Now().Format("20060102"), strings.ToUpper(replacementID[:8]))

	content := fmt.Sprintf(`
光伏逆变器质保报告
==================
报告编号: %s
生成时间: %s

一、基础信息
-----------
更换记录ID: %s
电站: %s
技术人员: %s
更换日期: %s

二、故障逆变器信息
-----------------
序列号: %s
型号: %s
厂家: %s
生产日期: %s
质保期: %d个月

三、故障信息
-----------
故障码: %s
故障描述: %s
质保覆盖: %v
严重程度: %s

四、备件信息
-----------
备件序列号: %s

五、处理流程
-----------
状态: %s
核对结果: %s
复核结果: %s
验收结果: %s

六、证据链
---------
`, reportNum, time.Now().Format("2006-01-02 15:04:05"),
		rep.ID, inv.Station, rep.Technician, rep.ReplacementDate,
		inv.SN, inv.Model, inv.Manufacturer, inv.ProductionDate, inv.WarrantyPeriodMonths,
		fc.Code, fc.Description, fc.IsWarrantyCovered, fc.Severity,
		rep.SparePartSN,
		rep.Status, rep.VerificationResult, rep.ReviewResult, rep.AcceptanceResult)

	for _, ev := range rep.EvidenceChain {
		content += fmt.Sprintf("  - [%s] %s (操作人: %s)\n", ev.EvidenceType, ev.EvidenceValue, ev.Operator)
	}

	content += "\n本报告由系统自动生成，具有可追溯性。"

	query := `INSERT INTO warranty_reports (id, replacement_id, report_number, content) VALUES (?, ?, ?, ?)`
	_, err = s.db.Exec(query, reportID, replacementID, reportNum, content)
	return err
}

func (s *WarrantyService) GetWarrantyReport(id string) (*WarrantyReport, error) {
	query := `SELECT id, replacement_id, report_number, content, generated_at FROM warranty_reports WHERE id = ?`
	row := s.db.QueryRow(query, id)
	var r WarrantyReport
	err := row.Scan(&r.ID, &r.ReplacementID, &r.ReportNumber, &r.Content, &r.GeneratedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *WarrantyService) GetWarrantyReportByReplacement(replacementID string) (*WarrantyReport, error) {
	query := `SELECT id, replacement_id, report_number, content, generated_at FROM warranty_reports WHERE replacement_id = ?`
	row := s.db.QueryRow(query, replacementID)
	var r WarrantyReport
	err := row.Scan(&r.ID, &r.ReplacementID, &r.ReportNumber, &r.Content, &r.GeneratedAt)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

func (s *WarrantyService) ListWarrantyReports() ([]WarrantyReport, error) {
	query := `SELECT id, replacement_id, report_number, generated_at FROM warranty_reports ORDER BY generated_at DESC`
	rows, err := s.db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var reports []WarrantyReport
	for rows.Next() {
		var r WarrantyReport
		err := rows.Scan(&r.ID, &r.ReplacementID, &r.ReportNumber, &r.GeneratedAt)
		if err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, nil
}

func (s *WarrantyService) TraceRecord(id string) (*TraceResult, error) {
	rep, err := s.GetReplacement(id)
	if err != nil {
		return nil, err
	}

	inv, err := s.GetInverter(rep.InverterSN)
	if err != nil {
		return nil, err
	}

	fc, err := s.GetFaultCode(rep.FaultCode)
	if err != nil {
		return nil, err
	}

	result := &TraceResult{
		Replacement:       *rep,
		Inverter:          *inv,
		FaultCode:         *fc,
		VerificationNotes: rep.VerificationResult,
	}

	if rep.NewInverterSN != "" {
		newInv, _ := s.GetInverter(rep.NewInverterSN)
		result.NewInverter = newInv
	}

	if rep.SparePartSN != "" {
		sp, _ := s.GetSparePart(rep.SparePartSN)
		result.SparePart = sp
	}

	if rep.FactoryOrderID != "" {
		fo, _ := s.GetFactoryOrder(rep.FactoryOrderID)
		result.FactoryOrder = fo
	}

	rpt, _ := s.GetWarrantyReportByReplacement(id)
	result.WarrantyReport = rpt

	return result, nil
}

func (s *WarrantyService) GetSummaryReport() (*SummaryReport, error) {
	summary := &SummaryReport{
		ByStatus:    make(map[string]int),
		ByFaultCode: make(map[string]int),
	}

	rows, err := s.db.Query(`SELECT status, fault_code FROM replacements`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var status, faultCode string
		if err := rows.Scan(&status, &faultCode); err != nil {
			return nil, err
		}
		summary.TotalReplacements++
		summary.ByStatus[status]++
		summary.ByFaultCode[faultCode]++

		if status == StatusAccepted {
			summary.InWarranty++
		} else if status == StatusWarrantyFail {
			summary.OutOfWarranty++
		}

		if status != StatusAccepted && status != StatusWarrantyFail {
			summary.UnacceptedReplacements = append(summary.UnacceptedReplacements, faultCode)
		}
	}

	dupRows, err := s.db.Query(`SELECT sn FROM spare_parts GROUP BY sn HAVING COUNT(*) > 1`)
	if err != nil {
		return nil, err
	}
	defer dupRows.Close()

	for dupRows.Next() {
		var sn string
		if err := dupRows.Scan(&sn); err != nil {
			return nil, err
		}
		summary.DuplicateSerialNumbers = append(summary.DuplicateSerialNumbers, sn)
	}

	return summary, nil
}

func (s *WarrantyService) SelfCheck() (map[string]interface{}, error) {
	result := make(map[string]interface{})
	result["status"] = "ok"
	result["timestamp"] = time.Now().Format(time.RFC3339)

	dbVersion := ""
	s.db.QueryRow(`SELECT sqlite_version()`).Scan(&dbVersion)
	result["database"] = map[string]string{
		"type":    "SQLite",
		"version": dbVersion,
	}

	var invCount, fcCount, spCount, foCount, repCount, rptCount int
	s.db.QueryRow(`SELECT COUNT(*) FROM inverters`).Scan(&invCount)
	s.db.QueryRow(`SELECT COUNT(*) FROM fault_codes`).Scan(&fcCount)
	s.db.QueryRow(`SELECT COUNT(*) FROM spare_parts`).Scan(&spCount)
	s.db.QueryRow(`SELECT COUNT(*) FROM factory_orders`).Scan(&foCount)
	s.db.QueryRow(`SELECT COUNT(*) FROM replacements`).Scan(&repCount)
	s.db.QueryRow(`SELECT COUNT(*) FROM warranty_reports`).Scan(&rptCount)

	result["data"] = map[string]int{
		"inverters":        invCount,
		"fault_codes":      fcCount,
		"spare_parts":      spCount,
		"factory_orders":   foCount,
		"replacements":     repCount,
		"warranty_reports": rptCount,
	}

	issues := []string{}
	if fcCount == 0 {
		issues = append(issues, "未配置任何故障码")
	}
	if spCount == 0 {
		issues = append(issues, "未登记任何备件")
	}

	var dupCount int
	s.db.QueryRow(`SELECT COUNT(*) FROM (SELECT sn FROM spare_parts GROUP BY sn HAVING COUNT(*) > 1)`).Scan(&dupCount)
	if dupCount > 0 {
		issues = append(issues, fmt.Sprintf("发现 %d 个重复序列号", dupCount))
	}

	var unacceptedCount int
	s.db.QueryRow(`SELECT COUNT(*) FROM replacements WHERE status NOT IN ('accepted', 'warranty_failed')`).Scan(&unacceptedCount)
	if unacceptedCount > 0 {
		issues = append(issues, fmt.Sprintf("有 %d 条记录未完成验收", unacceptedCount))
	}

	result["issues"] = issues
	result["health_score"] = 100 - len(issues)*20

	return result, nil
}

func (s *WarrantyService) SeedData() error {
	inverters := []Inverter{
		{SN: "INV20240001", Model: "SUN-20K", Manufacturer: "Sungrow", ProductionDate: "2024-01-15", InstallationDate: "2024-02-01", Station: "阳光电站A区", WarrantyPeriodMonths: 24},
		{SN: "INV20240002", Model: "SUN-30K", Manufacturer: "Sungrow", ProductionDate: "2024-01-20", InstallationDate: "2024-02-05", Station: "阳光电站B区", WarrantyPeriodMonths: 24},
		{SN: "INV20240003", Model: "SUN-50K", Manufacturer: "Huawei", ProductionDate: "2024-02-01", InstallationDate: "2024-02-15", Station: "阳光电站C区", WarrantyPeriodMonths: 36},
	}
	for _, inv := range inverters {
		s.RegisterInverter(&inv)
	}

	faultCodes := []FaultCode{
		{Code: "E001", Description: "IGBT过流故障", IsWarrantyCovered: true, Severity: "high"},
		{Code: "E002", Description: "直流过压故障", IsWarrantyCovered: true, Severity: "high"},
		{Code: "E003", Description: "交流短路故障", IsWarrantyCovered: true, Severity: "critical"},
		{Code: "E999", Description: "人为损坏-雷击", IsWarrantyCovered: false, Severity: "critical"},
		{Code: "E998", Description: "过保设备故障", IsWarrantyCovered: false, Severity: "medium"},
	}
	for _, fc := range faultCodes {
		s.RegisterFaultCode(&fc)
	}

	spareParts := []SparePart{
		{SN: "SP202405001", Type: "IGBT模块", Model: "FF450R12ME4", Manufacturer: "Infineon", ProductionDate: "2024-03-01", Status: "available"},
		{SN: "SP202405002", Type: "风扇", Model: "FBK08F24H", Manufacturer: "Sanyo", ProductionDate: "2024-03-05", Status: "available"},
		{SN: "SP202405003", Type: "电容", Model: "B43564", Manufacturer: "Epcos", ProductionDate: "2024-03-10", Status: "available"},
	}
	for _, sp := range spareParts {
		s.RegisterSparePart(&sp)
	}

	factoryOrders := []FactoryOrder{
		{ID: "FO202405001", InverterSN: "INV20240001", FaultCode: "E001", SparePartSN: "SP202405001", IssueDate: "2024-05-01", Description: "IGBT故障更换申请", Status: "approved"},
	}
	for _, fo := range factoryOrders {
		s.RegisterFactoryOrder(&fo)
	}

	return nil
}

func generateID(prefix string) string {
	h := md5.New()
	h.Write([]byte(time.Now().String()))
	return prefix + strings.ToUpper(hex.EncodeToString(h.Sum(nil))[:16])
}

func JSONResponse(data interface{}) APIResponse {
	return APIResponse{Success: true, Message: "操作成功", Data: data}
}

func JSONError(msg string, err error) APIResponse {
	errMsg := msg
	if err != nil {
		errMsg = fmt.Sprintf("%s: %v", msg, err)
	}
	return APIResponse{Success: false, Error: errMsg}
}

func JSONResponseWithMessage(data interface{}, msg string) APIResponse {
	return APIResponse{Success: true, Message: msg, Data: data}
}
