package handlers

import (
	"net/http"
	"watermeter-api/database"
	"watermeter-api/models"
	"watermeter-api/service"

	"github.com/gin-gonic/gin"
)

type AppealHandler struct {
	appealService *service.AppealService
	reviewService *service.ReviewService
	billingService *service.BillingService
}

func NewAppealHandler() *AppealHandler {
	db := database.GetDB()
	return &AppealHandler{
		appealService:  service.NewAppealService(db),
		reviewService:  service.NewReviewService(db),
		billingService: service.NewBillingService(db),
	}
}

func (h *AppealHandler) SubmitAppeal(c *gin.Context) {
	var appeal models.Appeal
	if err := c.ShouldBindJSON(&appeal); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.appealService.SubmitAppeal(&appeal)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *AppealHandler) BatchSubmit(c *gin.Context) {
	var request models.BatchSubmitRequest
	if err := c.ShouldBindJSON(&request); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	response, err := h.appealService.BatchSubmit(request)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, response)
}

func (h *AppealHandler) GetAppeal(c *gin.Context) {
	appealNo := c.Param("appealNo")
	detail, err := h.appealService.GetAppealDetail(appealNo)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "申诉不存在"})
		return
	}

	c.JSON(http.StatusOK, detail)
}

func (h *AppealHandler) SplitAnomalies(c *gin.Context) {
	appealNo := c.Param("appealNo")
	anomalies, err := h.appealService.SplitAnomalies(appealNo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"appeal_no": appealNo,
		"anomalies": anomalies,
		"count":     len(anomalies),
	})
}

func (h *AppealHandler) RecalculateBills(c *gin.Context) {
	appealNo := c.Param("appealNo")
	result, err := h.billingService.RecalculateAppealBills(appealNo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *AppealHandler) CreateReviewReport(c *gin.Context) {
	var req service.ReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	report, err := h.reviewService.CreateReviewReport(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, report)
}

func (h *AppealHandler) FinalizeReview(c *gin.Context) {
	reportNo := c.Param("reportNo")
	var body struct {
		IsApproved bool `json:"is_approved"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.reviewService.FinalizeReview(reportNo, body.IsApproved)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "复核完成"})
}

func (h *AppealHandler) ManualCorrect(c *gin.Context) {
	reportNo := c.Param("reportNo")
	var body struct {
		AdjustedAmount float64 `json:"adjusted_amount"`
		Reason         string  `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.reviewService.ManualCorrect(reportNo, body.AdjustedAmount, body.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "人工修正完成"})
}

func (h *AppealHandler) CloseAppeal(c *gin.Context) {
	appealNo := c.Param("appealNo")
	var body struct {
		HandlerID   string `json:"handler_id"`
		HandlerName string `json:"handler_name"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.reviewService.CloseAppeal(appealNo, body.HandlerID, body.HandlerName)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "申诉已结案"})
}

func (h *AppealHandler) ArchiveAppeal(c *gin.Context) {
	appealNo := c.Param("appealNo")
	err := h.reviewService.ArchiveAppeal(appealNo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "申诉已归档"})
}

func (h *AppealHandler) WithdrawAppeal(c *gin.Context) {
	appealNo := c.Param("appealNo")
	var body struct {
		HandlerID   string `json:"handler_id"`
		HandlerName string `json:"handler_name"`
		Reason      string `json:"reason"`
	}
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err := h.reviewService.WithdrawAppeal(appealNo, body.HandlerID, body.HandlerName, body.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "申诉已撤回"})
}

func (h *AppealHandler) ExportAppeals(c *gin.Context) {
	var req models.ExportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	records, err := h.reviewService.ExportAppeals(req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":  records,
		"count": len(records),
	})
}

func (h *AppealHandler) CheckDuplicate(c *gin.Context) {
	meterNo := c.Query("meter_no")
	startCycle := c.Query("start_cycle")
	endCycle := c.Query("end_cycle")

	isDuplicate, existing := h.appealService.CheckDuplicateAppeal(meterNo, startCycle, endCycle, "")

	c.JSON(http.StatusOK, gin.H{
		"is_duplicate": isDuplicate,
		"existing":     existing,
	})
}

func (h *AppealHandler) ListAppeals(c *gin.Context) {
	status := c.Query("status")
	meterNo := c.Query("meter_no")

	db := database.GetDB()
	query := db.Model(&models.Appeal{}).Order("created_at DESC")

	if status != "" {
		query = query.Where("status = ?", status)
	}
	if meterNo != "" {
		query = query.Where("meter_no = ?", meterNo)
	}

	var appeals []models.Appeal
	query.Find(&appeals)

	c.JSON(http.StatusOK, gin.H{
		"data":  appeals,
		"count": len(appeals),
	})
}
