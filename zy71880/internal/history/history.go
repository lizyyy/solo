package history

import (
	"fmt"

	"freefall-grading/internal/db"
	"freefall-grading/internal/model"
)

type HistoryQuery struct {
	db *db.Database
}

func NewHistoryQuery(db *db.Database) *HistoryQuery {
	return &HistoryQuery{db: db}
}

func (h *HistoryQuery) GetRecordHistory(recordID int64) ([]*model.StatusHistory, error) {
	return h.db.GetStatusHistory(recordID)
}

func (h *HistoryQuery) GetRecordDetail(recordID int64) (*model.ExperimentRecord, []*model.StatusHistory, error) {
	record, err := h.db.GetRecordByID(recordID)
	if err != nil {
		return nil, nil, err
	}

	history, err := h.db.GetStatusHistory(recordID)
	if err != nil {
		return record, nil, err
	}

	return record, history, nil
}

func (h *HistoryQuery) ListByStatus(status model.RecordStatus) ([]*model.ExperimentRecord, error) {
	return h.db.ListRecordsByStatus(status)
}

func (h *HistoryQuery) ListAll() ([]*model.ExperimentRecord, error) {
	return h.db.ListAllRecords()
}

func (h *HistoryQuery) GetStatistics() (map[string]int, int, error) {
	stats, err := h.db.GetStats()
	if err != nil {
		return nil, 0, err
	}

	total := 0
	for _, count := range stats {
		total += count
	}

	return stats, total, nil
}

func FormatStatus(status model.RecordStatus) string {
	mapping := map[model.RecordStatus]string{
		model.StatusImported:  "已导入",
		model.StatusPending:   "待处理",
		model.StatusReviewed:  "已复核",
		model.StatusCorrected: "已修正",
		model.StatusApproved:  "已通过",
		model.StatusRejected:  "已驳回",
		model.StatusExported:  "已导出",
	}
	if s, ok := mapping[status]; ok {
		return s
	}
	return string(status)
}

func FormatSource(source model.RecordSource) string {
	mapping := map[model.RecordSource]string{
		model.SourceSensorLog: "传感器日志",
		model.SourceManual:    "手工录入",
		model.SourceBatch:     "批量导入",
	}
	if s, ok := mapping[source]; ok {
		return s
	}
	return string(source)
}

func (h *HistoryQuery) GetRawDataPreview(recordID int64, limit int) ([]*model.RawSensorData, error) {
	data, err := h.db.GetRawData(recordID)
	if err != nil {
		return nil, err
	}

	if limit > 0 && len(data) > limit {
		return data[:limit], nil
	}
	return data, nil
}

func (h *HistoryQuery) GetGapReport(recordID int64) (string, error) {
	record, err := h.db.GetRecordByID(recordID)
	if err != nil {
		return "", err
	}

	if !record.HasGap {
		return "该记录无采样缺口", nil
	}

	rawData, err := h.db.GetRawData(recordID)
	if err != nil {
		return "", err
	}

	expectedInterval := 1000.0 / record.SamplingRate
	report := fmt.Sprintf("记录 %d 采样缺口报告:\n", recordID)
	report += fmt.Sprintf("采样率: %.2f Hz (理论间隔: %.2f ms)\n", record.SamplingRate, expectedInterval)
	report += fmt.Sprintf("缺口数量: %d\n\n", record.GapCount)

	gapCount := 0
	for i := 1; i < len(rawData); i++ {
		deltaMs := (rawData[i].Timestamp - rawData[i-1].Timestamp) * 1000.0
		if deltaMs > 50.0 && deltaMs > expectedInterval*2 {
			gapCount++
			report += fmt.Sprintf("缺口 #%d: 数据点 %d-%d | 时间 %.4fs -> %.4fs | 实际间隔 %.2fms (超出 %.2fms)\n",
				gapCount, i-1, i,
				rawData[i-1].Timestamp, rawData[i].Timestamp,
				deltaMs, deltaMs-expectedInterval)
		}
	}

	return report, nil
}
