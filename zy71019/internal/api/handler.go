package api

import (
	"net/http"
	"strconv"

	"damage-arbitration/internal/export"
	"damage-arbitration/internal/models"
	"damage-arbitration/internal/service"

	"github.com/gin-gonic/gin"
)

type Handler struct {
	arbitrationService *service.ArbitrationService
	exportService      *export.ExportService
}

func NewHandler() *Handler {
	return &Handler{
		arbitrationService: service.NewArbitrationService(),
		exportService:      export.NewExportService(),
	}
}

func (h *Handler) CreateArbitration(c *gin.Context) {
	var req models.CreateArbitrationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	arbitration, err := h.arbitrationService.CreateArbitration(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": arbitration,
	})
}

func (h *Handler) BlockArbitration(c *gin.Context) {
	var req models.BlockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	if err := h.arbitrationService.BlockArbitration(&req); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "拦截成功",
	})
}

func (h *Handler) ReleaseArbitration(c *gin.Context) {
	var req models.ReleaseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	if err := h.arbitrationService.ReleaseArbitration(&req); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "放行成功",
	})
}

func (h *Handler) SupplementArbitration(c *gin.Context) {
	var req models.SupplementRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	if err := h.arbitrationService.SupplementArbitration(&req); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "补录成功",
	})
}

func (h *Handler) CloseArbitration(c *gin.Context) {
	var req models.CloseRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	if err := h.arbitrationService.CloseArbitration(&req); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "结案成功",
	})
}

func (h *Handler) SubmitAppeal(c *gin.Context) {
	var req models.SubmitAppealRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	if err := h.arbitrationService.SubmitAppeal(&req); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "申诉提交成功",
	})
}

func (h *Handler) HandleAppeal(c *gin.Context) {
	var req models.HandleAppealRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	if err := h.arbitrationService.HandleAppeal(&req); err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "申诉处理成功",
	})
}

func (h *Handler) GetArbitrationDetail(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "无效的ID"})
		return
	}

	detail, err := h.arbitrationService.GetArbitrationDetail(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": detail,
	})
}

func (h *Handler) ListArbitrations(c *gin.Context) {
	var query models.QueryRequest
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	result, err := h.arbitrationService.ListArbitrations(&query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code": 0,
		"msg":  "success",
		"data": result,
	})
}

func (h *Handler) ExportJSON(c *gin.Context) {
	var query models.QueryRequest
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	data, err := h.exportService.ExportToJSON(&query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=arbitrations.json")
	c.Data(http.StatusOK, "application/json", data)
}

func (h *Handler) ExportCSV(c *gin.Context) {
	var query models.QueryRequest
	if err := c.ShouldBindQuery(&query); err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "参数错误: " + err.Error()})
		return
	}

	data, err := h.exportService.ExportToCSV(&query)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=arbitrations.csv")
	c.Data(http.StatusOK, "text/csv", data)
}

func (h *Handler) ExportDamageCSV(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "无效的ID"})
		return
	}

	data, err := h.exportService.ExportDamageDetailCSV(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=damages.csv")
	c.Data(http.StatusOK, "text/csv", data)
}

func (h *Handler) ExportLogsCSV(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, models.ErrorResponse{Code: 400, Message: "无效的ID"})
		return
	}

	data, err := h.exportService.ExportLogsCSV(id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, models.ErrorResponse{Code: 500, Message: err.Error()})
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", "attachment; filename=logs.csv")
	c.Data(http.StatusOK, "text/csv", data)
}
