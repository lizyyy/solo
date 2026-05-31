package export

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"food_truck_challenge/engine"
	"food_truck_challenge/model"
	"io"
	"sort"
	"strings"
	"time"
)

type Exporter struct {
	eng *engine.Engine
}

func NewExporter(e *engine.Engine) *Exporter {
	return &Exporter{eng: e}
}

type ExportHeader struct {
	ExportedAt   string `json:"exported_at"`
	TotalRecords int    `json:"total_records"`
	Note         string `json:"note"`
}

type FullExport struct {
	Header  ExportHeader   `json:"header"`
	Records []ExportRecord `json:"records"`
}

type ExportRecord struct {
	Record     model.EventRecord  `json:"record"`
	Audits     []model.AuditEntry `json:"audits"`
	WhyPending string             `json:"why_pending,omitempty"`
}

func (ex *Exporter) explainWhyPending(rec *model.EventRecord, trail []model.AuditEntry) string {
	if rec.Status != model.StatusPending && rec.Status != model.StatusReviewNeeded && rec.Status != model.StatusDisputed {
		return ""
	}
	var reasons []string
	for _, entry := range trail {
		if entry.NewStatus == model.StatusPending && entry.Reason == "initial_ingest" {
			reasons = append(reasons, fmt.Sprintf("ingested from %s at %s", entry.ChangedBy, entry.ChangedAt.Format("2006-01-02 15:04:05")))
		}
		if entry.NewStatus == model.StatusReviewNeeded {
			reasons = append(reasons, fmt.Sprintf("review_needed by %s: %s", entry.ChangedBy, entry.Detail))
		}
		if entry.NewStatus == model.StatusDisputed {
			reasons = append(reasons, fmt.Sprintf("disputed by %s: %s", entry.ChangedBy, entry.Detail))
		}
	}
	if len(reasons) == 0 {
		return "no specific reason recorded"
	}
	return strings.Join(reasons, "; ")
}

func (ex *Exporter) buildExportRecords() []ExportRecord {
	records := ex.eng.AllRecords()
	result := make([]ExportRecord, 0, len(records))
	for _, rec := range records {
		trail, _ := ex.eng.GetAuditTrail(rec.ID)
		er := ExportRecord{
			Record:     *rec,
			Audits:     trail,
			WhyPending: ex.explainWhyPending(rec, trail),
		}
		result = append(result, er)
	}
	return result
}

func (ex *Exporter) ExportJSON(w io.Writer) error {
	exportRecords := ex.buildExportRecords()
	header := ExportHeader{
		ExportedAt:   time.Now().Format(time.RFC3339),
		TotalRecords: len(exportRecords),
		Note:         "food_truck_challenge review export - next shift can continue from this file",
	}
	full := FullExport{
		Header:  header,
		Records: exportRecords,
	}
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ")
	return enc.Encode(full)
}

func (ex *Exporter) ExportCSV(w io.Writer) error {
	exportRecords := ex.buildExportRecords()

	headers := []string{
		"record_id", "batch_id", "challenge_name", "player_id",
		"source", "status", "dispute_reason", "review_note",
		"created_at", "updated_at", "fingerprint",
		"audit_count", "why_pending", "audit_summary",
	}

	cw := csv.NewWriter(w)
	if err := cw.Write(headers); err != nil {
		return err
	}

	for _, er := range exportRecords {
		var auditParts []string
		for _, a := range er.Audits {
			auditParts = append(auditParts, fmt.Sprintf("%s->%s by %s (%s)",
				a.OldStatus, a.NewStatus, a.ChangedBy, a.Reason))
		}
		dr := ""
		if er.Record.DisputeReason != nil {
			dr = string(*er.Record.DisputeReason)
		}
		row := []string{
			er.Record.ID,
			er.Record.BatchID,
			er.Record.ChallengeName,
			er.Record.PlayerID,
			string(er.Record.Source),
			string(er.Record.Status),
			dr,
			er.Record.ReviewNote,
			er.Record.CreatedAt.Format(time.RFC3339),
			er.Record.UpdatedAt.Format(time.RFC3339),
			er.Record.Fingerprint,
			fmt.Sprintf("%d", len(er.Audits)),
			er.WhyPending,
			strings.Join(auditParts, " | "),
		}
		if err := cw.Write(row); err != nil {
			return err
		}
	}
	cw.Flush()
	return cw.Error()
}

func (ex *Exporter) SummaryByStatus() map[string]int {
	records := ex.eng.AllRecords()
	counts := make(map[string]int)
	for _, rec := range records {
		counts[string(rec.Status)]++
	}
	return counts
}

func (ex *Exporter) SummaryByDisputeReason() map[string]int {
	records := ex.eng.AllRecords()
	counts := make(map[string]int)
	for _, rec := range records {
		if rec.DisputeReason != nil {
			counts[string(*rec.DisputeReason)]++
		}
	}
	return counts
}

func (ex *Exporter) ExportSummary(w io.Writer) {
	byStatus := ex.SummaryByStatus()
	byReason := ex.SummaryByDisputeReason()

	fmt.Fprintf(w, "=== 餐车连锁挑战 活动复盘摘要 ===\n")
	fmt.Fprintf(w, "导出时间: %s\n\n", time.Now().Format("2006-01-02 15:04:05"))

	statuses := make([]string, 0, len(byStatus))
	for s := range byStatus {
		statuses = append(statuses, s)
	}
	sort.Strings(statuses)
	fmt.Fprintf(w, "按状态统计:\n")
	for _, s := range statuses {
		fmt.Fprintf(w, "  %s: %d\n", s, byStatus[s])
	}

	reasons := make([]string, 0, len(byReason))
	for r := range byReason {
		reasons = append(reasons, r)
	}
	sort.Strings(reasons)
	fmt.Fprintf(w, "\n按争议原因统计:\n")
	for _, r := range reasons {
		fmt.Fprintf(w, "  %s: %d\n", r, byReason[r])
	}

	fmt.Fprintf(w, "\n说明: 以上数据包含完整审计轨迹，下一班可直接通过 record_id 查询详情。\n")
}
