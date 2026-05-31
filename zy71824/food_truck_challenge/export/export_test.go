package export_test

import (
	"bytes"
	"encoding/csv"
	"encoding/json"
	"food_truck_challenge/engine"
	"food_truck_challenge/export"
	"food_truck_challenge/model"
	"strings"
	"testing"
)

func setupEngine() *engine.Engine {
	e := engine.New()
	e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, map[string]int{"score": 100})
	rec, _, _ := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-B", model.SourcePlayerFeedback, nil)
	e.MarkDisputed(rec.ID, "gm-li", model.RewardMissing, "奖励未到账")
	e.Ingest("batch-002", "断线恢复挑战", "player-C", model.SourcePlayerFeedback, nil)
	return e
}

func TestExportJSON(t *testing.T) {
	e := setupEngine()
	exp := export.NewExporter(e)

	var buf bytes.Buffer
	if err := exp.ExportJSON(&buf); err != nil {
		t.Fatalf("export JSON failed: %v", err)
	}

	var full export.FullExport
	if err := json.Unmarshal(buf.Bytes(), &full); err != nil {
		t.Fatalf("parse exported JSON failed: %v", err)
	}

	if full.Header.TotalRecords != 3 {
		t.Fatalf("should export 3 records, got %d", full.Header.TotalRecords)
	}
	if full.Header.Note == "" {
		t.Fatal("export should include a note for next shift")
	}

	for _, er := range full.Records {
		if er.Record.ID == "" {
			t.Fatal("each record should have an ID")
		}
		if len(er.Audits) == 0 {
			t.Fatal("each record should have at least 1 audit entry")
		}
		if er.Record.Status == model.StatusDisputed && er.WhyPending == "" {
			t.Fatal("disputed records should have why_pending explanation")
		}
	}
}

func TestExportCSV(t *testing.T) {
	e := setupEngine()
	exp := export.NewExporter(e)

	var buf bytes.Buffer
	if err := exp.ExportCSV(&buf); err != nil {
		t.Fatalf("export CSV failed: %v", err)
	}

	reader := csv.NewReader(&buf)
	rows, err := reader.ReadAll()
	if err != nil {
		t.Fatalf("parse CSV failed: %v", err)
	}

	if len(rows) < 2 {
		t.Fatal("CSV should have header + at least 1 data row")
	}

	headerRow := rows[0]
	requiredCols := []string{"record_id", "status", "source", "why_pending", "audit_summary"}
	for _, col := range requiredCols {
		found := false
		for _, h := range headerRow {
			if h == col {
				found = true
				break
			}
		}
		if !found {
			t.Fatalf("CSV missing required column: %s", col)
		}
	}

	if len(rows)-1 != 3 {
		t.Fatalf("CSV should have 3 data rows, got %d", len(rows)-1)
	}
}

func TestExportSummary(t *testing.T) {
	e := setupEngine()
	exp := export.NewExporter(e)

	var buf bytes.Buffer
	exp.ExportSummary(&buf)

	output := buf.String()
	if !strings.Contains(output, "餐车连锁挑战") {
		t.Fatal("summary should mention the challenge name")
	}
	if !strings.Contains(output, "按状态统计") {
		t.Fatal("summary should include status breakdown")
	}
	if !strings.Contains(output, "按争议原因统计") {
		t.Fatal("summary should include dispute reason breakdown")
	}
	if !strings.Contains(output, "record_id") {
		t.Fatal("summary should mention record_id for next shift lookups")
	}
}

func TestExportJSONContainsAuditDetail(t *testing.T) {
	e := engine.New()
	rec, _, _ := e.Ingest("batch-001", "餐车连锁挑战-Day1", "player-A", model.SourceActivityReview, nil)
	e.MarkDisputed(rec.ID, "gm-li", model.DisconnProgressLost, "断线导致进度丢失")
	e.Resolve(rec.ID, "gm-wang", "已核实补发")

	exp := export.NewExporter(e)
	var buf bytes.Buffer
	exp.ExportJSON(&buf)

	var full export.FullExport
	json.Unmarshal(buf.Bytes(), &full)

	if len(full.Records) != 1 {
		t.Fatal("should have 1 record")
	}

	audits := full.Records[0].Audits
	if len(audits) != 3 {
		t.Fatalf("should have 3 audit entries (ingest+dispute+resolve), got %d", len(audits))
	}

	disputeFound := false
	for _, a := range audits {
		if a.NewStatus == model.StatusDisputed && a.ChangedBy == "gm-li" {
			disputeFound = true
		}
	}
	if !disputeFound {
		t.Fatal("should find dispute audit entry with gm-li as changedBy")
	}
}
