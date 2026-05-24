package processor

import (
	"fmt"
	"prescription-timeline/database"
	"prescription-timeline/models"
	"prescription-timeline/services/validator"
	"time"

	"github.com/google/uuid"
)

type ProcessorService struct {
	validator *validator.ValidatorService
}

func New(validator *validator.ValidatorService) *ProcessorService {
	return &ProcessorService{validator: validator}
}

type CreatePrescriptionRequest struct {
	Prescription   *models.Prescription
	Consultation   *models.Consultation
	Patient        *models.Patient
	OperatorID     string
	OperatorName   string
}

func (p *ProcessorService) CreatePrescription(req *CreatePrescriptionRequest) (*models.Prescription, error) {
	if req.Patient != nil {
		req.Patient.ID = uuid.New().String()
		req.Patient.CreatedAt = time.Now()
		req.Patient.UpdatedAt = time.Now()
		if err := database.CreatePatient(req.Patient); err != nil {
			return nil, fmt.Errorf("创建患者失败: %w", err)
		}
		req.Prescription.PatientID = req.Patient.ID
	}

	if req.Consultation != nil {
		req.Consultation.ID = uuid.New().String()
		req.Consultation.PatientID = req.Prescription.PatientID
		req.Consultation.CreatedAt = time.Now()
		req.Consultation.UpdatedAt = time.Now()
		if err := database.CreateConsultation(req.Consultation); err != nil {
			return nil, fmt.Errorf("创建问诊单失败: %w", err)
		}
		req.Prescription.ConsultationID = req.Consultation.ID
	}

	req.Prescription.ID = uuid.New().String()
	req.Prescription.Status = models.PrescriptionStatusPending
	req.Prescription.CreatedAt = time.Now()
	req.Prescription.UpdatedAt = time.Now()

	if err := database.CreatePrescription(req.Prescription); err != nil {
		return nil, fmt.Errorf("创建处方失败: %w", err)
	}

	if err := p.logAction(&models.ProcessingLog{
		ID:              uuid.New().String(),
		PrescriptionID:  req.Prescription.ID,
		ActionType:      models.ActionTypeCreate,
		ActionDetail:    "创建处方",
		OperatorID:      req.OperatorID,
		OperatorName:    req.OperatorName,
		IsManualConfirm: false,
		CreatedAt:       time.Now(),
	}); err != nil {
		return nil, err
	}

	if err := p.initReport(req.Prescription, req.OperatorID, req.OperatorName); err != nil {
		return nil, err
	}

	return req.Prescription, nil
}

func (p *ProcessorService) ReviewPrescription(prescriptionID, pharmacistID, pharmacistName, result, opinion string) (*models.PharmacistReview, error) {
	prescription, err := database.GetPrescriptionByID(prescriptionID)
	if err != nil {
		return nil, err
	}

	reviews, err := database.GetReviewsByPrescriptionID(prescriptionID)
	if err != nil {
		return nil, err
	}
	isFirstReview := len(reviews) == 0

	review := &models.PharmacistReview{
		ID:             uuid.New().String(),
		PrescriptionID: prescriptionID,
		PharmacistID:   pharmacistID,
		PharmacistName: pharmacistName,
		ReviewTime:     time.Now(),
		ReviewResult:   result,
		ReviewOpinion:  opinion,
		IsFirstReview:  isFirstReview,
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	if err := database.CreatePharmacistReview(review); err != nil {
		return nil, err
	}

	if result == models.ReviewResultPass {
		prescription.Status = models.PrescriptionStatusReviewed
	} else if result == models.ReviewResultReject {
		prescription.Status = models.PrescriptionStatusRejected
	}
	prescription.UpdatedAt = time.Now()
	if err := database.UpdatePrescription(prescription); err != nil {
		return nil, err
	}

	if err := p.logAction(&models.ProcessingLog{
		ID:              uuid.New().String(),
		PrescriptionID:  prescriptionID,
		ActionType:      models.ActionTypeReview,
		ActionDetail:    fmt.Sprintf("药师审核: %s, 意见: %s", result, opinion),
		OperatorID:      pharmacistID,
		OperatorName:    pharmacistName,
		IsManualConfirm: true,
		CreatedAt:       time.Now(),
	}); err != nil {
		return nil, err
	}

	if err := p.updateReportReviewTime(prescriptionID, review.ReviewTime); err != nil {
		return nil, err
	}

	return review, nil
}

func (p *ProcessorService) PatientConfirm(prescriptionID, operatorID, operatorName string) error {
	prescription, err := database.GetPrescriptionByID(prescriptionID)
	if err != nil {
		return err
	}

	now := time.Now()
	prescription.PatientConfirmTime = &now
	prescription.Status = models.PrescriptionStatusConfirmed
	prescription.UpdatedAt = now

	if err := database.UpdatePrescription(prescription); err != nil {
		return err
	}

	if err := p.logAction(&models.ProcessingLog{
		ID:              uuid.New().String(),
		PrescriptionID:  prescriptionID,
		ActionType:      models.ActionTypeConfirm,
		ActionDetail:    "患者确认处方",
		OperatorID:      operatorID,
		OperatorName:    operatorName,
		IsManualConfirm: true,
		CreatedAt:       now,
	}); err != nil {
		return err
	}

	if err := p.updateReportPatientConfirmTime(prescriptionID, &now); err != nil {
		return err
	}

	return nil
}

func (p *ProcessorService) DispenseDrug(prescriptionID, pharmacistID, pharmacistName, drugItems string, manualOverride bool, overrideReason string) (*models.DrugDispensation, error) {
	canDispense, reason, err := p.validator.CanDispense(prescriptionID)
	if err != nil {
		return nil, err
	}

	dispensation := &models.DrugDispensation{
		ID:                 uuid.New().String(),
		PrescriptionID:     prescriptionID,
		PharmacistID:       pharmacistID,
		PharmacistName:     pharmacistName,
		DispensationTime:   time.Now(),
		DrugItems:          drugItems,
		IsDuplicate:        false,
		Intercepted:        !canDispense && !manualOverride,
		InterceptReason:    reason,
		ManualOverride:     manualOverride,
		OverrideOperatorID: pharmacistID,
		OverrideReason:     overrideReason,
		CreatedAt:          time.Now(),
		UpdatedAt:          time.Now(),
	}

	count, _ := database.CountDispensations(prescriptionID)
	dispensation.IsDuplicate = count > 0

	if !canDispense {
		if manualOverride {
			dispensation.Intercepted = false
			dispensation.InterceptReason = reason + "（已人工放行）"
			if err := p.logAction(&models.ProcessingLog{
				ID:              uuid.New().String(),
				PrescriptionID:  prescriptionID,
				ActionType:      models.ActionTypeOverride,
				ActionDetail:    fmt.Sprintf("人工放开发药: %s, 原因: %s", reason, overrideReason),
				OperatorID:      pharmacistID,
				OperatorName:    pharmacistName,
				IsManualConfirm: true,
				CreatedAt:       time.Now(),
			}); err != nil {
				return nil, err
			}
		} else {
			if err := p.logAction(&models.ProcessingLog{
				ID:              uuid.New().String(),
				PrescriptionID:  prescriptionID,
				ActionType:      models.ActionTypeIntercept,
				ActionDetail:    fmt.Sprintf("拦截发药: %s", reason),
				OperatorID:      pharmacistID,
				OperatorName:    pharmacistName,
				IsManualConfirm: false,
				CreatedAt:       time.Now(),
			}); err != nil {
				return nil, err
			}
		}
	}

	if err := database.CreateDrugDispensation(dispensation); err != nil {
		return nil, err
	}

	if !dispensation.Intercepted {
		prescription, _ := database.GetPrescriptionByID(prescriptionID)
		prescription.Status = models.PrescriptionStatusDispensed
		prescription.UpdatedAt = time.Now()
		database.UpdatePrescription(prescription)

		if err := p.logAction(&models.ProcessingLog{
			ID:              uuid.New().String(),
			PrescriptionID:  prescriptionID,
			ActionType:      models.ActionTypeDispense,
			ActionDetail:    "发药完成",
			OperatorID:      pharmacistID,
			OperatorName:    pharmacistName,
			IsManualConfirm: true,
			CreatedAt:       time.Now(),
		}); err != nil {
			return nil, err
		}

		dispTime := dispensation.DispensationTime
		if err := p.updateReportDispensationTime(prescriptionID, &dispTime); err != nil {
			return nil, err
		}
	}

	return dispensation, nil
}

type SupplementRequest struct {
	PrescriptionID string
	FieldName      string
	BeforeValue    string
	AfterValue     string
	OperatorID     string
	OperatorName   string
	Remark         string
}

func (p *ProcessorService) SupplementRecord(req *SupplementRequest) error {
	record := &models.SupplementRecord{
		ID:             uuid.New().String(),
		PrescriptionID: req.PrescriptionID,
		FieldName:      req.FieldName,
		BeforeValue:    req.BeforeValue,
		AfterValue:     req.AfterValue,
		OperatorID:     req.OperatorID,
		OperatorName:   req.OperatorName,
		SupplementTime: time.Now(),
		Remark:         req.Remark,
		CreatedAt:      time.Now(),
	}

	if err := database.CreateSupplementRecord(record); err != nil {
		return err
	}

	if err := p.logAction(&models.ProcessingLog{
		ID:              uuid.New().String(),
		PrescriptionID:  req.PrescriptionID,
		ActionType:      models.ActionTypeSupplement,
		ActionDetail:    fmt.Sprintf("补录字段 %s: %s -> %s, 备注: %s", req.FieldName, req.BeforeValue, req.AfterValue, req.Remark),
		OperatorID:      req.OperatorID,
		OperatorName:    req.OperatorName,
		IsManualConfirm: true,
		CreatedAt:       time.Now(),
	}); err != nil {
		return err
	}

	return nil
}

func (p *ProcessorService) logAction(log *models.ProcessingLog) error {
	return database.CreateProcessingLog(log)
}

func (p *ProcessorService) initReport(prescription *models.Prescription, operatorID, operatorName string) error {
	report := &models.PrescriptionReport{
		ID:                   uuid.New().String(),
		PrescriptionID:       prescription.ID,
		ConsultationID:       prescription.ConsultationID,
		PatientID:            prescription.PatientID,
		DoctorAdviceTime:     prescription.PrescriptionTime,
		ProcessingSuggestion: "待审核和患者确认",
		OperatorID:           operatorID,
		OperatorName:         operatorName,
		CreatedAt:            time.Now(),
		UpdatedAt:            time.Now(),
	}
	return database.CreatePrescriptionReport(report)
}

func (p *ProcessorService) updateReportReviewTime(prescriptionID string, reviewTime time.Time) error {
	report, err := database.GetReportByPrescriptionID(prescriptionID)
	if err != nil {
		return err
	}
	report.ReviewTime = &reviewTime
	report.UpdatedAt = time.Now()
	return database.UpdatePrescriptionReport(report)
}

func (p *ProcessorService) updateReportPatientConfirmTime(prescriptionID string, confirmTime *time.Time) error {
	report, err := database.GetReportByPrescriptionID(prescriptionID)
	if err != nil {
		return err
	}
	report.PatientConfirmTime = confirmTime
	report.UpdatedAt = time.Now()
	return database.UpdatePrescriptionReport(report)
}

func (p *ProcessorService) updateReportDispensationTime(prescriptionID string, dispensationTime *time.Time) error {
	report, err := database.GetReportByPrescriptionID(prescriptionID)
	if err != nil {
		return err
	}
	report.DispensationTime = dispensationTime
	report.UpdatedAt = time.Now()
	return database.UpdatePrescriptionReport(report)
}

func (p *ProcessorService) GetFullTimeline(prescriptionID string) (map[string]interface{}, error) {
	prescription, err := database.GetPrescriptionByID(prescriptionID)
	if err != nil {
		return nil, err
	}

	reviews, _ := database.GetReviewsByPrescriptionID(prescriptionID)
	dispensations, _ := database.GetDispensationsByPrescriptionID(prescriptionID)
	supplements, _ := database.GetSupplementsByPrescriptionID(prescriptionID)
	logs, _ := database.GetLogsByPrescriptionID(prescriptionID)
	report, _ := database.GetReportByPrescriptionID(prescriptionID)

	return map[string]interface{}{
		"prescription":  prescription,
		"reviews":       reviews,
		"dispensations": dispensations,
		"supplements":   supplements,
		"logs":          logs,
		"report":        report,
	}, nil
}

func (p *ProcessorService) ListPrescriptions(status string) ([]models.Prescription, error) {
	return database.ListPrescriptions(status)
}

func (p *ProcessorService) GetPrescription(prescriptionID string) (*models.Prescription, error) {
	return database.GetPrescriptionByID(prescriptionID)
}
