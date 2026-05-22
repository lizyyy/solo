package handlers

import (
	"net/http"
	"strconv"
	"used-car-retry-queue/models"
	"used-car-retry-queue/services"

	"github.com/gin-gonic/gin"
)

type ReceiptHandler struct {
	receiptService *services.ReceiptService
	importService  *services.ImportService
	queueService   *services.QueueService
}

func NewReceiptHandler(receiptService *services.ReceiptService,
	importService *services.ImportService,
	queueService *services.QueueService) *ReceiptHandler {
	return &ReceiptHandler{
		receiptService: receiptService,
		importService:  importService,
		queueService:   queueService,
	}
}

type SubmitReceiptRequest struct {
	CarVin            string               `json:"car_vin" binding:"required"`
	CarPlate          string               `json:"car_plate"`
	Source            models.ReceiptSource `json:"source" binding:"required"`
	SourceFile        string               `json:"source_file"`
	SourceLine        int                  `json:"source_line"`
	RawData           string               `json:"raw_data" binding:"required"`
	StandardData      string               `json:"standard_data"`
	Amount            float64              `json:"amount"`
	ResponsiblePerson string               `json:"responsible_person"`
	Operator          string               `json:"operator" binding:"required"`
}

type ManualProcessRequest struct {
	Operator       string `json:"operator" binding:"required"`
	Result         string `json:"result" binding:"required,oneof=success retry failed"`
	Reason         string `json:"reason" binding:"required"`
	AdditionalInfo string `json:"additional_info"`
}

type CompensateRequest struct {
	Operator  string  `json:"operator" binding:"required"`
	Amount    float64 `json:"amount" binding:"required,min=0"`
	Reason    string  `json:"reason" binding:"required"`
	AccountNo string  `json:"account_no"`
	VoucherNo string  `json:"voucher_no"`
}

type CloseReceiptRequest struct {
	Operator string `json:"operator" binding:"required"`
	Reason   string `json:"reason" binding:"required"`
}

type ImportCSVRequest struct {
	FilePath string               `json:"file_path" binding:"required"`
	Source   models.ReceiptSource `json:"source" binding:"required"`
	Operator string               `json:"operator" binding:"required"`
}

type UpdateStandardDataRequest struct {
	Operator       string `json:"operator" binding:"required"`
	StandardData   string `json:"standard_data" binding:"required"`
	Reason         string `json:"reason" binding:"required"`
}

func (h *ReceiptHandler) SubmitReceipt(c *gin.Context) {
	var req SubmitReceiptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	serviceReq := &services.SubmitReceiptRequest{
		CarVin:            req.CarVin,
		CarPlate:          req.CarPlate,
		Source:            req.Source,
		SourceFile:        req.SourceFile,
		SourceLine:        req.SourceLine,
		RawData:           req.RawData,
		StandardData:      req.StandardData,
		Amount:            req.Amount,
		ResponsiblePerson: req.ResponsiblePerson,
		Operator:          req.Operator,
	}

	receipt, err := h.receiptService.SubmitReceipt(serviceReq)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	h.receiptService.QueueReceipt(receipt.ID, req.Operator)

	c.JSON(http.StatusCreated, gin.H{
		"receipt_no": receipt.ReceiptNo,
		"id":         receipt.ID,
		"status":     receipt.CurrentStatus,
	})
}

func (h *ReceiptHandler) GetReceipt(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receipt ID"})
		return
	}

	receipt, err := h.receiptService.GetReceipt(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Receipt not found"})
		return
	}

	c.JSON(http.StatusOK, receipt)
}

func (h *ReceiptHandler) GetReceiptByNo(c *gin.Context) {
	receiptNo := c.Param("receiptNo")

	receipt, err := h.receiptService.GetReceiptByNo(receiptNo)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Receipt not found"})
		return
	}

	c.JSON(http.StatusOK, receipt)
}

func (h *ReceiptHandler) ListReceipts(c *gin.Context) {
	status := models.ReceiptStatus(c.Query("status"))
	carVin := c.Query("car_vin")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	receipts, total, err := h.receiptService.ListReceipts(status, carVin, page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       receipts,
		"total":      total,
		"page":       page,
		"page_size":  pageSize,
		"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

func (h *ReceiptHandler) ManualProcess(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receipt ID"})
		return
	}

	var req ManualProcessRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.receiptService.ManualProcess(uint(id), req.Operator, req.Result, req.AdditionalInfo)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Manual processing completed"})
}

func (h *ReceiptHandler) Compensate(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receipt ID"})
		return
	}

	var req CompensateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.receiptService.Compensate(uint(id), req.Operator, req.Amount, req.Reason, req.AccountNo, req.VoucherNo)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Compensation recorded"})
}

func (h *ReceiptHandler) CloseReceipt(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receipt ID"})
		return
	}

	var req CloseReceiptRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.receiptService.CloseReceipt(uint(id), req.Operator, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Receipt closed"})
}

func (h *ReceiptHandler) ImportCSV(c *gin.Context) {
	var req ImportCSVRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	result, err := h.importService.ImportFromCSV(req.FilePath, req.Source, req.Operator)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, result)
}

func (h *ReceiptHandler) GetImportHistory(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	records, total, err := h.importService.GetImportHistory(page, pageSize)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"data":       records,
		"total":      total,
		"page":       page,
		"page_size":  pageSize,
		"total_page": (total + int64(pageSize) - 1) / int64(pageSize),
	})
}

func (h *ReceiptHandler) GetEvidence(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receipt ID"})
		return
	}

	evidence, err := h.importService.GetReceiptEvidence(uint(id))
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Receipt not found"})
		return
	}

	c.JSON(http.StatusOK, evidence)
}

func (h *ReceiptHandler) UpdateStandardData(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseUint(idStr, 10, 32)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid receipt ID"})
		return
	}

	var req UpdateStandardDataRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	err = h.importService.UpdateStandardData(uint(id), req.Operator, req.StandardData, req.Reason)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Standard data updated, original evidence preserved"})
}

func (h *ReceiptHandler) GetRetryStats(c *gin.Context) {
	stats, err := h.receiptService.GetRetryCategoryStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"retry_categories": stats,
		"note": "按可重试分类统计，包含: retry_wait(待重试)、manual_wait(待人工)、dead_letter(死信)",
	})
}

func (h *ReceiptHandler) GetDeadLetterStats(c *gin.Context) {
	stats, err := h.receiptService.GetDeadLetterStats()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"dead_letter_reasons": stats,
		"note": "按失败原因分类的死信统计，便于针对性处理",
	})
}

func (h *ReceiptHandler) TriggerProcessing(c *gin.Context) {
	operator := c.Query("operator")
	if operator == "" {
		operator = "api_trigger"
	}

	go h.queueService.TriggerManualProcess()

	c.JSON(http.StatusAccepted, gin.H{
		"message": "Processing triggered asynchronously",
		"operator": operator,
	})
}

func (h *ReceiptHandler) RecoverTasks(c *gin.Context) {
	err := h.queueService.RecoverUnfinishedTasks()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Unfinished tasks recovered successfully"})
}

func (h *ReceiptHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
		"service": "used-car-retry-queue",
	})
}
