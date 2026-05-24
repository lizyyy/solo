package services

import (
	"encoding/json"
	"fmt"
	"museum-exhibit-condition-api/database"
	"museum-exhibit-condition-api/models"
	"net/http"
)

type ReportService struct{}

func NewReportService() *ReportService {
	return &ReportService{}
}

func (s *ReportService) ExportJSON(w http.ResponseWriter, recordID int64) {
	var record models.ExhibitRecord
	database.DB.QueryRow(`SELECT id, exhibit_no, contract_no, current_version, liability_status, final_conclusion, created_at, updated_at, created_by, updated_by, idempotent_key FROM exhibit_records WHERE id = ?`, recordID).Scan(&record.ID, &record.ExhibitNo, &record.ContractNo, &record.CurrentVersion, &record.LiabilityStatus, &record.FinalConclusion, &record.CreatedAt, &record.UpdatedAt, &record.CreatedBy, &record.UpdatedBy, &record.IdempotentKey)
	versionRows, _ := database.DB.Query(`SELECT id, record_id, version, check_point, check_time, condition_desc, has_scratch, scratch_location, scratch_size, insurance_remark, handler, transport_node, created_at, prev_version_id, change_summary FROM condition_versions WHERE record_id = ? ORDER BY version DESC`, recordID)
	var versions []models.ConditionVersion
	for versionRows.Next() {
		var v models.ConditionVersion
		versionRows.Scan(&v.ID, &v.RecordID, &v.Version, &v.CheckPoint, &v.CheckTime, &v.ConditionDesc, &v.HasScratch, &v.ScratchLocation, &v.ScratchSize, &v.InsuranceRemark, &v.Handler, &v.TransportNode, &v.CreatedAt, &v.PrevVersionID, &v.ChangeSummary)
		versions = append(versions, v)
	}
	versionRows.Close()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Content-Disposition", "attachment; filename=report.json")
	json.NewEncoder(w).Encode(map[string]interface{}{"record": record, "versions": versions})
}

func (s *ReportService) ExportCSV(w http.ResponseWriter, recordID int64) {
	var record models.ExhibitRecord
	database.DB.QueryRow(`SELECT id, exhibit_no, contract_no, current_version, liability_status, final_conclusion, created_at, updated_at, created_by FROM exhibit_records WHERE id = ?`, recordID).Scan(&record.ID, &record.ExhibitNo, &record.ContractNo, &record.CurrentVersion, &record.LiabilityStatus, &record.FinalConclusion, &record.CreatedAt, &record.UpdatedAt, &record.CreatedBy)
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", "attachment; filename=report.csv")
	fmt.Fprintf(w, "Museum Exhibit Condition Report\n")
	fmt.Fprintf(w, "Generated,%s\n", record.UpdatedAt.Format("2006-01-02 15:04:05"))
	fmt.Fprintf(w, "\n【Basic Info】\n")
	fmt.Fprintf(w, "Exhibit No,%s\n", record.ExhibitNo)
	fmt.Fprintf(w, "Contract No,%s\n", record.ContractNo)
	fmt.Fprintf(w, "Status,%s\n", record.LiabilityStatus)
	fmt.Fprintf(w, "Conclusion,%s\n", record.FinalConclusion)
	fmt.Fprintf(w, "\n【Versions】\n")
	fmt.Fprintf(w, "Version,CheckPoint,CheckTime,HasScratch,Handler\n")
	versionRows, _ := database.DB.Query(`SELECT version, check_point, check_time, has_scratch, handler FROM condition_versions WHERE record_id = ? ORDER BY version`, recordID)
	for versionRows.Next() {
		var v models.ConditionVersion
		versionRows.Scan(&v.Version, &v.CheckPoint, &v.CheckTime, &v.HasScratch, &v.Handler)
		fmt.Fprintf(w, "%d,%s,%s,%v,%s\n", v.Version, v.CheckPoint, v.CheckTime.Format("2006-01-02 15:04:05"), v.HasScratch, v.Handler)
	}
	versionRows.Close()
}

func (s *ReportService) GetStatistics() (map[string]interface{}, error) {
	rows, _ := database.DB.Query(`SELECT liability_status, COUNT(*) FROM exhibit_records GROUP BY liability_status`)
	stats := make(map[string]int)
	var total int
	for rows.Next() {
		var status string
		var count int
		rows.Scan(&status, &count)
		stats[status] = count
		total += count
	}
	rows.Close()
	return map[string]interface{}{"total": total, "by_status": stats}, nil
}
