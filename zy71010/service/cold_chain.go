package service

import (
	"fmt"
	"math"
	"time"

	"vet-vaccine-cold-chain/config"
	"vet-vaccine-cold-chain/models"
	"vet-vaccine-cold-chain/repository"
)

func ValidateColdChainWindow(refrigeratorID string, startTime, endTime time.Time) (*models.ColdChainValidation, error) {
	cfg := config.Load()
	records, err := repository.GetTemperatureRecords(refrigeratorID, startTime, endTime)
	if err != nil {
		return nil, err
	}

	validation := &models.ColdChainValidation{
		Valid:       true,
		Breakpoints: []models.Breakpoint{},
		MinTemp:     math.MaxFloat64,
		MaxTemp:     -math.MaxFloat64,
		AvgTemp:     0,
	}
	validation.ValidationWindow.Start = startTime
	validation.ValidationWindow.End = endTime

	if len(records) == 0 {
		validation.Valid = false
		validation.Breakpoints = append(validation.Breakpoints, models.Breakpoint{
			Time:   startTime,
			Reason: "无温度记录",
		})
		return validation, nil
	}

	var sum float64
	for _, r := range records {
		sum += r.Temperature
		if r.Temperature < validation.MinTemp {
			validation.MinTemp = r.Temperature
		}
		if r.Temperature > validation.MaxTemp {
			validation.MaxTemp = r.Temperature
		}

		if r.Temperature < cfg.ColdChainMinTemp {
			validation.Valid = false
			validation.Breakpoints = append(validation.Breakpoints, models.Breakpoint{
				Time:        r.RecordedAt,
				Temperature: r.Temperature,
				Reason:      fmt.Sprintf("温度低于最低阈值 %.1f°C", cfg.ColdChainMinTemp),
			})
		} else if r.Temperature > cfg.ColdChainMaxTemp {
			validation.Valid = false
			validation.Breakpoints = append(validation.Breakpoints, models.Breakpoint{
				Time:        r.RecordedAt,
				Temperature: r.Temperature,
				Reason:      fmt.Sprintf("温度高于最高阈值 %.1f°C", cfg.ColdChainMaxTemp),
			})
		}
	}
	validation.AvgTemp = sum / float64(len(records))

	return validation, nil
}

func GetOpenVialStatus(openRecordID string) (*models.OpenVialStatus, error) {
	cfg := config.Load()
	or, err := repository.GetOpenRecordByID(openRecordID)
	if err != nil {
		return nil, err
	}

	vaccine, err := repository.GetVaccineByBatch(or.BatchNumber)
	if err != nil {
		return nil, err
	}

	status := &models.OpenVialStatus{
		OpenRecordID:   or.ID,
		Status:         or.Status,
		OpenedAt:       or.OpenedAt,
		MaxAllowedTime: cfg.MaxOpenHours.String(),
		DosesUsed:      or.DosesUsed,
		DosesRemaining: 0,
	}

	if vaccine != nil {
		status.DosesRemaining = vaccine.TotalDoses - or.DosesUsed
	}

	timeOpen := time.Since(or.OpenedAt)
	status.TimeOpen = timeOpen.String()
	status.Expired = timeOpen > cfg.MaxOpenHours

	if or.Status == "opened" && status.Expired {
		or.Status = "expired"
		repository.UpdateOpenRecord(or)
		status.Status = "expired"
	}

	return status, nil
}

func GetTransferTrail(batchNumber string) (*models.TransferTrail, error) {
	transfers, err := repository.GetTransfersByBatch(batchNumber)
	if err != nil {
		return nil, err
	}

	trail := &models.TransferTrail{
		Transfers:      transfers,
		TotalTransfers: len(transfers),
		CurrentFridge:  "",
	}

	if len(transfers) > 0 {
		trail.CurrentFridge = transfers[len(transfers)-1].ToRefrigeratorID
	}

	return trail, nil
}

func ProcessVaccineTransfer(batchNumber, fromFridge, toFridge string, doses int, transferredBy, reason string) error {
	fromInventory, err := repository.GetInventoryByBatchAndFridge(batchNumber, fromFridge)
	if err != nil {
		return err
	}
	if fromInventory == nil || fromInventory.DosesCount < doses {
		return fmt.Errorf("源冰箱库存不足")
	}

	fromInventory.DosesCount -= doses
	if fromInventory.DosesCount == 0 {
		fromInventory.Status = "transferred_out"
	}

	toInventory, err := repository.GetInventoryByBatchAndFridge(batchNumber, toFridge)
	if err != nil {
		return err
	}
	if toInventory == nil {
		toInventory = &models.VaccineInventory{
			BatchNumber:    batchNumber,
			RefrigeratorID: toFridge,
			DosesCount:     doses,
			Status:         "in_stock",
		}
		if err := repository.CreateVaccineInventory(toInventory); err != nil {
			return err
		}
	} else {
		toInventory.DosesCount += doses
	}

	transfer := &models.TransferRecord{
		BatchNumber:        batchNumber,
		FromRefrigeratorID: fromFridge,
		ToRefrigeratorID:   toFridge,
		DosesCount:         doses,
		TransferredBy:      transferredBy,
		Reason:             reason,
	}
	if err := repository.CreateTransferRecord(transfer); err != nil {
		return err
	}

	return nil
}

func ConfirmDiscardRecord(discardID, confirmedBy string) error {
	return repository.ConfirmDiscard(discardID, confirmedBy)
}

type EvaluateResult struct {
	Status string `json:"status"`
	Reason string `json:"reason"`
}

func EvaluateColdChainCompliance(businessKey, businessType string) (*EvaluateResult, error) {
	result := &EvaluateResult{
		Status: "compliant",
		Reason: "所有检查通过",
	}

	evidence, err := repository.GetEvidenceChain(businessKey, businessType)
	if err != nil {
		return nil, err
	}
	if len(evidence) == 0 {
		result.Status = "pending"
		result.Reason = "等待提交材料"
		return result, nil
	}

	var lastEvidence *models.EvidenceChain
	for _, e := range evidence {
		if e.EvidenceType == "temperature_complete" || e.EvidenceType == "open_vial_complete" || e.EvidenceType == "transfer_complete" {
			lastEvidence = &e
			break
		}
	}

	if lastEvidence == nil {
		for _, e := range evidence {
			if e.EvidenceType == "temperature" || e.EvidenceType == "open_vial" || e.EvidenceType == "transfer" {
				lastEvidence = &e
				break
			}
		}
	}

	if lastEvidence == nil {
		result.Status = "needs_review"
		result.Reason = "需要人工审核"
		return result, nil
	}

	switch lastEvidence.EvidenceType {
	case "temperature", "temperature_complete":
		var tempData struct {
			RefrigeratorID string    `json:"refrigerator_id"`
			StartTime      time.Time `json:"start_time"`
			EndTime        time.Time `json:"end_time"`
		}
		repository.DeserializeData(lastEvidence.EvidenceData, &tempData)
		validation, err := ValidateColdChainWindow(tempData.RefrigeratorID, tempData.StartTime, tempData.EndTime)
		if err != nil {
			return nil, err
		}
		if !validation.Valid {
			result.Status = "non_compliant"
			result.Reason = fmt.Sprintf("发现 %d 个温度断点", len(validation.Breakpoints))
		}

	case "open_vial", "open_vial_complete":
		var openData struct {
			OpenRecordID string `json:"open_record_id"`
		}
		repository.DeserializeData(lastEvidence.EvidenceData, &openData)
		status, err := GetOpenVialStatus(openData.OpenRecordID)
		if err != nil {
			return nil, err
		}
		if status.Expired {
			result.Status = "non_compliant"
			result.Reason = "开瓶后超时使用"
		}

	case "transfer", "transfer_complete":
		result.Status = "compliant"
		result.Reason = "调拨记录完整"
	}

	return result, nil
}

func ProcessSubmission(req *models.SubmissionRequest) (int, *EvaluateResult, error) {
	ec := &models.EvidenceChain{
		BusinessKey:  req.BusinessKey,
		BusinessType: req.BusinessType,
		EvidenceType: req.EvidenceType,
		EvidenceData: repository.SerializeData(req.EvidenceData),
		SubmittedBy:  req.SubmittedBy,
	}

	version, err := repository.AddEvidenceChain(ec)
	if err != nil {
		return 0, nil, err
	}

	var evalResult *EvaluateResult
	if req.AutoEvaluate {
		evalResult, err = EvaluateColdChainCompliance(req.BusinessKey, req.BusinessType)
		if err != nil {
			return version, nil, err
		}

		existingResult, err := repository.GetBusinessResult(req.BusinessKey, req.BusinessType)
		if err != nil {
			return version, evalResult, err
		}

		br := &models.BusinessResult{
			BusinessKey:  req.BusinessKey,
			BusinessType: req.BusinessType,
			ResultStatus: evalResult.Status,
			ResultData:   repository.SerializeData(evalResult),
		}

		isRecalculation := existingResult != nil
		if err := repository.SaveBusinessResult(br, isRecalculation); err != nil {
			return version, evalResult, err
		}
	}

	return version, evalResult, nil
}

func RecalculateResult(businessKey, businessType, recalculatedBy string) (*EvaluateResult, error) {
	evalResult, err := EvaluateColdChainCompliance(businessKey, businessType)
	if err != nil {
		return nil, err
	}

	existingResult, err := repository.GetBusinessResult(businessKey, businessType)
	if err != nil {
		return nil, err
	}

	if existingResult == nil {
		return nil, fmt.Errorf("未找到原始计算结果")
	}

	br := &models.BusinessResult{
		BusinessKey:       businessKey,
		BusinessType:      businessType,
		ResultStatus:      evalResult.Status,
		ResultData:        repository.SerializeData(evalResult),
		RecalculatedCount: existingResult.RecalculatedCount,
	}

	if err := repository.SaveBusinessResult(br, true); err != nil {
		return nil, err
	}

	return evalResult, nil
}

func ReturnForCorrection(businessKey, businessType, reason, returnedBy string) error {
	ec := &models.EvidenceChain{
		BusinessKey:  businessKey,
		BusinessType: businessType,
		EvidenceType: "return_for_correction",
		EvidenceData: repository.SerializeData(map[string]string{"reason": reason, "returned_by": returnedBy}),
		SubmittedBy:  returnedBy,
	}
	_, err := repository.AddEvidenceChain(ec)
	return err
}
