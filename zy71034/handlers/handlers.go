package handlers

import (
	"encoding/csv"
	"net/http"
	"prescription-timeline/models"
	"prescription-timeline/services/closer"
	"prescription-timeline/services/processor"
	"prescription-timeline/services/validator"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	validator *validator.ValidatorService
	processor *processor.ProcessorService
	closer    *closer.CloserService
}

func New(validator *validator.ValidatorService, processor *processor.ProcessorService, closer *closer.CloserService) *Handler {
	return &Handler{
		validator: validator,
		processor: processor,
		closer:    closer,
	}
}

type CreatePrescriptionRequest struct {
	Patient struct {
		Name   string `json:"name"`
		IDCard string `json:"id_card"`
		Phone  string `json:"phone"`
	} `json:"patient"`
	Consultation struct {
		DoctorID       string    `json:"doctor_id"`
		DoctorName     string    `json:"doctor_name"`
		Department     string    `json:"department"`
		ChiefComplaint string    `json:"chief_complaint"`
		Diagnosis      string    `json:"diagnosis"`
		ConsultTime    time.Time `json:"consult_time"`
	} `json:"consultation"`
	Prescription struct {
		DoctorID       string `json:"doctor_id"`
		DoctorName     string `json:"doctor_name"`
		DrugList       string `json:"drug_list"`
		Dosage         string `json:"dosage"`
		DoctorAdvice   string `json:"doctor_advice"`
		ValidityHours  int    `json:"validity_hours"`
		PrescriptionTime string `json:"prescription_time"`
	} `json:"prescription"`
	OperatorID   string `json:"operator_id"`
	OperatorName string `json:"operator_name"`
}

func (h *Handler) CreatePrescription(c *gin.Context) {
	var req CreatePrescriptionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	prescriptionTime, err := time.Parse("2006-01-02 15:04:05", req.Prescription.PrescriptionTime)
	if err != nil {
		prescriptionTime = time.Now()
	}

	patient := &models.Patient{
		Name:   req.Patient.Name,
		IDCard: req.Patient.IDCard,
		Phone:  req.Patient.Phone,
	}

	consultation := &models.Consultation{
		DoctorID:       req.Consultation.DoctorID,
		DoctorName:     req.Consultation.DoctorName,
		Department:     req.Consultation.Department,
		ChiefComplaint: req.Consultation.ChiefComplaint,
		Diagnosis:      req.Consultation.Diagnosis,
		ConsultTime:    req.Consultation.ConsultTime,
		Status:         "completed",
	}

	prescription := &models.Prescription{
		DoctorID:         req.Prescription.DoctorID,
		DoctorName:       req.Prescription.DoctorName,
		PrescriptionTime: prescriptionTime,
		DrugList:         req.Prescription.DrugList,
		Dosage:           req.Prescription.Dosage,
		DoctorAdvice:     req.Prescription.DoctorAdvice,
		ValidityHours:    req.Prescription.ValidityHours,
	}

	result, err := h.processor.CreatePrescription(&processor.CreatePrescriptionRequest{
		Prescription: prescription,
		Consultation: consultation,
		Patient:      patient,
		OperatorID:   req.OperatorID,
		OperatorName: req.OperatorName,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "处方创建成功",
		"data":    result,
	})
}

func (h *Handler) ValidatePrescription(c *gin.Context) {
	prescriptionID := c.Param("id")
	result, err := h.validator.ValidatePrescription(prescriptionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "校验完成",
		"data":    result,
	})
}

type ReviewRequest struct {
	PharmacistID   string `json:"pharmacist_id"`
	PharmacistName string `json:"pharmacist_name"`
	Result         string `json:"result"`
	Opinion        string `json:"opinion"`
}

func (h *Handler) ReviewPrescription(c *gin.Context) {
	prescriptionID := c.Param("id")
	var req ReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	review, err := h.processor.ReviewPrescription(prescriptionID, req.PharmacistID, req.PharmacistName, req.Result, req.Opinion)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "审核完成",
		"data":    review,
	})
}

type PatientConfirmRequest struct {
	OperatorID   string `json:"operator_id"`
	OperatorName string `json:"operator_name"`
}

func (h *Handler) PatientConfirm(c *gin.Context) {
	prescriptionID := c.Param("id")
	var req PatientConfirmRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.processor.PatientConfirm(prescriptionID, req.OperatorID, req.OperatorName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "患者确认成功",
	})
}

type DispenseRequest struct {
	PharmacistID   string `json:"pharmacist_id"`
	PharmacistName string `json:"pharmacist_name"`
	DrugItems      string `json:"drug_items"`
	ManualOverride bool   `json:"manual_override"`
	OverrideReason string `json:"override_reason"`
}

func (h *Handler) DispenseDrug(c *gin.Context) {
	prescriptionID := c.Param("id")
	var req DispenseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	dispensation, err := h.processor.DispenseDrug(prescriptionID, req.PharmacistID, req.PharmacistName, req.DrugItems, req.ManualOverride, req.OverrideReason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	message := "发药完成"
	if dispensation.Intercepted {
		message = "发药已被拦截: " + dispensation.InterceptReason
	} else if dispensation.ManualOverride {
		message = "已人工放行发药"
	}

	c.JSON(http.StatusOK, gin.H{
		"message": message,
		"data":    dispensation,
	})
}

type SupplementRequest struct {
	FieldName    string `json:"field_name"`
	BeforeValue  string `json:"before_value"`
	AfterValue   string `json:"after_value"`
	OperatorID   string `json:"operator_id"`
	OperatorName string `json:"operator_name"`
	Remark       string `json:"remark"`
}

func (h *Handler) SupplementRecord(c *gin.Context) {
	prescriptionID := c.Param("id")
	var req SupplementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.processor.SupplementRecord(&processor.SupplementRequest{
		PrescriptionID: prescriptionID,
		FieldName:      req.FieldName,
		BeforeValue:    req.BeforeValue,
		AfterValue:     req.AfterValue,
		OperatorID:     req.OperatorID,
		OperatorName:   req.OperatorName,
		Remark:         req.Remark,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "补录成功",
	})
}

type CloseRequest struct {
	FinalConclusion string `json:"final_conclusion"`
	OperatorID      string `json:"operator_id"`
	OperatorName    string `json:"operator_name"`
}

func (h *Handler) ClosePrescription(c *gin.Context) {
	prescriptionID := c.Param("id")
	var req CloseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	report, err := h.closer.ClosePrescription(&closer.ClosePrescriptionRequest{
		PrescriptionID:  prescriptionID,
		FinalConclusion: req.FinalConclusion,
		OperatorID:      req.OperatorID,
		OperatorName:    req.OperatorName,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "处方已结案",
		"data":    report,
	})
}

func (h *Handler) GetTimeline(c *gin.Context) {
	prescriptionID := c.Param("id")
	timeline, err := h.processor.GetFullTimeline(prescriptionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "查询成功",
		"data":    timeline,
	})
}

func (h *Handler) GetSuggestion(c *gin.Context) {
	prescriptionID := c.Param("id")
	suggestion, err := h.closer.GenerateProcessingSuggestion(prescriptionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":  "建议生成成功",
		"suggestion": suggestion,
	})
}

func (h *Handler) ExportReportJSON(c *gin.Context) {
	prescriptionID := c.Param("id")
	report, err := h.closer.ExportReportJSON(prescriptionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=report_"+prescriptionID+".json")
	c.String(http.StatusOK, report)
}

func (h *Handler) ExportReportCSV(c *gin.Context) {
	closedOnlyStr := c.DefaultQuery("closed_only", "true")
	closedOnly, _ := strconv.ParseBool(closedOnlyStr)

	records, err := h.closer.ExportReportCSV(closedOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=prescription_reports.csv")

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.WriteAll(records)
}

func (h *Handler) ListPrescriptions(c *gin.Context) {
	status := c.DefaultQuery("status", "")
	prescriptions, err := h.processor.ListPrescriptions(status)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "查询成功",
		"data":    prescriptions,
	})
}

func (h *Handler) GetPrescription(c *gin.Context) {
	prescriptionID := c.Param("id")
	prescription, err := h.processor.GetPrescription(prescriptionID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "查询成功",
		"data":    prescription,
	})
}

func (h *Handler) ListReports(c *gin.Context) {
	closedOnlyStr := c.DefaultQuery("closed_only", "false")
	closedOnly, _ := strconv.ParseBool(closedOnlyStr)

	reports, err := h.closer.ListReports(closedOnly)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "查询成功",
		"data":    reports,
	})
}
