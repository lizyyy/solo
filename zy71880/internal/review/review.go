package review

import (
	"fmt"
	"math"

	"freefall-grading/internal/db"
	"freefall-grading/internal/model"
	"freefall-grading/internal/parser"
)

type ReviewResult struct {
	RecordID      int64
	Status        model.RecordStatus
	PendingReason string
	ZeroDrift     float64
	HasGap        bool
	GapCount      int
	FinalGravity  float64
	Issues        []string
}

type Reviewer struct {
	db     *db.Database
	config *model.ReviewConfig
}

func NewReviewer(db *db.Database, config *model.ReviewConfig) *Reviewer {
	if config == nil {
		config = model.DefaultReviewConfig()
	}
	return &Reviewer{db: db, config: config}
}

func (r *Reviewer) ReviewRecord(recordID int64) (*ReviewResult, error) {
	record, err := r.db.GetRecordByID(recordID)
	if err != nil {
		return nil, fmt.Errorf("获取记录失败: %w", err)
	}

	rawData, err := r.db.GetRawData(recordID)
	if err != nil {
		return nil, fmt.Errorf("获取原始数据失败: %w", err)
	}

	if len(rawData) == 0 {
		return &ReviewResult{
			RecordID:      recordID,
			Status:        model.StatusPending,
			PendingReason: "无原始传感器数据",
			Issues:        []string{"无原始传感器数据，无法复核"},
		}, nil
	}

	result := &ReviewResult{
		RecordID: recordID,
	}

	var issues []string

	zeroDrift := calculateZeroDrift(rawData)
	result.ZeroDrift = zeroDrift
	if zeroDrift > r.config.MaxZeroDrift {
		issues = append(issues, fmt.Sprintf("零点漂移 %.4fg 超过阈值 %.4fg",
			zeroDrift, r.config.MaxZeroDrift))
	}

	hasGap, gapCount := detectGaps(rawData, record.SamplingRate, r.config.MaxAllowedGapMs)
	result.HasGap = hasGap
	result.GapCount = gapCount
	if hasGap {
		issues = append(issues, fmt.Sprintf("存在 %d 处采样缺口（超过 %.0fms）",
			gapCount, r.config.MaxAllowedGapMs))
	}

	if len(rawData) < r.config.MinDataPoints {
		issues = append(issues, fmt.Sprintf("数据点数量 %d 不足 %d",
			len(rawData), r.config.MinDataPoints))
	}

	gravity := calculateGravity(rawData)
	result.FinalGravity = gravity

	if gravity < r.config.GravityLowerBound || gravity > r.config.GravityUpperBound {
		issues = append(issues, fmt.Sprintf("计算得到重力加速度 %.4f m/s² 超出正常范围 [%.2f, %.2f]",
			gravity, r.config.GravityLowerBound, r.config.GravityUpperBound))
	}

	if len(issues) > 0 {
		result.Status = model.StatusPending
		result.PendingReason = fmt.Sprintf("发现 %d 项异常: %s", len(issues), issues[0])
		if len(issues) > 1 {
			result.PendingReason += fmt.Sprintf(" 等%d项", len(issues))
		}
		result.Issues = issues
	} else {
		result.Status = model.StatusReviewed
		result.PendingReason = ""
		result.Issues = []string{"数据正常"}
	}

	return result, nil
}

func (r *Reviewer) ApplyReview(recordID int64, result *ReviewResult, modifiedBy string) error {
	record, err := r.db.GetRecordByID(recordID)
	if err != nil {
		return err
	}

	if record.Status == model.StatusApproved || record.Status == model.StatusExported {
		return fmt.Errorf("记录状态为 %s，不可修改", record.Status)
	}

	record.ZeroDrift = result.ZeroDrift
	record.HasGap = result.HasGap
	record.GapCount = result.GapCount
	record.FinalGravity = result.FinalGravity
	record.PendingReason = result.PendingReason
	record.Status = result.Status
	record.LastModifiedBy = modifiedBy

	_, err = r.db.UpsertExperimentRecord(record)
	if err != nil {
		return err
	}

	details := fmt.Sprintf("复核完成: 零点漂移=%.4f, 采样缺口=%d, 重力加速度=%.4f",
		result.ZeroDrift, result.GapCount, result.FinalGravity)
	if len(result.Issues) > 0 {
		details += " 问题: " + result.Issues[0]
	}

	return r.db.UpdateRecordStatus(recordID, result.Status, modifiedBy, "自动复核", details)
}

func (r *Reviewer) ReviewAllImported(modifiedBy string) (int, int, error) {
	records, err := r.db.ListRecordsByStatus(model.StatusImported)
	if err != nil {
		return 0, 0, err
	}

	processed := 0
	pendingCount := 0

	for _, record := range records {
		result, err := r.ReviewRecord(record.ID)
		if err != nil {
			continue
		}

		if err := r.ApplyReview(record.ID, result, modifiedBy); err != nil {
			continue
		}

		processed++
		if result.Status == model.StatusPending {
			pendingCount++
		}
	}

	return processed, pendingCount, nil
}

func calculateZeroDrift(data []*model.RawSensorData) float64 {
	if len(data) < 10 {
		return 0
	}

	stableCount := 0
	var sumZ float64
	for i := 0; i < 20 && i < len(data); i++ {
		accelMag := math.Sqrt(data[i].AccelX*data[i].AccelX +
			data[i].AccelY*data[i].AccelY +
			data[i].AccelZ*data[i].AccelZ)
		if accelMag > 0.5 {
			sumZ += accelMag
			stableCount++
		}
	}

	if stableCount == 0 {
		return 0
	}

	avgZ := sumZ / float64(stableCount)
	return math.Abs(avgZ - 1.0)
}

func detectGaps(data []*model.RawSensorData, samplingRate float64, maxGapMs float64) (bool, int) {
	if len(data) < 2 {
		return false, 0
	}

	expectedInterval := 1000.0 / samplingRate
	gapCount := 0

	for i := 1; i < len(data); i++ {
		deltaMs := (data[i].Timestamp - data[i-1].Timestamp) * 1000.0
		if deltaMs > maxGapMs && deltaMs > expectedInterval*2 {
			gapCount++
		}
	}

	return gapCount > 0, gapCount
}

func calculateGravity(data []*model.RawSensorData) float64 {
	if len(data) < 10 {
		return 0
	}

	var maxAccel float64
	for _, d := range data {
		mag := math.Sqrt(d.AccelX*d.AccelX + d.AccelY*d.AccelY + d.AccelZ*d.AccelZ)
		if mag > maxAccel {
			maxAccel = mag
		}
	}

	if maxAccel > 0.1 {
		return 9.81 * maxAccel
	}
	return 9.81
}

func GetGapDetails(data []*model.RawSensorData, samplingRate float64, maxGapMs float64) []map[string]interface{} {
	var gaps []map[string]interface{}
	if len(data) < 2 {
		return gaps
	}

	expectedInterval := 1000.0 / samplingRate

	for i := 1; i < len(data); i++ {
		deltaMs := (data[i].Timestamp - data[i-1].Timestamp) * 1000.0
		if deltaMs > maxGapMs && deltaMs > expectedInterval*2 {
			gaps = append(gaps, map[string]interface{}{
				"index":        i,
				"start_time":   data[i-1].Timestamp,
				"end_time":     data[i].Timestamp,
				"gap_duration": deltaMs,
			})
		}
	}

	return gaps
}

func ParseAndReview(filename string, sourceFile string) (*model.ExperimentRecord, []*model.RawSensorData, *ReviewResult, error) {
	parsed, err := parser.ParseSensorLog(filename)
	if err != nil {
		return nil, nil, nil, err
	}

	record := &model.ExperimentRecord{
		StudentID:    parsed.StudentID,
		StudentName:  parsed.StudentName,
		ExperimentNo: parsed.ExperimentNo,
		GroupNo:      parsed.GroupNo,
		Source:       model.SourceSensorLog,
		SourceFile:   sourceFile,
		Status:       model.StatusImported,
		SamplingRate: parsed.SamplingRate,
		DataPoints:   len(parsed.RawData),
		GravityUnit:  "m/s²",
	}

	_ = NewReviewer(nil, model.DefaultReviewConfig())
	zeroDrift := calculateZeroDrift(parsed.RawData)
	hasGap, gapCount := detectGaps(parsed.RawData, parsed.SamplingRate, 50.0)
	gravity := calculateGravity(parsed.RawData)

	result := &ReviewResult{
		Status:        model.StatusImported,
		ZeroDrift:     zeroDrift,
		HasGap:        hasGap,
		GapCount:      gapCount,
		FinalGravity:  gravity,
		PendingReason: "",
	}

	record.ZeroDrift = zeroDrift
	record.HasGap = hasGap
	record.GapCount = gapCount
	record.FinalGravity = gravity

	return record, parsed.RawData, result, nil
}
