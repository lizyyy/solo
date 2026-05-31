package cmd

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"strconv"
	"strings"

	"coastline/db"

	"crypto/sha256"

	"github.com/spf13/cobra"
)

var importCmd = &cobra.Command{
	Use:   "import <file>",
	Short: "导入测绘记录（支持 CSV/JSON）",
	Args:  cobra.ExactArgs(1),
	RunE:  runImport,
}

var importOperator string

func init() {
	importCmd.Flags().StringVarP(&importOperator, "operator", "o", "", "操作人（必填）")
	importCmd.MarkFlagRequired("operator")
}

func runImport(cmd *cobra.Command, args []string) error {
	d, err := db.Open(dbPath)
	if err != nil {
		return err
	}
	defer d.Close()

	f, err := os.Open(args[0])
	if err != nil {
		return fmt.Errorf("打开文件失败: %w", err)
	}
	defer f.Close()

	var records []db.Record
	ext := strings.ToLower(args[0])
	if strings.HasSuffix(ext, ".csv") {
		records, err = parseCSV(f)
	} else if strings.HasSuffix(ext, ".json") {
		records, err = parseJSON(f)
	} else {
		return fmt.Errorf("不支持的文件格式，请使用 CSV 或 JSON")
	}
	if err != nil {
		return fmt.Errorf("解析文件失败: %w", err)
	}

	imported := 0
	alerted := 0
	for i := range records {
		r := &records[i]
		if r.Operator == "" {
			r.Operator = importOperator
		}
		if r.Status == "" {
			r.Status = "imported"
		}
		r.Version = 1
		r.ContentHash = hashRecord(r)

		existing, err := d.FindBySourceLocation(r.Source, r.Location)
		if err != nil {
			return fmt.Errorf("查询已有记录失败: %w", err)
		}

		if existing != nil {
			if existing.ContentHash == r.ContentHash {
				fmt.Printf("  跳过 #%d [%s/%s]：内容未变\n", existing.ID, r.Source, r.Location)
				continue
			}

			r.Version = existing.Version + 1
			id, err := d.InsertRecord(r)
			if err != nil {
				return fmt.Errorf("插入记录失败: %w", err)
			}
			alerted++
			diffs := diffFields(existing, r)
			for _, df := range diffs {
				cl := &db.ChangeLog{
					RecordID:   id,
					ChangeType: "reimport",
					Field:      df.field,
					OldValue:   df.old,
					NewValue:   df.new,
					Operator:   importOperator,
					Reason:     "补传旧版数据，内容变更",
					Alert:      true,
				}
				d.InsertChangeLog(cl)
			}
			fmt.Printf("  ⚠ 补传变更 #%d → #%d [%s/%s] v%d→v%d\n", existing.ID, id, r.Source, r.Location, existing.Version, r.Version)
			fmt.Printf("    变更字段: %s\n", formatDiffs(diffs))
			continue
		}

		id, err := d.InsertRecord(r)
		if err != nil {
			return fmt.Errorf("插入记录失败: %w", err)
		}
		imported++
		cl := &db.ChangeLog{
			RecordID:   id,
			ChangeType: "import",
			Field:      "status",
			OldValue:   "",
			NewValue:   r.Status,
			Operator:   importOperator,
			Reason:     "初次导入",
		}
		d.InsertChangeLog(cl)
		fmt.Printf("  导入 #%d [%s/%s]\n", id, r.Source, r.Location)
	}

	fmt.Printf("\n完成：新导入 %d 条，补传提醒 %d 条\n", imported, alerted)
	return nil
}

type fieldDiff struct {
	field string
	old   string
	new   string
}

func diffFields(old, new *db.Record) []fieldDiff {
	var diffs []fieldDiff
	if old.Description != new.Description {
		diffs = append(diffs, fieldDiff{"description", old.Description, new.Description})
	}
	if old.PhotoRef != new.PhotoRef {
		diffs = append(diffs, fieldDiff{"photo_ref", old.PhotoRef, new.PhotoRef})
	}
	if old.PendingReason != new.PendingReason {
		diffs = append(diffs, fieldDiff{"pending_reason", old.PendingReason, new.PendingReason})
	}
	if old.Status != new.Status {
		diffs = append(diffs, fieldDiff{"status", old.Status, new.Status})
	}
	return diffs
}

func formatDiffs(diffs []fieldDiff) string {
	var parts []string
	for _, d := range diffs {
		parts = append(parts, fmt.Sprintf("%s: «%s» → «%s»", d.field, truncate(d.old, 30), truncate(d.new, 30)))
	}
	return strings.Join(parts, "; ")
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n]) + "…"
}

func hashRecord(r *db.Record) string {
	h := sha256.New()
	h.Write([]byte(r.Source))
	h.Write([]byte(r.Location))
	h.Write([]byte(r.Description))
	h.Write([]byte(r.PhotoRef))
	return fmt.Sprintf("%x", h.Sum(nil))[:16]
}

func parseCSV(f io.Reader) ([]db.Record, error) {
	reader := csv.NewReader(f)
	headers, err := reader.Read()
	if err != nil {
		return nil, fmt.Errorf("读取CSV头失败: %w", err)
	}
	headerMap := make(map[string]int)
	for i, h := range headers {
		headerMap[strings.TrimSpace(strings.ToLower(h))] = i
	}

	required := []string{"source", "location"}
	for _, r := range required {
		if _, ok := headerMap[r]; !ok {
			return nil, fmt.Errorf("CSV缺少必填列: %s", r)
		}
	}

	var records []db.Record
	for {
		row, err := reader.Read()
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, fmt.Errorf("读取CSV行失败: %w", err)
		}
		r := db.Record{}
		r.Source = getCol(row, headerMap, "source")
		r.Location = getCol(row, headerMap, "location")
		r.Description = getCol(row, headerMap, "description")
		r.PhotoRef = getCol(row, headerMap, "photo_ref")
		r.PendingReason = getCol(row, headerMap, "pending_reason")
		if v := getCol(row, headerMap, "status"); v != "" {
			if !db.ValidStatuses[v] {
				return nil, fmt.Errorf("无效状态 %q，可选: imported/pending/reviewed/fixed/closed", v)
			}
			r.Status = v
		}
		if v := getCol(row, headerMap, "operator"); v != "" {
			r.Operator = v
		}
		records = append(records, r)
	}
	return records, nil
}

func getCol(row []string, m map[string]int, key string) string {
	idx, ok := m[key]
	if !ok || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}

func parseJSON(f io.Reader) ([]db.Record, error) {
	var raw []map[string]interface{}
	if err := json.NewDecoder(f).Decode(&raw); err != nil {
		return nil, fmt.Errorf("解析JSON失败: %w", err)
	}
	var records []db.Record
	for i, item := range raw {
		r := db.Record{}
		r.Source = strVal(item, "source")
		r.Location = strVal(item, "location")
		if r.Source == "" || r.Location == "" {
			return nil, fmt.Errorf("第%d条记录缺少 source 或 location", i+1)
		}
		r.Description = strVal(item, "description")
		r.PhotoRef = strVal(item, "photo_ref")
		r.PendingReason = strVal(item, "pending_reason")
		if v := strVal(item, "status"); v != "" {
			if !db.ValidStatuses[v] {
				return nil, fmt.Errorf("第%d条记录无效状态 %q", i+1, v)
			}
			r.Status = v
		}
		if v := strVal(item, "operator"); v != "" {
			r.Operator = v
		}
		if v := strVal(item, "version"); v != "" {
			if n, err := strconv.Atoi(v); err == nil {
				r.Version = n
			}
		}
		records = append(records, r)
	}
	return records, nil
}

func strVal(m map[string]interface{}, key string) string {
	v, ok := m[key]
	if !ok {
		return ""
	}
	return fmt.Sprintf("%v", v)
}
