package service

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"irrigation-water-rights/internal/models"
	"irrigation-water-rights/internal/repository"

	"gorm.io/gorm"
)

type IrrigationService struct {
	repo *repository.Repository
}

func NewIrrigationService(repo *repository.Repository) *IrrigationService {
	return &IrrigationService{repo: repo}
}

type IrrigationRequest struct {
	FarmerID       uint      `json:"farmer_id"`
	PlotID         uint      `json:"plot_id"`
	WaterAmount    float64   `json:"water_amount"`
	IrrigationDate time.Time `json:"irrigation_date"`
	Week           int       `json:"week"`
	Year           int       `json:"year"`
	Operator       string    `json:"operator"`
	Remarks        string    `json:"remarks"`
	RecordNo       string    `json:"record_no,omitempty"`
}

type IrrigationResult struct {
	Success     bool    `json:"success"`
	Message     string  `json:"message"`
	RecordNo    string  `json:"record_no,omitempty"`
	WaterUsed   float64 `json:"water_used,omitempty"`
	Remaining   float64 `json:"remaining,omitempty"`
	IsDuplicate bool    `json:"is_duplicate,omitempty"`
}

func (s *IrrigationService) RecordIrrigation(req IrrigationRequest) (*IrrigationResult, error) {
	if req.WaterAmount <= 0 {
		return &IrrigationResult{
			Success: false,
			Message: "灌溉水量必须大于0",
		}, errors.New("invalid amount")
	}

	plot, err := s.repo.GetPlotByID(req.PlotID)
	if err != nil {
		return &IrrigationResult{
			Success: false,
			Message: "地块不存在",
		}, err
	}

	if plot.FarmerID != req.FarmerID {
		return &IrrigationResult{
			Success: false,
			Message: fmt.Sprintf("地块不属于该农户，地块所属农户ID: %d", plot.FarmerID),
		}, errors.New("plot not belong to farmer")
	}

	duplicate, err := s.repo.CheckDuplicateIrrigation(req.PlotID, req.IrrigationDate)
	if err != nil {
		return &IrrigationResult{
			Success: false,
			Message: "检查重复灌溉失败",
		}, err
	}

	if duplicate {
		return &IrrigationResult{
			Success:     false,
			Message:     fmt.Sprintf("地块%s在%s已有灌溉记录，禁止重复灌溉", plot.PlotNumber, req.IrrigationDate.Format("2006-01-02")),
			IsDuplicate: true,
		}, errors.New("duplicate irrigation")
	}

	wr, err := s.repo.GetWaterRight(req.FarmerID, req.Year, req.Week)
	if err != nil {
		return &IrrigationResult{
			Success: false,
			Message: fmt.Sprintf("农户水权信息不存在: 农户%d-%d年第%d周", req.FarmerID, req.Year, req.Week),
		}, err
	}

	if wr.Balance < req.WaterAmount {
		return &IrrigationResult{
			Success: false,
			Message: fmt.Sprintf("水权余额不足: 可用余额%.2f立方米，申请灌溉%.2f立方米", wr.Balance, req.WaterAmount),
		}, errors.New("insufficient balance")
	}

	recordNo := req.RecordNo
	if recordNo == "" {
		recordNo = fmt.Sprintf("IR%04d%02d%010d", req.Year, req.Week, time.Now().UnixNano()%10000000000)
	} else {
		_, err := s.repo.GetIrrigationByNo(recordNo)
		if err == nil {
			return &IrrigationResult{
				Success:     false,
				Message:     fmt.Sprintf("记录编号%s已存在，仅可更新证据链，不可重复记账", recordNo),
				IsDuplicate: true,
			}, errors.New("duplicate record no")
		}
	}

	tx := s.repo.DB().Begin()

	oldWR := *wr
	wr.Balance -= req.WaterAmount
	wr.UsedQuota += req.WaterAmount
	if err := tx.Save(wr).Error; err != nil {
		tx.Rollback()
		return &IrrigationResult{
			Success: false,
			Message: "更新水权余额失败",
		}, err
	}

	record := &models.IrrigationRecord{
		RecordNo:       recordNo,
		FarmerID:       req.FarmerID,
		PlotID:         req.PlotID,
		WaterAmount:    req.WaterAmount,
		IrrigationDate: req.IrrigationDate,
		Week:           req.Week,
		Year:           req.Year,
		Operator:       req.Operator,
		Remarks:        req.Remarks,
		EvidenceChain:  fmt.Sprintf("创建记录:%s", time.Now().Format(time.RFC3339)),
	}

	if err := tx.Create(record).Error; err != nil {
		tx.Rollback()
		return &IrrigationResult{
			Success: false,
			Message: "创建灌溉记录失败",
		}, err
	}

	if err := recordChangeHistoryTxIrrigation(tx, "water_right", wr.ID, oldWR, *wr, "灌溉扣减", req.Operator); err != nil {
		tx.Rollback()
		return &IrrigationResult{
			Success: false,
			Message: "记录变更历史失败",
		}, err
	}

	tx.Commit()

	return &IrrigationResult{
		Success:   true,
		Message:   "灌溉记录已创建，水权已扣减",
		RecordNo:  recordNo,
		WaterUsed: req.WaterAmount,
		Remaining: wr.Balance,
	}, nil
}

func (s *IrrigationService) UpdateEvidence(recordNo string, evidence string, operator string) (*IrrigationResult, error) {
	record, err := s.repo.GetIrrigationByNo(recordNo)
	if err != nil {
		return &IrrigationResult{
			Success: false,
			Message: "灌溉记录不存在",
		}, err
	}

	oldRecord := *record
	record.EvidenceChain += fmt.Sprintf(" | 补充证据[%s]:%s", operator, evidence)
	record.UpdatedAt = time.Now()

	if err := s.repo.DB().Save(record).Error; err != nil {
		return &IrrigationResult{
			Success: false,
			Message: "更新证据链失败",
		}, err
	}

	s.repo.RecordChangeHistory("irrigation", record.ID, oldRecord, *record, "补充证据", operator)

	return &IrrigationResult{
		Success:  true,
		Message:  "证据链已更新，业务数据未改动",
		RecordNo: recordNo,
	}, nil
}

func recordChangeHistoryTxIrrigation(tx *gorm.DB, resourceType string, resourceID uint, before, after interface{}, reason, operator string) error {
	beforeJSON, _ := json.Marshal(before)
	afterJSON, _ := json.Marshal(after)
	history := &models.ChangeHistory{
		ResourceType: resourceType,
		ResourceID:   resourceID,
		BeforeValue:  string(beforeJSON),
		AfterValue:   string(afterJSON),
		ChangeReason: reason,
		Operator:     operator,
	}
	return tx.Create(history).Error
}
