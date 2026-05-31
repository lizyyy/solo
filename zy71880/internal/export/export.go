package export

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"freefall-grading/internal/db"
	"freefall-grading/internal/history"
	"freefall-grading/internal/model"
)

type Exporter struct {
	db *db.Database
}

func NewExporter(db *db.Database) *Exporter {
	return &Exporter{db: db}
}

type ExportRecord struct {
	ID           int64   `json:"id" csv:"ID"`
	StudentID    string  `json:"student_id" csv:"学号"`
	StudentName  string  `json:"student_name" csv:"姓名"`
	ExperimentNo string  `json:"experiment_no" csv:"实验编号"`
	GroupNo      string  `json:"group_no" csv:"组号"`
	Status       string  `json:"status" csv:"状态"`
	Source       string  `json:"source" csv:"数据来源"`
	SourceFile   string  `json:"source_file" csv:"源文件"`
	DataPoints   int     `json:"data_points" csv:"数据点数"`
	ZeroDrift    float64 `json:"zero_drift" csv:"零点漂移(g)"`
	HasGap       string  `json:"has_gap" csv:"有无缺口"`
	GapCount     int     `json:"gap_count" csv:"缺口数量"`
	FinalGravity float64 `json:"final_gravity" csv:"重力加速度(m/s²)"`
	PendingReason string `json:"pending_reason" csv:"待处理原因"`
	LastModifiedBy string `json:"last_modified_by" csv:"最后修改人"`
	UpdatedAt    string `json:"updated_at" csv:"更新时间"`
}

func (e *Exporter) ExportApprovedToCSV(filename string) (int, error) {
	records, err := e.db.ListRecordsByStatus(model.StatusApproved)
	if err != nil {
		return 0, err
	}

	if len(records) == 0 {
		return 0, fmt.Errorf("没有已通过的记录可导出")
	}

	dir := filepath.Dir(filename)
	if dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return 0, err
		}
	}

	file, err := os.Create(filename)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	writer := csv.NewWriter(file)
	defer writer.Flush()

	headers := []string{
		"ID", "学号", "姓名", "实验编号", "组号", "状态",
		"数据来源", "源文件", "数据点数", "零点漂移(g)",
		"有无缺口", "缺口数量", "重力加速度(m/s²)",
		"最后修改人", "更新时间", "备注",
	}
	if err := writer.Write(headers); err != nil {
		return 0, err
	}

	for _, r := range records {
		hasGapStr := "否"
		if r.HasGap {
			hasGapStr = "是"
		}

		row := []string{
			strconv.FormatInt(r.ID, 10),
			r.StudentID,
			r.StudentName,
			r.ExperimentNo,
			r.GroupNo,
			history.FormatStatus(r.Status),
			history.FormatSource(r.Source),
			r.SourceFile,
			strconv.Itoa(r.DataPoints),
			fmt.Sprintf("%.4f", r.ZeroDrift),
			hasGapStr,
			strconv.Itoa(r.GapCount),
			fmt.Sprintf("%.4f", r.FinalGravity),
			r.LastModifiedBy,
			r.UpdatedAt.Format("2006-01-02 15:04:05"),
			r.Remark,
		}
		if err := writer.Write(row); err != nil {
			return 0, err
		}
	}

	var recordIDs []int64
	for _, r := range records {
		recordIDs = append(recordIDs, r.ID)
	}

	// 这里不立即标记为已导出，由用户决定
	// corrector.NewCorrector(e.db).MarkAsExported(recordIDs, "export")

	return len(records), nil
}

func (e *Exporter) ExportAllToJSON(filename string) (int, error) {
	records, err := e.db.ListAllRecords()
	if err != nil {
		return 0, err
	}

	exportRecords := make([]ExportRecord, 0, len(records))
	for _, r := range records {
		hasGapStr := "否"
		if r.HasGap {
			hasGapStr = "是"
		}

		exportRecords = append(exportRecords, ExportRecord{
			ID:             r.ID,
			StudentID:      r.StudentID,
			StudentName:    r.StudentName,
			ExperimentNo:   r.ExperimentNo,
			GroupNo:        r.GroupNo,
			Status:         history.FormatStatus(r.Status),
			Source:         history.FormatSource(r.Source),
			SourceFile:     r.SourceFile,
			DataPoints:     r.DataPoints,
			ZeroDrift:      r.ZeroDrift,
			HasGap:         hasGapStr,
			GapCount:       r.GapCount,
			FinalGravity:   r.FinalGravity,
			PendingReason:  r.PendingReason,
			LastModifiedBy: r.LastModifiedBy,
			UpdatedAt:      r.UpdatedAt.Format("2006-01-02 15:04:05"),
		})
	}

	dir := filepath.Dir(filename)
	if dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return 0, err
		}
	}

	data, err := json.MarshalIndent(exportRecords, "", "  ")
	if err != nil {
		return 0, err
	}

	if err := os.WriteFile(filename, data, 0644); err != nil {
		return 0, err
	}

	return len(records), nil
}

func (e *Exporter) ExportPendingReport(filename string) (int, error) {
	records, err := e.db.ListRecordsByStatus(model.StatusPending)
	if err != nil {
		return 0, err
	}

	dir := filepath.Dir(filename)
	if dir != "." {
		if err := os.MkdirAll(dir, 0755); err != nil {
			return 0, err
		}
	}

	file, err := os.Create(filename)
	if err != nil {
		return 0, err
	}
	defer file.Close()

	report := fmt.Sprintf("自由落体实验批改 - 待处理记录报告\n")
	report += fmt.Sprintf("生成时间: %s\n", time.Now().Format("2006-01-02 15:04:05"))
	report += fmt.Sprintf("待处理总数: %d\n\n", len(records))
	report += "=" + strings.Repeat("=", 80) + "\n\n"

	for i, r := range records {
		report += fmt.Sprintf("[%d] 记录 #%d\n", i+1, r.ID)
		report += fmt.Sprintf("    学生: %s (%s) | 实验: %s\n", r.StudentName, r.StudentID, r.ExperimentNo)
		report += fmt.Sprintf("    数据来源: %s (%s)\n", history.FormatSource(r.Source), r.SourceFile)
		report += fmt.Sprintf("    数据点数: %d | 零点漂移: %.4fg | 采样缺口: %d处\n",
			r.DataPoints, r.ZeroDrift, r.GapCount)
		report += fmt.Sprintf("    待处理原因: %s\n", r.PendingReason)
		report += fmt.Sprintf("    最后修改: %s @ %s\n\n", r.LastModifiedBy,
			r.UpdatedAt.Format("2006-01-02 15:04:05"))
	}

	if _, err := file.WriteString(report); err != nil {
		return 0, err
	}

	return len(records), nil
}

func (e *Exporter) MarkAsExported(recordIDs []int64, modifiedBy string) (int, error) {
	count := 0
	for _, id := range recordIDs {
		record, err := e.db.GetRecordByID(id)
		if err != nil {
			continue
		}
		if record.Status != model.StatusApproved {
			continue
		}

		err = e.db.UpdateRecordStatus(id, model.StatusExported, modifiedBy,
			"导出实验批改表", "已导出")
		if err == nil {
			count++
		}
	}
	return count, nil
}
