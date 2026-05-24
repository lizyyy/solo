package handler

import (
	"fuel-subsidy-api/internal/config"
	"fuel-subsidy-api/internal/models"
	"fuel-subsidy-api/internal/service"
	"fuel-subsidy-api/pkg/utils"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type ApplicationHandler struct {
	cfg *config.Config
}

func NewApplicationHandler(cfg *config.Config) *ApplicationHandler {
	return &ApplicationHandler{cfg: cfg}
}

func (h *ApplicationHandler) CreateApplication(c *gin.Context) {
	var req service.ApplicationCreateRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	operator := c.GetHeader("X-Operator")
	if operator == "" {
		operator = "admin"
	}

	app, dupCheck, valResult, err := service.CreateApplication(&req, operator)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	if dupCheck != nil && dupCheck.IsDuplicate {
		c.JSON(200, gin.H{
			"code":    1001,
			"message": "重复提交，返回原处理结论",
			"data": gin.H{
				"is_duplicate":    true,
				"original_application": app,
				"processed_by":    dupCheck.ProcessedBy,
				"processed_at":    dupCheck.ProcessedAt,
				"audit_logs":      dupCheck.Logs,
				"validation":      valResult,
			},
		})
		return
	}

	utils.Success(c, gin.H{
		"application": app,
		"validation":  valResult,
	})
}

func (h *ApplicationHandler) VerifyApplication(c *gin.Context) {
	var req service.StageTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if req.Operator == "" {
		req.Operator = c.GetHeader("X-Operator")
		if req.Operator == "" {
			req.Operator = "auditor1"
		}
	}

	app, valResult, err := service.VerifyApplication(&req)
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	utils.Success(c, gin.H{
		"application": app,
		"validation":  valResult,
	})
}

func (h *ApplicationHandler) ProcessApplication(c *gin.Context) {
	var req service.StageTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if req.Operator == "" {
		req.Operator = c.GetHeader("X-Operator")
		if req.Operator == "" {
			req.Operator = "auditor2"
		}
	}

	app, err := service.ProcessApplication(&req, h.cfg.SubsidyRate)
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	utils.Success(c, app)
}

func (h *ApplicationHandler) ReviewApplication(c *gin.Context) {
	var req service.StageTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if req.Operator == "" {
		req.Operator = c.GetHeader("X-Operator")
		if req.Operator == "" {
			req.Operator = "reviewer"
		}
	}

	app, err := service.ReviewApplication(&req)
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	utils.Success(c, app)
}

func (h *ApplicationHandler) CloseApplication(c *gin.Context) {
	var req service.StageTransitionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	if req.Operator == "" {
		req.Operator = c.GetHeader("X-Operator")
		if req.Operator == "" {
			req.Operator = "admin"
		}
	}

	app, err := service.CloseApplication(&req)
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	utils.Success(c, app)
}

func (h *ApplicationHandler) GetApplication(c *gin.Context) {
	idStr := c.Param("id")
	appID, err := uuid.Parse(idStr)
	if err != nil {
		utils.BadRequest(c, "无效的申请ID")
		return
	}

	detail, err := service.GetApplicationDetail(appID)
	if err != nil {
		utils.NotFound(c, "申请不存在")
		return
	}

	utils.Success(c, detail)
}

func (h *ApplicationHandler) QueryApplications(c *gin.Context) {
	var params service.QueryApplicationParams

	yearStr := c.Query("year")
	if yearStr != "" {
		year, _ := strconv.Atoi(yearStr)
		params.ApplicationYear = &year
	}

	vesselNo := c.Query("vessel_number")
	if vesselNo != "" {
		params.VesselNumber = &vesselNo
	}

	applicant := c.Query("applicant_name")
	if applicant != "" {
		params.ApplicantName = &applicant
	}

	status := c.Query("status")
	if status != "" {
		params.Status = &status
	}

	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	params.Page = page
	params.PageSize = pageSize

	result, err := service.QueryApplications(&params)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, result)
}

func (h *ApplicationHandler) GetStatistics(c *gin.Context) {
	yearStr := c.Query("year")
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		utils.BadRequest(c, "请指定年度参数 year")
		return
	}

	stats, err := service.GetStatistics(year)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, stats)
}

func (h *ApplicationHandler) ExportReport(c *gin.Context) {
	yearStr := c.Query("year")
	year, err := strconv.Atoi(yearStr)
	if err != nil {
		utils.BadRequest(c, "请指定年度参数 year")
		return
	}

	operator := c.GetHeader("X-Operator")
	if operator == "" {
		operator = "admin"
	}

	filePath, err := service.ExportExcel(year, operator)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, gin.H{
		"file_path": filePath,
		"file_name": filePath[strings.LastIndex(filePath, "/")+1:],
	})
}

func (h *ApplicationHandler) AddFuelReceipt(c *gin.Context) {
	var req models.FuelReceipt
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	err := service.AddFuelReceipt(&req)
	if err != nil {
		utils.BadRequest(c, err.Error())
		return
	}

	utils.Success(c, req)
}

func (h *ApplicationHandler) ListFuelReceipts(c *gin.Context) {
	vesselNumber := c.Query("vessel_number")
	isUsedStr := c.Query("is_used")

	var isUsed *bool
	if isUsedStr != "" {
		b, _ := strconv.ParseBool(isUsedStr)
		isUsed = &b
	}

	receipts, err := service.ListFuelReceipts(vesselNumber, isUsed)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, receipts)
}

func (h *ApplicationHandler) RecalculateSubsidy(c *gin.Context) {
	idStr := c.Param("id")
	appID, err := uuid.Parse(idStr)
	if err != nil {
		utils.BadRequest(c, "无效的申请ID")
		return
	}

	var req struct {
		NewRate float64 `json:"new_rate" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		utils.BadRequest(c, "参数错误: "+err.Error())
		return
	}

	app, err := service.RecalculateSubsidy(appID, req.NewRate)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, app)
}

func (h *ApplicationHandler) GetAuditLogs(c *gin.Context) {
	idStr := c.Param("id")
	appID, err := uuid.Parse(idStr)
	if err != nil {
		utils.BadRequest(c, "无效的申请ID")
		return
	}

	logs, err := service.GetAuditLogs(appID)
	if err != nil {
		utils.InternalError(c, err.Error())
		return
	}

	utils.Success(c, logs)
}
