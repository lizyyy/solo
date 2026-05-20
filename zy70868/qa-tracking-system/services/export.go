package services

import (
	"qa-tracking-system/utils"
	"time"
)

func ExportBatch(batchID uint) ([]byte, error) {
	batch, err := GetBatch(batchID)
	if err != nil {
		return nil, err
	}

	headers := []string{"批次号", "产品名称", "状态", "创建人", "创建时间", "样品ID", "样品名称", "取样点", "取样时间", "取样人", "操作记录", "操作人", "操作时间", "操作原因"}

	var rows [][]string

	for _, sample := range batch.Samples {
		for _, log := range batch.TrackingLogs {
			row := []string{
				batch.BatchNo,
				batch.ProductName,
				string(batch.Status),
				batch.CreatedBy,
				batch.CreatedAt.Format("2006-01-02 15:04:05"),
				sample.SampleID,
				sample.SampleName,
				sample.SamplingPoint,
				sample.SamplingTime.Format("2006-01-02 15:04:05"),
				sample.Sampler,
				log.Action,
				log.Operator,
				log.CreatedAt.Format("2006-01-02 15:04:05"),
				"",
			}
			if log.Reason != nil {
				row[13] = *log.Reason
			}
			rows = append(rows, row)
		}
	}

	if len(rows) == 0 && len(batch.Samples) > 0 {
		for _, sample := range batch.Samples {
			row := []string{
				batch.BatchNo,
				batch.ProductName,
				string(batch.Status),
				batch.CreatedBy,
				batch.CreatedAt.Format("2006-01-02 15:04:05"),
				sample.SampleID,
				sample.SampleName,
				sample.SamplingPoint,
				sample.SamplingTime.Format("2006-01-02 15:04:05"),
				sample.Sampler,
				"",
				"",
				"",
				"",
			}
			rows = append(rows, row)
		}
	}

	return utils.GenerateCSV(headers, rows)
}

func ExportQueryResults(batchNo, chamberID, nodeID string, startTime, endTime time.Time) ([]byte, int, error) {
	var rows [][]string
	headers := []string{"类型", "编号", "名称", "状态", "相关批次", "时间", "处理人", "原因/描述"}

	count := 0

	if batchNo != "" {
		batch, err := QueryByBatchNo(batchNo)
		if err == nil {
			for _, log := range batch.TrackingLogs {
				reason := ""
				if log.Reason != nil {
					reason = *log.Reason
				}
				row := []string{
					"批次追踪",
					batch.BatchNo,
					batch.ProductName,
					log.ToStatus,
					batch.BatchNo,
					log.CreatedAt.Format("2006-01-02 15:04:05"),
					log.Operator,
					reason,
				}
				rows = append(rows, row)
				count++
			}
		}
	}

	if chamberID != "" {
		records, err := QueryByChamber(chamberID, startTime, endTime)
		if err == nil {
			for _, record := range records {
				row := []string{
					"环境记录",
					record.ChamberID,
					record.ChamberName,
					"",
					"",
					record.Timestamp.Format("2006-01-02 15:04:05"),
					"",
					"温度:" + formatFloat(record.Temperature) + "°C, 湿度:" + formatFloat(record.Humidity) + "%",
				}
				rows = append(rows, row)
				count++
			}
		}
	}

	if nodeID != "" {
		trace, err := GetSampleNodeTrace(nodeID)
		if err == nil {
			for _, item := range trace {
				row := []string{
					"节点追溯",
					item["node_id"].(string),
					item["node_name"].(string),
					item["status"].(string),
					"",
					item["time"].(time.Time).Format("2006-01-02 15:04:05"),
					item["operator"].(string),
					"",
				}
				rows = append(rows, row)
				count++
			}
		}
	}

	csvData, err := utils.GenerateCSV(headers, rows)
	return csvData, count, err
}

func formatFloat(f float64) string {
	return utils.FormatFloat(f)
}
