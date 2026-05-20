package services

import (
	"qa-tracking-system/config"
	"qa-tracking-system/models"
	"qa-tracking-system/utils"
	"time"
)

func CreateBatch(batchNo, productName, createdBy string) (*models.Batch, error) {
	batch := &models.Batch{
		BatchNo:     batchNo,
		ProductName: productName,
		Status:      models.BatchStatusPending,
		CreatedBy:   createdBy,
	}

	if err := config.DB.Create(batch).Error; err != nil {
		return nil, err
	}

	if err := AddTrackingLog(batch.ID, "create_batch", nil, string(models.BatchStatusPending), createdBy, "批次创建"); err != nil {
		return nil, err
	}

	return batch, nil
}

func AddTrackingLog(batchID uint, action string, fromStatus *string, toStatus string, operator string, reason string) error {
	log := &models.TrackingLog{
		BatchID:    batchID,
		Action:     action,
		FromStatus: fromStatus,
		ToStatus:   toStatus,
		Operator:   operator,
		Reason:     &reason,
		CreatedAt:  time.Now(),
	}
	return config.DB.Create(log).Error
}

func ImportSamples(batchID uint, records [][]string) ([]models.Sample, error) {
	if len(records) < 2 {
		return nil, nil
	}

	var samples []models.Sample
	for i := 1; i < len(records); i++ {
		record := records[i]
		if len(record) < 5 {
			continue
		}

		samplingTime, err := utils.ParseTime(record[3])
		if err != nil {
			samplingTime = time.Now()
		}

		sample := models.Sample{
			BatchID:       batchID,
			SampleID:      record[0],
			SampleName:    record[1],
			SamplingPoint: record[2],
			SamplingTime:  samplingTime,
			Sampler:       record[4],
		}

		if len(record) > 5 {
			sample.Description = &record[5]
		}

		samples = append(samples, sample)
	}

	for i := range samples {
		if err := config.DB.Create(&samples[i]).Error; err != nil {
			return nil, err
		}
	}

	return samples, nil
}

func ImportTestProtocol(batchID uint, protocolData map[string]interface{}) (*models.TestProtocol, error) {
	content, err := utils.MarshalJSON(protocolData)
	if err != nil {
		return nil, err
	}

	protocol := &models.TestProtocol{
		BatchID:      batchID,
		ProtocolID:   getStringValue(protocolData, "protocol_id", utils.GenerateID()),
		ProtocolName: getStringValue(protocolData, "protocol_name", "未命名方案"),
		Version:      getStringValue(protocolData, "version", "1.0"),
		Content:      string(content),
		CreatedBy:    getStringValue(protocolData, "created_by", "system"),
	}

	if err := config.DB.Create(protocol).Error; err != nil {
		return nil, err
	}

	return protocol, nil
}

func ImportChamberRecords(sampleID uint, records [][]string) ([]models.ChamberRecord, error) {
	if len(records) < 2 {
		return nil, nil
	}

	var chamberRecords []models.ChamberRecord
	for i := 1; i < len(records); i++ {
		record := records[i]
		if len(record) < 4 {
			continue
		}

		timestamp, err := utils.ParseTime(record[2])
		if err != nil {
			timestamp = time.Now()
		}

		temperature, _ := utils.ParseFloat(record[3])
		humidity, _ := utils.ParseFloat(getArrayValue(record, 4, "0"))

		cr := models.ChamberRecord{
			SampleID:    sampleID,
			ChamberID:   record[0],
			ChamberName: record[1],
			Timestamp:   timestamp,
			Temperature: temperature,
			Humidity:    humidity,
		}

		if len(record) > 5 {
			if pressure, err := utils.ParseFloat(record[5]); err == nil {
				cr.Pressure = &pressure
			}
		}

		chamberRecords = append(chamberRecords, cr)
	}

	for i := range chamberRecords {
		if err := config.DB.Create(&chamberRecords[i]).Error; err != nil {
			return nil, err
		}
	}

	return chamberRecords, nil
}

func getStringValue(data map[string]interface{}, key, defaultValue string) string {
	if v, ok := data[key].(string); ok {
		return v
	}
	return defaultValue
}

func getArrayValue(arr []string, index int, defaultValue string) string {
	if index < len(arr) {
		return arr[index]
	}
	return defaultValue
}
