package handler

import (
	"encoding/json"
	"net/http"

	"github.com/gin-gonic/gin"
	"device-evidence-api/model"
	"device-evidence-api/service"
)

type EvidenceHandler struct {
	service *service.EvidenceService
}

func NewEvidenceHandler() *EvidenceHandler {
	return &EvidenceHandler{
		service: service.NewEvidenceService(),
	}
}

func successResponse(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, model.ApiResponse{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func errorResponse(c *gin.Context, code int, message string) {
	c.JSON(code, model.ApiResponse{
		Code:    code,
		Message: message,
	})
}

func (h *EvidenceHandler) CreateEvidence(c *gin.Context) {
	var req model.CreateEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	rawInput, _ := json.Marshal(req)

	idempotentKey := c.GetHeader("Idempotent-Key")

	evidence, err := h.service.CreateEvidence(&req, idempotentKey, string(rawInput))
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "创建失败: "+err.Error())
		return
	}

	successResponse(c, evidence)
}

func (h *EvidenceHandler) GetEvidence(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		errorResponse(c, http.StatusBadRequest, "证据ID不能为空")
		return
	}

	evidence, err := h.service.GetEvidence(id)
	if err != nil {
		errorResponse(c, http.StatusNotFound, "证据不存在: "+err.Error())
		return
	}

	successResponse(c, evidence)
}

func (h *EvidenceHandler) QueryEvidences(c *gin.Context) {
	var req model.QueryEvidenceRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	evidences, total, err := h.service.QueryEvidences(&req)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "查询失败: "+err.Error())
		return
	}

	successResponse(c, gin.H{
		"list":  evidences,
		"total": total,
		"page":  req.Page,
		"page_size": req.PageSize,
	})
}

func (h *EvidenceHandler) UpdateStatus(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		errorResponse(c, http.StatusBadRequest, "证据ID不能为空")
		return
	}

	var req model.StatusUpdateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	err := h.service.UpdateStatus(id, &req)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "状态更新失败: "+err.Error())
		return
	}

	successResponse(c, nil)
}

func (h *EvidenceHandler) ManualCorrection(c *gin.Context) {
	id := c.Param("id")
	if id == "" {
		errorResponse(c, http.StatusBadRequest, "证据ID不能为空")
		return
	}

	var req model.ManualCorrectionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		errorResponse(c, http.StatusBadRequest, "参数错误: "+err.Error())
		return
	}

	err := h.service.ManualCorrection(id, &req)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "人工修正失败: "+err.Error())
		return
	}

	successResponse(c, nil)
}

func (h *EvidenceHandler) ExportEvidences(c *gin.Context) {
	data, err := h.service.ExportEvidences()
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "导出失败: "+err.Error())
		return
	}

	c.Header("Content-Type", "application/json")
	c.Header("Content-Disposition", "attachment; filename=evidences.json")
	c.String(http.StatusOK, data)
}

func (h *EvidenceHandler) GenerateReport(c *gin.Context) {
	id := c.Param("id")
	reportType := c.DefaultQuery("type", "summary")

	if id == "" {
		errorResponse(c, http.StatusBadRequest, "证据ID不能为空")
		return
	}

	report, err := h.service.GenerateReport(id, reportType)
	if err != nil {
		errorResponse(c, http.StatusInternalServerError, "报告生成失败: "+err.Error())
		return
	}

	if c.Query("format") == "text" {
		c.Header("Content-Type", "text/plain; charset=utf-8")
		c.String(http.StatusOK, report.Content)
		return
	}

	successResponse(c, report)
}
