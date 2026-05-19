package handler

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"

	"quality-control-system/internal/config"
	"quality-control-system/internal/model"
	"quality-control-system/internal/service"
)

type Handler struct {
	sampleService  *service.SampleService
	tempService    *service.TemperatureService
	wasteService   *service.WasteService
	reportService  *service.ReportService
}

func NewHandler(cfg *config.Config) *Handler {
	return &Handler{
		sampleService: service.NewSampleService(&cfg.Rules),
		tempService:   service.NewTemperatureService(&cfg.Rules),
		wasteService:  service.NewWasteService(),
		reportService: service.NewReportService(&cfg.Export),
	}
}

func (h *Handler) successResponse(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func (h *Handler) errorResponse(c *gin.Context, code int, message string) {
	c.JSON(code, model.ApiResponse{
		Code:    code,
		Message: message,
	})
}

type CreateSampleRequest struct {
	StoreID         string  `json:"store_id" binding:"required"`
	DishName        string  `json:"dish_name" binding:"required"`
	DishBatch       string  `json:"dish_batch" binding:"required"`
	SampleWeight    float64 `json:"sample_weight"`
	SampleTime      string  `json:"sample_time" binding:"required"`
	Keeper          string  `json:"keeper"`
	KeeperPhone     string  `json:"keeper_phone"`
	StorageLocation string  `json:"storage_location"`
	IdempotentKey   string  `json:"idempotent_key"`
}

func (h *Handler) CreateSample(c *gin.Context) {
	var req CreateSampleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	sampleTime, err := time.Parse(time.RFC3339, req.SampleTime)
	if err != nil {
		sampleTime, err = time.Parse("2006-01-02 15:04:05", req.SampleTime)
		if err != nil {
			h.errorResponse(c, http.StatusBadRequest, "invalid sample_time format")
			return
		}
	}

	sample := &model.FoodSample{
		StoreID:         req.StoreID,
		DishName:        req.DishName,
		DishBatch:       req.DishBatch,
		SampleWeight:    req.SampleWeight,
		SampleTime:      sampleTime,
		Keeper:          req.Keeper,
		KeeperPhone:     req.KeeperPhone,
		StorageLocation: req.StorageLocation,
	}

	result, err := h.sampleService.CreateSample(sample, req.IdempotentKey)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, result)
}

func (h *Handler) GetSample(c *gin.Context) {
	sampleNo := c.Param("sample_no")
	sample, err := h.sampleService.GetSample(sampleNo)
	if err != nil {
		h.errorResponse(c, http.StatusNotFound, "sample not found")
		return
	}
	h.successResponse(c, sample)
}

func (h *Handler) ListSamples(c *gin.Context) {
	storeID := c.Query("store_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	samples, total, err := h.sampleService.ListSamples(storeID, page, pageSize)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, gin.H{
		"list":  samples,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

type DestroySampleRequest struct {
	SampleNo string `json:"sample_no" binding:"required"`
	Operator string `json:"operator"`
	Reason   string `json:"reason"`
}

func (h *Handler) DestroySample(c *gin.Context) {
	var req DestroySampleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	err := h.sampleService.DestroySample(req.SampleNo, req.Operator, req.Reason)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, gin.H{"message": "sample destroyed successfully"})
}

type CreateTemperatureRequest struct {
	StoreID     string  `json:"store_id" binding:"required"`
	FridgeID    string  `json:"fridge_id" binding:"required"`
	FridgeName  string  `json:"fridge_name"`
	Temperature float64 `json:"temperature" binding:"required"`
	CheckTime   string  `json:"check_time" binding:"required"`
	Checker     string  `json:"checker"`
	CheckerPhone string `json:"checker_phone"`
	IdempotentKey string `json:"idempotent_key"`
}

func (h *Handler) CreateTemperature(c *gin.Context) {
	var req CreateTemperatureRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	checkTime, err := time.Parse(time.RFC3339, req.CheckTime)
	if err != nil {
		checkTime, err = time.Parse("2006-01-02 15:04:05", req.CheckTime)
		if err != nil {
			h.errorResponse(c, http.StatusBadRequest, "invalid check_time format")
			return
		}
	}

	record := &model.TemperatureRecord{
		StoreID:      req.StoreID,
		FridgeID:     req.FridgeID,
		FridgeName:   req.FridgeName,
		Temperature:  req.Temperature,
		CheckTime:    checkTime,
		Checker:      req.Checker,
		CheckerPhone: req.CheckerPhone,
	}

	result, err := h.tempService.CreateRecord(record, req.IdempotentKey)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, result)
}

func (h *Handler) GetTemperature(c *gin.Context) {
	recordNo := c.Param("record_no")
	record, err := h.tempService.GetRecord(recordNo)
	if err != nil {
		h.errorResponse(c, http.StatusNotFound, "record not found")
		return
	}
	h.successResponse(c, record)
}

func (h *Handler) ListTemperatures(c *gin.Context) {
	storeID := c.Query("store_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	records, total, err := h.tempService.ListRecords(storeID, page, pageSize)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, gin.H{
		"list":  records,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

type CreateWasteRequest struct {
	StoreID       string  `json:"store_id" binding:"required"`
	DishName      string  `json:"dish_name" binding:"required"`
	DishBatch     string  `json:"dish_batch" binding:"required"`
	WasteType     string  `json:"waste_type"`
	WasteWeight   float64 `json:"waste_weight"`
	WasteTime     string  `json:"waste_time" binding:"required"`
	WasteReason   string  `json:"waste_reason"`
	Operator      string  `json:"operator"`
	OperatorPhone string  `json:"operator_phone"`
	Witness       string  `json:"witness"`
	IdempotentKey string  `json:"idempotent_key"`
}

func (h *Handler) CreateWaste(c *gin.Context) {
	var req CreateWasteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	wasteTime, err := time.Parse(time.RFC3339, req.WasteTime)
	if err != nil {
		wasteTime, err = time.Parse("2006-01-02 15:04:05", req.WasteTime)
		if err != nil {
			h.errorResponse(c, http.StatusBadRequest, "invalid waste_time format")
			return
		}
	}

	record := &model.WasteRecord{
		StoreID:       req.StoreID,
		DishName:      req.DishName,
		DishBatch:     req.DishBatch,
		WasteType:     req.WasteType,
		WasteWeight:   req.WasteWeight,
		WasteTime:     wasteTime,
		WasteReason:   req.WasteReason,
		Operator:      req.Operator,
		OperatorPhone: req.OperatorPhone,
		Witness:       req.Witness,
	}

	result, err := h.wasteService.CreateRecord(record, req.IdempotentKey)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, result)
}

func (h *Handler) GetWaste(c *gin.Context) {
	wasteNo := c.Param("waste_no")
	record, err := h.wasteService.GetRecord(wasteNo)
	if err != nil {
		h.errorResponse(c, http.StatusNotFound, "record not found")
		return
	}
	h.successResponse(c, record)
}

func (h *Handler) ListWastes(c *gin.Context) {
	storeID := c.Query("store_id")
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	records, total, err := h.wasteService.ListRecords(storeID, page, pageSize)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, gin.H{
		"list":  records,
		"total": total,
		"page":  page,
		"size":  pageSize,
	})
}

func (h *Handler) GetBatchSummary(c *gin.Context) {
	dishBatch := c.Param("dish_batch")
	summary, err := h.reportService.GetBatchSummary(dishBatch)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.successResponse(c, summary)
}

func (h *Handler) GetDailyReport(c *gin.Context) {
	storeID := c.Query("store_id")
	dateStr := c.Query("date")

	var date time.Time
	if dateStr != "" {
		var err error
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			h.errorResponse(c, http.StatusBadRequest, "invalid date format, use YYYY-MM-DD")
			return
		}
	} else {
		date = time.Now()
	}

	report, err := h.reportService.GetDailyReport(storeID, date)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.successResponse(c, report)
}

func (h *Handler) ExportDailyReport(c *gin.Context) {
	storeID := c.Query("store_id")
	dateStr := c.Query("date")

	var date time.Time
	if dateStr != "" {
		var err error
		date, err = time.Parse("2006-01-02", dateStr)
		if err != nil {
			h.errorResponse(c, http.StatusBadRequest, "invalid date format, use YYYY-MM-DD")
			return
		}
	} else {
		date = time.Now()
	}

	filepath, err := h.reportService.ExportDailyReportCSV(storeID, date)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, gin.H{
		"filepath": filepath,
		"message":  "export successfully",
	})
}

func (h *Handler) GetReminders(c *gin.Context) {
	storeID := c.Query("store_id")
	reminders, err := h.reportService.GetPendingReminders(storeID)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.successResponse(c, reminders)
}

type AcknowledgeReminderRequest struct {
	ReminderNo string `json:"reminder_no" binding:"required"`
	Operator   string `json:"operator"`
}

func (h *Handler) AcknowledgeReminder(c *gin.Context) {
	var req AcknowledgeReminderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.errorResponse(c, http.StatusBadRequest, err.Error())
		return
	}

	err := h.reportService.AcknowledgeReminder(req.ReminderNo, req.Operator)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, gin.H{"message": "reminder acknowledged"})
}

func (h *Handler) CheckExpiredSamples(c *gin.Context) {
	count, err := h.sampleService.CheckAndIsolateExpiredSamples()
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.successResponse(c, gin.H{"isolated_count": count})
}

func (h *Handler) CheckTemperatureGap(c *gin.Context) {
	storeID := c.Query("store_id")
	fridgeID := c.Query("fridge_id")
	startStr := c.Query("start_time")
	endStr := c.Query("end_time")

	startTime, err := time.Parse("2006-01-02 15:04:05", startStr)
	if err != nil {
		startTime = time.Now().AddDate(0, 0, -1)
	}

	endTime, err := time.Parse("2006-01-02 15:04:05", endStr)
	if err != nil {
		endTime = time.Now()
	}

	results, err := h.tempService.CheckTemperatureGap(storeID, fridgeID, startTime, endTime)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}

	h.successResponse(c, results)
}

func (h *Handler) GetRuleExecutionLogs(c *gin.Context) {
	recordType := c.Query("record_type")
	recordRefNo := c.Query("record_ref_no")

	logs, err := h.sampleService.GetRuleExecutionLogs(recordType, recordRefNo)
	if err != nil {
		h.errorResponse(c, http.StatusInternalServerError, err.Error())
		return
	}
	h.successResponse(c, logs)
}
