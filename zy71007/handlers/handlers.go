package handlers

import (
	"dialysis-recall-api/database"
	"dialysis-recall-api/models"
	"dialysis-recall-api/services"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
)

type Handler struct{}

func NewHandler() *Handler {
	return &Handler{}
}

func (h *Handler) CreateMaterial(c *gin.Context) {
	var material models.Material
	if err := c.ShouldBindJSON(&material); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	material.CreatedAt = time.Now()
	material.UpdatedAt = time.Now()
	if err := database.GetDB().Create(&material).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, material)
}

func (h *Handler) ListMaterials(c *gin.Context) {
	var materials []models.Material
	database.GetDB().Find(&materials)
	c.JSON(http.StatusOK, materials)
}

func (h *Handler) GetMaterial(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var material models.Material
	if err := database.GetDB().First(&material, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Material not found"})
		return
	}
	c.JSON(http.StatusOK, material)
}

func (h *Handler) UpdateMaterial(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var material models.Material
	if err := database.GetDB().First(&material, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Material not found"})
		return
	}
	if err := c.ShouldBindJSON(&material); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	material.UpdatedAt = time.Now()
	database.GetDB().Save(&material)
	c.JSON(http.StatusOK, material)
}

func (h *Handler) DeleteMaterial(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	if err := database.GetDB().Delete(&models.Material{}, id).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Material deleted"})
}

func (h *Handler) CreatePatient(c *gin.Context) {
	var patient models.Patient
	if err := c.ShouldBindJSON(&patient); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	patient.CreatedAt = time.Now()
	patient.UpdatedAt = time.Now()
	if err := database.GetDB().Create(&patient).Error; err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, patient)
}

func (h *Handler) ListPatients(c *gin.Context) {
	var patients []models.Patient
	database.GetDB().Find(&patients)
	c.JSON(http.StatusOK, patients)
}

func (h *Handler) GetPatient(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var patient models.Patient
	if err := database.GetDB().First(&patient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}
	c.JSON(http.StatusOK, patient)
}

func (h *Handler) UpdatePatient(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var patient models.Patient
	if err := database.GetDB().First(&patient, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Patient not found"})
		return
	}
	if err := c.ShouldBindJSON(&patient); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	patient.UpdatedAt = time.Now()
	database.GetDB().Save(&patient)
	c.JSON(http.StatusOK, patient)
}

func (h *Handler) DeletePatient(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	database.GetDB().Delete(&models.Patient{}, id)
	c.JSON(http.StatusOK, gin.H{"message": "Patient deleted"})
}

func (h *Handler) CreateDialysisShift(c *gin.Context) {
	var shift models.DialysisShift
	if err := c.ShouldBindJSON(&shift); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	shift.CreatedAt = time.Now()
	shift.UpdatedAt = time.Now()
	database.GetDB().Create(&shift)
	c.JSON(http.StatusCreated, shift)
}

func (h *Handler) ListDialysisShifts(c *gin.Context) {
	var shifts []models.DialysisShift
	database.GetDB().Find(&shifts)
	c.JSON(http.StatusOK, shifts)
}

func (h *Handler) CreateConsumptionRecord(c *gin.Context) {
	var record models.ConsumptionRecord
	if err := c.ShouldBindJSON(&record); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	record.CreatedAt = time.Now()
	record.UpdatedAt = time.Now()
	database.GetDB().Create(&record)
	c.JSON(http.StatusCreated, record)
}

func (h *Handler) ListConsumptionRecords(c *gin.Context) {
	var records []models.ConsumptionRecord
	database.GetDB().Preload("Patient").Preload("Material").Preload("DialysisShift").Find(&records)
	c.JSON(http.StatusOK, records)
}

func (h *Handler) CreateRecallNotice(c *gin.Context) {
	var notice models.RecallNotice
	if err := c.ShouldBindJSON(&notice); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	notice.Status = models.StatusPending
	notice.CreatedAt = time.Now()
	notice.UpdatedAt = time.Now()
	database.GetDB().Create(&notice)
	c.JSON(http.StatusCreated, notice)
}

func (h *Handler) ListRecallNotices(c *gin.Context) {
	var notices []models.RecallNotice
	database.GetDB().Order("created_at DESC").Find(&notices)
	c.JSON(http.StatusOK, notices)
}

func (h *Handler) GetRecallNotice(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var notice models.RecallNotice
	if err := database.GetDB().First(&notice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notice not found"})
		return
	}
	c.JSON(http.StatusOK, notice)
}

func (h *Handler) UpdateRecallNotice(c *gin.Context) {
	id, _ := strconv.Atoi(c.Param("id"))
	var notice models.RecallNotice
	if err := database.GetDB().First(&notice, id).Error; err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Notice not found"})
		return
	}
	if err := c.ShouldBindJSON(&notice); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	notice.UpdatedAt = time.Now()
	database.GetDB().Save(&notice)
	c.JSON(http.StatusOK, notice)
}

func (h *Handler) ExecuteTrace(c *gin.Context) {
	noticeID, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Operator string `json:"operator"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	affectedCount, newRecordCount, err := services.ExecuteTrace(uint(noticeID), req.Operator)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"affected_count":  affectedCount,
		"new_record_count": newRecordCount,
		"message":          "Trace executed successfully",
	})
}

func (h *Handler) GetTraceResults(c *gin.Context) {
	noticeID, _ := strconv.Atoi(c.Param("id"))
	status := c.Query("status")

	var statusPtr *string
	if status != "" {
		statusPtr = &status
	}

	results, err := services.GetTraceResultsByNotice(uint(noticeID), statusPtr)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, results)
}

func (h *Handler) ReviewTraceResult(c *gin.Context) {
	traceID, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		NewStatus string `json:"new_status" binding:"required"`
		Reviewer  string `json:"reviewer" binding:"required"`
		Reason    string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := services.ReviewTraceResult(uint(traceID), models.RecallStatus(req.NewStatus), req.Reviewer, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Review completed"})
}

func (h *Handler) UpdateNoticeStatus(c *gin.Context) {
	noticeID, _ := strconv.Atoi(c.Param("id"))
	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := services.UpdateNoticeStatus(uint(noticeID), models.RecallStatus(req.Status))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Status updated"})
}

func (h *Handler) GetTraceHistory(c *gin.Context) {
	noticeID, _ := strconv.Atoi(c.Param("id"))
	history, err := services.GetTraceHistory(uint(noticeID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, history)
}

func (h *Handler) GetReviewRecords(c *gin.Context) {
	traceID, _ := strconv.Atoi(c.Param("id"))
	records, err := services.GetReviewRecords(uint(traceID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, records)
}

func (h *Handler) ExportReport(c *gin.Context) {
	noticeID, _ := strconv.Atoi(c.Param("id"))

	file, err := services.GenerateRecallReport(uint(noticeID))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	filename := fmt.Sprintf("recall_report_%d_%s.xlsx", noticeID, time.Now().Format("20060102_150405"))

	c.Header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=%s", filename))

	file.Write(c.Writer)
}
