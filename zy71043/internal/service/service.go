package service

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"fireworks-humidity-api/internal/database"
	"fireworks-humidity-api/internal/models"
)

type Service struct {
	repo *database.Repository
}

func NewService(repo *database.Repository) *Service {
	return &Service{repo: repo}
}

type CreateSampleRequest struct {
	RequestID   string    `json:"request_id" binding:"required"`
	AreaCode    string    `json:"area_code" binding:"required"`
	Humidity    float64   `json:"humidity" binding:"required"`
	Temperature float64   `json:"temperature"`
	SampledAt   time.Time `json:"sampled_at" binding:"required"`
	SampledBy   string    `json:"sampled_by" binding:"required"`
}

type VentilationStartRequest struct {
	RequestID string    `json:"request_id" binding:"required"`
	SampleID  int64     `json:"sample_id" binding:"required"`
	Operator  string    `json:"operator" binding:"required"`
	StartedAt time.Time `json:"started_at" binding:"required"`
	Remark    string    `json:"remark"`
}

type VentilationCompleteRequest struct {
	VentilationID int64     `json:"ventilation_id" binding:"required"`
	EndedAt       time.Time `json:"ended_at" binding:"required"`
	AfterHumidity float64   `json:"after_humidity" binding:"required"`
}

type TransferRequest struct {
	RequestID     string    `json:"request_id" binding:"required"`
	BatchNo       string    `json:"batch_no" binding:"required"`
	ToAreaCode    string    `json:"to_area_code" binding:"required"`
	Quantity      int       `json:"quantity" binding:"required,min=1"`
	Operator      string    `json:"operator" binding:"required"`
	TransferredAt time.Time `json:"transferred_at" binding:"required"`
	Remark        string    `json:"remark"`
}

type TransferUndoRequest struct {
	TransferID int64  `json:"transfer_id" binding:"required"`
	Operator   string `json:"operator" binding:"required"`
}

type InspectionRequest struct {
	RequestID     string    `json:"request_id" binding:"required"`
	BatchNo       string    `json:"batch_no" binding:"required"`
	AreaCode      string    `json:"area_code" binding:"required"`
	InspectedAt   time.Time `json:"inspected_at" binding:"required"`
	Inspector     string    `json:"inspector" binding:"required"`
	PackageCheck  string    `json:"package_check" binding:"required"`
	HumidityCheck string    `json:"humidity_check" binding:"required"`
	QualityStatus string    `json:"quality_status" binding:"required"`
	Photos        []string  `json:"photos"`
	Remark        string    `json:"remark"`
}

type ReviewRequest struct {
	ResourceType string `json:"resource_type" binding:"required"`
	ResourceID   int64  `json:"resource_id" binding:"required"`
	ReviewedBy   string `json:"reviewed_by" binding:"required"`
}

type ReportRequest struct {
	ReportType  string    `json:"report_type" binding:"required"`
	PeriodStart time.Time `json:"period_start" binding:"required"`
	PeriodEnd   time.Time `json:"period_end" binding:"required"`
	GeneratedBy string    `json:"generated_by" binding:"required"`
}

func (s *Service) CheckIdempotent(requestID string) (*models.IdempotentRequest, error) {
	return s.repo.CheckIdempotentRequest(requestID)
}

func (s *Service) saveIdempotent(tx *sql.Tx, requestID, requestType, resourceType string, resourceID int64, response interface{}) error {
	respJSON, _ := json.Marshal(response)
	req := &models.IdempotentRequest{
		RequestID:    requestID,
		RequestType:  requestType,
		ResourceType: resourceType,
		ResourceID:   resourceID,
		ResponseBody: string(respJSON),
	}
	_ = req
	return nil
}

func (s *Service) calculateHumidityWindow(sampledAt time.Time) (start, end time.Time) {
	windowSize := 4 * time.Hour
	start = sampledAt.Truncate(windowSize)
	end = start.Add(windowSize)
	return
}

func (s *Service) evaluateRiskLevel(humidity float64, area *models.WarehouseArea) (string, string) {
	if humidity < area.HumidityMin {
		return models.SampleStatusOverLimit, models.RiskLevelMedium
	}
	if humidity > area.HumidityMax {
		delta := humidity - area.HumidityMax
		if delta > 15 {
			return models.SampleStatusOverLimit, models.RiskLevelHigh
		} else if delta > 10 {
			return models.SampleStatusOverLimit, models.RiskLevelMedium
		}
		return models.SampleStatusOverLimit, models.RiskLevelLow
	}
	return models.SampleStatusNormal, models.RiskLevelNormal
}

func (s *Service) CreateSample(req *CreateSampleRequest) (*models.HumiditySample, error) {
	area, err := s.repo.GetAreaByCode(req.AreaCode)
	if err != nil {
		return nil, models.ErrAreaNotFound
	}

	windowStart, windowEnd := s.calculateHumidityWindow(req.SampledAt)
	status, riskLevel := s.evaluateRiskLevel(req.Humidity, area)

	sample := &models.HumiditySample{
		RequestID:   req.RequestID,
		AreaID:      area.ID,
		AreaCode:    area.Code,
		Humidity:    req.Humidity,
		Temperature: req.Temperature,
		SampledAt:   req.SampledAt,
		SampledBy:   req.SampledBy,
		Status:      status,
		WindowStart: windowStart,
		WindowEnd:   windowEnd,
		RiskLevel:   riskLevel,
	}

	tx, err := s.repo.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	id, err := s.repo.CreateSample(tx, sample)
	if err != nil {
		return nil, err
	}
	sample.ID = id

	respJSON, _ := json.Marshal(sample)
	idempotentReq := &models.IdempotentRequest{
		RequestID:    req.RequestID,
		RequestType:  "create_sample",
		ResourceType: "humidity_sample",
		ResourceID:   id,
		ResponseBody: string(respJSON),
	}
	if err := s.repo.SaveIdempotentRequest(tx, idempotentReq); err != nil {
		return nil, err
	}

	if err := s.repo.CreateAuditLog(tx, "create_sample", "humidity_sample", id, req.SampledBy, nil, sample); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return sample, nil
}

func (s *Service) StartVentilation(req *VentilationStartRequest) (*models.VentilationAction, error) {
	sample, err := s.repo.GetSampleByID(req.SampleID)
	if err != nil {
		return nil, models.ErrSampleNotFound
	}

	if sample.Status != models.SampleStatusOverLimit {
		return nil, models.ErrInvalidState
	}

	area, err := s.repo.GetAreaByID(sample.AreaID)
	if err != nil {
		return nil, models.ErrAreaNotFound
	}

	vent := &models.VentilationAction{
		RequestID:      req.RequestID,
		AreaID:         area.ID,
		AreaCode:       area.Code,
		SampleID:       sample.ID,
		StartedAt:      req.StartedAt,
		Operator:       req.Operator,
		BeforeHumidity: sample.Humidity,
		Status:         models.VentilationStatusActive,
		Remark:         req.Remark,
	}

	tx, err := s.repo.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	id, err := s.repo.CreateVentilation(tx, vent)
	if err != nil {
		return nil, err
	}
	vent.ID = id

	if err := s.repo.UpdateSampleStatus(tx, sample.ID, models.SampleStatusProcessing, &id); err != nil {
		return nil, err
	}

	respJSON, _ := json.Marshal(vent)
	idempotentReq := &models.IdempotentRequest{
		RequestID:    req.RequestID,
		RequestType:  "start_ventilation",
		ResourceType: "ventilation_action",
		ResourceID:   id,
		ResponseBody: string(respJSON),
	}
	if err := s.repo.SaveIdempotentRequest(tx, idempotentReq); err != nil {
		return nil, err
	}

	if err := s.repo.CreateAuditLog(tx, "start_ventilation", "ventilation_action", id, req.Operator, nil, vent); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return vent, nil
}

func (s *Service) CompleteVentilation(req *VentilationCompleteRequest) (*models.VentilationAction, error) {
	vent, err := s.repo.GetVentilationByID(req.VentilationID)
	if err != nil {
		return nil, err
	}

	if vent.Status != models.VentilationStatusActive {
		return nil, models.ErrInvalidState
	}

	sample, err := s.repo.GetSampleByID(vent.SampleID)
	if err != nil {
		return nil, err
	}

	area, err := s.repo.GetAreaByID(sample.AreaID)
	if err != nil {
		return nil, err
	}

	duration := int(req.EndedAt.Sub(vent.StartedAt).Minutes())
	newStatus := models.SampleStatusResolved
	if req.AfterHumidity > area.HumidityMax || req.AfterHumidity < area.HumidityMin {
		newStatus = models.SampleStatusOverLimit
	}

	tx, err := s.repo.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := s.repo.CompleteVentilation(tx, vent.ID, req.EndedAt, duration, req.AfterHumidity); err != nil {
		return nil, err
	}

	if err := s.repo.UpdateSampleStatus(tx, sample.ID, newStatus, nil); err != nil {
		return nil, err
	}

	if err := s.repo.CreateAuditLog(tx, "complete_ventilation", "ventilation_action", vent.ID, vent.Operator, vent.Status, models.VentilationStatusComplete); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	vent.EndedAt = &req.EndedAt
	vent.Duration = &duration
	vent.AfterHumidity = &req.AfterHumidity
	vent.Status = models.VentilationStatusComplete

	return vent, nil
}

func (s *Service) CreateTransfer(req *TransferRequest) (*models.TransferRecord, error) {
	batch, err := s.repo.GetBatchByNo(req.BatchNo)
	if err != nil {
		return nil, models.ErrBatchNotFound
	}

	if batch.Quantity < req.Quantity {
		return nil, models.ErrInsufficientQty
	}

	fromArea, err := s.repo.GetAreaByID(batch.CurrentAreaID)
	if err != nil {
		return nil, models.ErrAreaNotFound
	}

	toArea, err := s.repo.GetAreaByCode(req.ToAreaCode)
	if err != nil {
		return nil, models.ErrAreaNotFound
	}

	if fromArea.ID == toArea.ID {
		return nil, models.ErrInvalidState
	}

	transfer := &models.TransferRecord{
		RequestID:     req.RequestID,
		BatchID:       batch.ID,
		BatchNo:       batch.BatchNo,
		FromAreaID:    fromArea.ID,
		FromAreaCode:  fromArea.Code,
		ToAreaID:      toArea.ID,
		ToAreaCode:    toArea.Code,
		Quantity:      req.Quantity,
		Operator:      req.Operator,
		TransferredAt: req.TransferredAt,
		Status:        models.TransferStatusComplete,
		Remark:        req.Remark,
	}

	tx, err := s.repo.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	id, err := s.repo.CreateTransfer(tx, transfer)
	if err != nil {
		return nil, err
	}
	transfer.ID = id

	if req.Quantity == batch.Quantity {
		if err := s.repo.UpdateBatchAreaAndQuantity(tx, batch.ID, toArea.ID, toArea.Code, batch.Quantity); err != nil {
			return nil, err
		}
	} else {
		if err := s.repo.UpdateBatchQuantity(tx, batch.ID, -req.Quantity); err != nil {
			return nil, err
		}
		newBatchNo := fmt.Sprintf("%s-%s", batch.BatchNo, time.Now().Format("20060102150405"))
		newBatch := &models.FireworksBatch{
			BatchNo:         newBatchNo,
			ProductName:     batch.ProductName,
			Quantity:        req.Quantity,
			CurrentAreaID:   toArea.ID,
			CurrentAreaCode: toArea.Code,
			Status:          models.BatchStatusTransferred,
			ManufactureDate: batch.ManufactureDate,
			ExpiryDate:      batch.ExpiryDate,
		}
		newBatchID, err := s.repo.CreateBatch(tx, newBatch)
		if err != nil {
			return nil, err
		}
		if err := s.repo.UpdateTransferNewBatchID(tx, id, newBatchID); err != nil {
			return nil, err
		}
		transfer.NewBatchID = newBatchID
	}

	respJSON, _ := json.Marshal(transfer)
	idempotentReq := &models.IdempotentRequest{
		RequestID:    req.RequestID,
		RequestType:  "create_transfer",
		ResourceType: "transfer_record",
		ResourceID:   id,
		ResponseBody: string(respJSON),
	}
	if err := s.repo.SaveIdempotentRequest(tx, idempotentReq); err != nil {
		return nil, err
	}

	if err := s.repo.CreateAuditLog(tx, "create_transfer", "transfer_record", id, req.Operator, nil, transfer); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return transfer, nil
}

func (s *Service) UndoTransfer(req *TransferUndoRequest) (*models.TransferRecord, error) {
	transfer, err := s.repo.GetTransferByID(req.TransferID)
	if err != nil {
		return nil, models.ErrTransferNotFound
	}

	if transfer.Undone {
		return nil, models.ErrInvalidState
	}

	if transfer.Status == models.TransferStatusReviewed {
		return nil, models.ErrReviewRequired
	}

	batch, err := s.repo.GetBatchByID(transfer.BatchID)
	if err != nil {
		return nil, models.ErrBatchNotFound
	}

	undoneAt := time.Now()

	tx, err := s.repo.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	if err := s.repo.UndoTransfer(tx, transfer.ID, req.Operator, undoneAt); err != nil {
		return nil, err
	}

	if transfer.NewBatchID > 0 {
		if err := s.repo.UpdateBatchQuantity(tx, batch.ID, transfer.Quantity); err != nil {
			return nil, err
		}
		if err := s.repo.DeleteBatch(tx, transfer.NewBatchID); err != nil {
			return nil, err
		}
	} else {
		if err := s.repo.UpdateBatchAreaAndQuantity(tx, batch.ID, transfer.FromAreaID, transfer.FromAreaCode, batch.Quantity); err != nil {
			return nil, err
		}
	}

	if err := s.repo.CreateAuditLog(tx, "undo_transfer", "transfer_record", transfer.ID, req.Operator, transfer.Status, models.TransferStatusUndone); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	transfer.Undone = true
	transfer.UndoneBy = &req.Operator
	transfer.UndoneAt = &undoneAt
	transfer.Status = models.TransferStatusUndone

	return transfer, nil
}

func (s *Service) GetBatchTrace(batchNo string) (map[string]interface{}, error) {
	batch, err := s.repo.GetBatchByNo(batchNo)
	if err != nil {
		return nil, models.ErrBatchNotFound
	}

	transfers, err := s.repo.GetBatchTransferHistory(batch.ID)
	if err != nil {
		return nil, err
	}

	inspections, err := s.repo.GetBatchInspectionHistory(batch.ID)
	if err != nil {
		return nil, err
	}

	result := map[string]interface{}{
		"batch":       batch,
		"transfers":   transfers,
		"inspections": inspections,
	}

	return result, nil
}

func (s *Service) CreateInspection(req *InspectionRequest) (*models.InspectionRecord, error) {
	batch, err := s.repo.GetBatchByNo(req.BatchNo)
	if err != nil {
		return nil, models.ErrBatchNotFound
	}

	area, err := s.repo.GetAreaByCode(req.AreaCode)
	if err != nil {
		return nil, models.ErrAreaNotFound
	}

	if batch.CurrentAreaID != area.ID {
		return nil, models.ErrInvalidState
	}

	inspection := &models.InspectionRecord{
		RequestID:     req.RequestID,
		BatchID:       batch.ID,
		BatchNo:       batch.BatchNo,
		AreaID:        area.ID,
		AreaCode:      area.Code,
		InspectedAt:   req.InspectedAt,
		Inspector:     req.Inspector,
		PackageCheck:  req.PackageCheck,
		HumidityCheck: req.HumidityCheck,
		QualityStatus: req.QualityStatus,
		Photos:        req.Photos,
		Remark:        req.Remark,
		Status:        models.InspectionStatusComplete,
	}

	tx, err := s.repo.DB.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	id, err := s.repo.CreateInspection(tx, inspection)
	if err != nil {
		return nil, err
	}
	inspection.ID = id

	if err := s.repo.UpdateBatchArea(tx, batch.ID, batch.CurrentAreaID, batch.CurrentAreaCode, 0); err != nil {
		return nil, err
	}

	respJSON, _ := json.Marshal(inspection)
	idempotentReq := &models.IdempotentRequest{
		RequestID:    req.RequestID,
		RequestType:  "create_inspection",
		ResourceType: "inspection_record",
		ResourceID:   id,
		ResponseBody: string(respJSON),
	}
	if err := s.repo.SaveIdempotentRequest(tx, idempotentReq); err != nil {
		return nil, err
	}

	if err := s.repo.CreateAuditLog(tx, "create_inspection", "inspection_record", id, req.Inspector, nil, inspection); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return inspection, nil
}

func (s *Service) Review(req *ReviewRequest) error {
	reviewedAt := time.Now()

	var err error
	switch req.ResourceType {
	case "sample":
		sample, err := s.repo.GetSampleByID(req.ResourceID)
		if err != nil {
			return models.ErrSampleNotFound
		}
		if sample.Status != models.SampleStatusOverLimit && sample.Status != models.SampleStatusResolved {
			return models.ErrInvalidState
		}
	case "ventilation":
		vent, err := s.repo.GetVentilationByID(req.ResourceID)
		if err != nil {
			return err
		}
		if vent.Status != models.VentilationStatusComplete {
			return models.ErrInvalidState
		}
	case "transfer":
		transfer, err := s.repo.GetTransferByID(req.ResourceID)
		if err != nil {
			return models.ErrTransferNotFound
		}
		if transfer.Status != models.TransferStatusComplete || transfer.Undone {
			return models.ErrInvalidState
		}
	case "inspection":
		inspection, err := s.repo.GetInspectionByID(req.ResourceID)
		if err != nil {
			return err
		}
		if inspection.Status != models.InspectionStatusComplete {
			return models.ErrInvalidState
		}
	default:
		return models.ErrValidationFailed
	}
	if err != nil {
		return err
	}

	tx, err := s.repo.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	switch req.ResourceType {
	case "sample":
		if err := s.repo.ReviewSample(tx, req.ResourceID, req.ReviewedBy, reviewedAt); err != nil {
			return err
		}
	case "ventilation":
		if err := s.repo.ReviewVentilation(tx, req.ResourceID, req.ReviewedBy, reviewedAt); err != nil {
			return err
		}
	case "transfer":
		if err := s.repo.ReviewTransfer(tx, req.ResourceID, req.ReviewedBy, reviewedAt); err != nil {
			return err
		}
	case "inspection":
		if err := s.repo.ReviewInspection(tx, req.ResourceID, req.ReviewedBy, reviewedAt); err != nil {
			return err
		}
	}

	if err := s.repo.CreateAuditLog(tx, "review", req.ResourceType, req.ResourceID, req.ReviewedBy, nil, "reviewed"); err != nil {
		return err
	}

	return tx.Commit()
}

func (s *Service) GenerateReport(req *ReportRequest) (*models.RiskReport, error) {
	samples, err := s.repo.GetSamplesForReport(req.PeriodStart, req.PeriodEnd)
	if err != nil {
		return nil, err
	}

	ventCount, transferCount, inspectionCount, err := s.repo.CountActionsForReport(req.PeriodStart, req.PeriodEnd)
	if err != nil {
		return nil, err
	}

	overLimitCount := 0
	maxRisk := models.RiskLevelNormal
	for _, s := range samples {
		if s.Status == models.SampleStatusOverLimit || s.Status == models.SampleStatusProcessing || s.Status == models.SampleStatusResolved {
			overLimitCount++
		}
		if s.RiskLevel == models.RiskLevelHigh {
			maxRisk = models.RiskLevelHigh
		} else if s.RiskLevel == models.RiskLevelMedium && maxRisk != models.RiskLevelHigh {
			maxRisk = models.RiskLevelMedium
		} else if s.RiskLevel == models.RiskLevelLow && maxRisk == models.RiskLevelNormal {
			maxRisk = models.RiskLevelLow
		}
	}

	reportNo := fmt.Sprintf("RPT-%s-%d", time.Now().Format("20060102"), time.Now().Unix())

	summary := fmt.Sprintf("本期共采集湿度样本 %d 次，其中超限 %d 次，执行通风 %d 次，转仓 %d 次，抽检 %d 次。整体风险等级: %s。",
		len(samples), overLimitCount, ventCount, transferCount, inspectionCount, maxRisk)

	recommendations := []string{}
	if overLimitCount > 5 {
		recommendations = append(recommendations, "建议增加湿度采样频率")
	}
	if maxRisk == models.RiskLevelHigh {
		recommendations = append(recommendations, "高风险预警：建议立即采取紧急通风或转仓措施")
	}
	if maxRisk == models.RiskLevelMedium {
		recommendations = append(recommendations, "中风险提醒：建议加强库区巡查")
	}
	if len(recommendations) == 0 {
		recommendations = append(recommendations, "湿度状况良好，继续保持当前管理措施")
	}

	report := &models.RiskReport{
		ReportNo:         reportNo,
		ReportType:       req.ReportType,
		PeriodStart:      req.PeriodStart,
		PeriodEnd:        req.PeriodEnd,
		GeneratedAt:      time.Now(),
		GeneratedBy:      req.GeneratedBy,
		TotalSamples:     len(samples),
		OverLimitCount:   overLimitCount,
		TransferCount:    transferCount,
		InspectionCount:  inspectionCount,
		VentilationCount: ventCount,
		RiskLevel:        maxRisk,
		Summary:          summary,
		Recommendations:  recommendations,
		Status:           models.ReportStatusGenerated,
	}

	id, err := s.repo.CreateReport(report)
	if err != nil {
		return nil, err
	}
	report.ID = id

	return report, nil
}

func (s *Service) GetPendingReviews() (map[string]interface{}, error) {
	return s.repo.ListPendingReviews()
}

func (s *Service) GetAreas() ([]models.WarehouseArea, error) {
	return s.repo.ListAreas()
}

func (s *Service) GetAreaBatches(areaCode string) ([]models.FireworksBatch, error) {
	area, err := s.repo.GetAreaByCode(areaCode)
	if err != nil {
		return nil, models.ErrAreaNotFound
	}
	return s.repo.GetBatchesByArea(area.ID)
}

func (s *Service) GetSample(id int64) (*models.HumiditySample, error) {
	return s.repo.GetSampleByID(id)
}

func (s *Service) GetBatch(batchNo string) (*models.FireworksBatch, error) {
	return s.repo.GetBatchByNo(batchNo)
}

func (s *Service) GetReport(reportNo string) (*models.RiskReport, error) {
	return s.repo.GetReportByNo(reportNo)
}

func (s *Service) GetTransfer(id int64) (*models.TransferRecord, error) {
	return s.repo.GetTransferByID(id)
}
