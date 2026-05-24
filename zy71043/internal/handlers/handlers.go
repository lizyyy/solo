package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"fireworks-humidity-api/internal/models"
	"fireworks-humidity-api/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	svc *service.Service
}

func NewHandler(svc *service.Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) handleError(c *gin.Context, err error) {
	var code string
	var message string
	var status int

	switch {
	case errors.Is(err, models.ErrMissingMaterial):
		code = "MISSING_MATERIAL"
		message = "缺少必要材料"
		status = http.StatusBadRequest
	case errors.Is(err, models.ErrInvalidState):
		code = "INVALID_STATE"
		message = "当前状态不允许此操作"
		status = http.StatusConflict
	case errors.Is(err, models.ErrDuplicateRequest):
		code = "DUPLICATE_REQUEST"
		message = "重复请求"
		status = http.StatusConflict
	case errors.Is(err, models.ErrReviewRequired):
		code = "REVIEW_REQUIRED"
		message = "已复核记录不可撤销"
		status = http.StatusForbidden
	case errors.Is(err, models.ErrNotFound):
		code = "NOT_FOUND"
		message = "资源不存在"
		status = http.StatusNotFound
	case errors.Is(err, models.ErrValidationFailed):
		code = "VALIDATION_FAILED"
		message = "参数校验失败"
		status = http.StatusBadRequest
	case errors.Is(err, models.ErrBatchAlreadyExists):
		code = "BATCH_ALREADY_EXISTS"
		message = "批次已存在"
		status = http.StatusConflict
	case errors.Is(err, models.ErrAreaNotFound):
		code = "AREA_NOT_FOUND"
		message = "库区不存在"
		status = http.StatusNotFound
	case errors.Is(err, models.ErrBatchNotFound):
		code = "BATCH_NOT_FOUND"
		message = "批次不存在"
		status = http.StatusNotFound
	case errors.Is(err, models.ErrSampleNotFound):
		code = "SAMPLE_NOT_FOUND"
		message = "湿度采样记录不存在"
		status = http.StatusNotFound
	case errors.Is(err, models.ErrTransferNotFound):
		code = "TRANSFER_NOT_FOUND"
		message = "转仓记录不存在"
		status = http.StatusNotFound
	case errors.Is(err, models.ErrInsufficientQty):
		code = "INSUFFICIENT_QUANTITY"
		message = "数量不足"
		status = http.StatusBadRequest
	case errors.Is(err, models.ErrAreaCapacityFull):
		code = "AREA_CAPACITY_FULL"
		message = "库区容量已满"
		status = http.StatusConflict
	default:
		code = "INTERNAL_ERROR"
		message = "服务器内部错误: " + err.Error()
		status = http.StatusInternalServerError
	}

	c.JSON(status, models.ErrorResponse{
		Code:    code,
		Message: message,
	})
}

func (h *Handler) checkIdempotent(c *gin.Context, requestID string) (bool, interface{}) {
	if requestID == "" {
		return false, nil
	}

	req, err := h.svc.CheckIdempotent(requestID)
	if err != nil || req == nil {
		return false, nil
	}

	var cachedResponse interface{}
	if err := json.Unmarshal([]byte(req.ResponseBody), &cachedResponse); err != nil {
		return false, nil
	}

	return true, cachedResponse
}

func (h *Handler) CreateSample(c *gin.Context) {
	var req service.CreateSampleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, models.ErrValidationFailed)
		return
	}

	if cached, resp := h.checkIdempotent(c, req.RequestID); cached {
		c.JSON(http.StatusOK, resp)
		return
	}

	sample, err := h.svc.CreateSample(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, sample)
}

func (h *Handler) StartVentilation(c *gin.Context) {
	var req service.VentilationStartRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, models.ErrValidationFailed)
		return
	}

	if cached, resp := h.checkIdempotent(c, req.RequestID); cached {
		c.JSON(http.StatusOK, resp)
		return
	}

	vent, err := h.svc.StartVentilation(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, vent)
}

func (h *Handler) CompleteVentilation(c *gin.Context) {
	var req service.VentilationCompleteRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, models.ErrValidationFailed)
		return
	}

	vent, err := h.svc.CompleteVentilation(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, vent)
}

func (h *Handler) CreateTransfer(c *gin.Context) {
	var req service.TransferRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, models.ErrValidationFailed)
		return
	}

	if cached, resp := h.checkIdempotent(c, req.RequestID); cached {
		c.JSON(http.StatusOK, resp)
		return
	}

	transfer, err := h.svc.CreateTransfer(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, transfer)
}

func (h *Handler) UndoTransfer(c *gin.Context) {
	var req service.TransferUndoRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, models.ErrValidationFailed)
		return
	}

	transfer, err := h.svc.UndoTransfer(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, transfer)
}

func (h *Handler) CreateInspection(c *gin.Context) {
	var req service.InspectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, models.ErrValidationFailed)
		return
	}

	if cached, resp := h.checkIdempotent(c, req.RequestID); cached {
		c.JSON(http.StatusOK, resp)
		return
	}

	inspection, err := h.svc.CreateInspection(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, inspection)
}

func (h *Handler) Review(c *gin.Context) {
	var req service.ReviewRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, models.ErrValidationFailed)
		return
	}

	if err := h.svc.Review(&req); err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "复核成功"})
}

func (h *Handler) GenerateReport(c *gin.Context) {
	var req service.ReportRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.handleError(c, models.ErrValidationFailed)
		return
	}

	report, err := h.svc.GenerateReport(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.JSON(http.StatusCreated, report)
}

func (h *Handler) ExportReport(c *gin.Context) {
	reportNo := c.Param("report_no")
	report, err := h.svc.GetReport(reportNo)
	if err != nil {
		h.handleError(c, err)
		return
	}

	format := c.DefaultQuery("format", "json")

	switch format {
	case "yaml":
		c.Header("Content-Type", "text/yaml; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename="+reportNo+".yaml")
		c.String(http.StatusOK, toYAML(report))
	case "csv":
		c.Header("Content-Type", "text/csv; charset=utf-8")
		c.Header("Content-Disposition", "attachment; filename="+reportNo+".csv")
		c.String(http.StatusOK, toCSV(report))
	default:
		c.JSON(http.StatusOK, report)
	}
}

func toYAML(report *models.RiskReport) string {
	return `report_no: ` + report.ReportNo + `
report_type: ` + report.ReportType + `
period_start: ` + report.PeriodStart.Format("2006-01-02 15:04:05") + `
period_end: ` + report.PeriodEnd.Format("2006-01-02 15:04:05") + `
generated_at: ` + report.GeneratedAt.Format("2006-01-02 15:04:05") + `
generated_by: ` + report.GeneratedBy + `
summary: ` + report.Summary + `
risk_level: ` + report.RiskLevel + `
statistics:
  total_samples: ` + strconv.Itoa(report.TotalSamples) + `
  over_limit_count: ` + strconv.Itoa(report.OverLimitCount) + `
  transfer_count: ` + strconv.Itoa(report.TransferCount) + `
  inspection_count: ` + strconv.Itoa(report.InspectionCount) + `
  ventilation_count: ` + strconv.Itoa(report.VentilationCount)
}

func toCSV(report *models.RiskReport) string {
	header := "报告编号,报告类型,开始时间,结束时间,生成时间,生成人,风险等级,样本总数,超限次数,转仓次数,抽检次数,通风次数\n"
	data := report.ReportNo + "," + report.ReportType + "," +
		report.PeriodStart.Format("2006-01-02 15:04:05") + "," +
		report.PeriodEnd.Format("2006-01-02 15:04:05") + "," +
		report.GeneratedAt.Format("2006-01-02 15:04:05") + "," +
		report.GeneratedBy + "," + report.RiskLevel + "," +
		strconv.Itoa(report.TotalSamples) + "," +
		strconv.Itoa(report.OverLimitCount) + "," +
		strconv.Itoa(report.TransferCount) + "," +
		strconv.Itoa(report.InspectionCount) + "," +
		strconv.Itoa(report.VentilationCount) + "\n"
	return header + data
}

func (h *Handler) GetBatchTrace(c *gin.Context) {
	batchNo := c.Param("batch_no")
	trace, err := h.svc.GetBatchTrace(batchNo)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, trace)
}

func (h *Handler) GetPendingReviews(c *gin.Context) {
	reviews, err := h.svc.GetPendingReviews()
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, reviews)
}

func (h *Handler) GetAreas(c *gin.Context) {
	areas, err := h.svc.GetAreas()
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, areas)
}

func (h *Handler) GetAreaBatches(c *gin.Context) {
	areaCode := c.Param("area_code")
	batches, err := h.svc.GetAreaBatches(areaCode)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, batches)
}

func (h *Handler) GetSample(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	sample, err := h.svc.GetSample(id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, sample)
}

func (h *Handler) GetBatch(c *gin.Context) {
	batchNo := c.Param("batch_no")
	batch, err := h.svc.GetBatch(batchNo)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, batch)
}

func (h *Handler) GetTransfer(c *gin.Context) {
	id, _ := strconv.ParseInt(c.Param("id"), 10, 64)
	transfer, err := h.svc.GetTransfer(id)
	if err != nil {
		h.handleError(c, err)
		return
	}
	c.JSON(http.StatusOK, transfer)
}

func (h *Handler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{"status": "ok", "service": "fireworks-humidity-api"})
}
