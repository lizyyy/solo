package handler

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"vet-vaccine-cold-chain/models"
	"vet-vaccine-cold-chain/repository"
	"vet-vaccine-cold-chain/service"
)

type APIResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Message string      `json:"message,omitempty"`
}

func SubmitMaterial(c *gin.Context) {
	var req models.SubmissionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	version, evalResult, err := service.ProcessSubmission(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	result := gin.H{
		"business_key":   req.BusinessKey,
		"business_type":  req.BusinessType,
		"evidence_version": version,
		"evidence_chain_updated": true,
		"message": "证据链已更新，业务结果不会重复计算",
	}

	if evalResult != nil {
		result["auto_evaluated"] = true
		result["evaluation"] = evalResult
	} else {
		result["auto_evaluated"] = false
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    result,
		Message: "材料提交成功",
	})
}

func AutoEvaluate(c *gin.Context) {
	businessKey := c.Query("business_key")
	businessType := c.Query("business_type")

	if businessKey == "" || businessType == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "business_key 和 business_type 为必填参数",
		})
		return
	}

	result, err := service.EvaluateColdChainCompliance(businessKey, businessType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    result,
	})
}

func ManualProcess(c *gin.Context) {
	var req struct {
		BusinessKey  string `json:"business_key" binding:"required"`
		BusinessType string `json:"business_type" binding:"required"`
		Decision     string `json:"decision" binding:"required"`
		Reason       string `json:"reason"`
		ProcessedBy  string `json:"processed_by" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	br := &models.BusinessResult{
		BusinessKey:  req.BusinessKey,
		BusinessType: req.BusinessType,
		ResultStatus: req.Decision,
		ResultData:   repository.SerializeData(gin.H{"reason": req.Reason, "processed_by": req.ProcessedBy, "manual": true}),
	}

	existingResult, _ := repository.GetBusinessResult(req.BusinessKey, req.BusinessType)
	isRecalculation := existingResult != nil

	if err := repository.SaveBusinessResult(br, isRecalculation); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: gin.H{
			"business_key":  req.BusinessKey,
			"business_type": req.BusinessType,
			"decision":      req.Decision,
			"is_update":     isRecalculation,
		},
		Message: "人工处理完成",
	})
}

func ReturnForCorrection(c *gin.Context) {
	var req struct {
		BusinessKey  string `json:"business_key" binding:"required"`
		BusinessType string `json:"business_type" binding:"required"`
		Reason       string `json:"reason" binding:"required"`
		ReturnedBy   string `json:"returned_by" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := service.ReturnForCorrection(req.BusinessKey, req.BusinessType, req.Reason, req.ReturnedBy); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: gin.H{
			"business_key":  req.BusinessKey,
			"business_type": req.BusinessType,
			"reason":        req.Reason,
		},
		Message: "已退回补充材料",
	})
}

func Recalculate(c *gin.Context) {
	var req struct {
		BusinessKey     string `json:"business_key" binding:"required"`
		BusinessType    string `json:"business_type" binding:"required"`
		RecalculatedBy  string `json:"recalculated_by" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	result, err := service.RecalculateResult(req.BusinessKey, req.BusinessType, req.RecalculatedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    result,
		Message: "重新计算完成",
	})
}

func VerifyResult(c *gin.Context) {
	businessKey := c.Query("business_key")
	businessType := c.Query("business_type")

	if businessKey == "" || businessType == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "business_key 和 business_type 为必填参数",
		})
		return
	}

	result, err := repository.GetBusinessResult(businessKey, businessType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	evidence, err := repository.GetEvidenceChain(businessKey, businessType)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data: gin.H{
			"business_result": result,
			"evidence_chain":  evidence,
			"evidence_count":  len(evidence),
		},
	})
}

func ValidateColdChainWindow(c *gin.Context) {
	var req struct {
		RefrigeratorID string    `json:"refrigerator_id" binding:"required"`
		StartTime      time.Time `json:"start_time" binding:"required"`
		EndTime        time.Time `json:"end_time" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	result, err := service.ValidateColdChainWindow(req.RefrigeratorID, req.StartTime, req.EndTime)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    result,
	})
}

func GetOpenVialStatus(c *gin.Context) {
	openRecordID := c.Param("id")
	if openRecordID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "open_record_id 为必填参数",
		})
		return
	}

	result, err := service.GetOpenVialStatus(openRecordID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    result,
	})
}

func GetTransferTrail(c *gin.Context) {
	batchNumber := c.Param("batch")
	if batchNumber == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   "batch_number 为必填参数",
		})
		return
	}

	result, err := service.GetTransferTrail(batchNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    result,
	})
}

func ConfirmDiscard(c *gin.Context) {
	var req struct {
		DiscardID   string `json:"discard_id" binding:"required"`
		ConfirmedBy string `json:"confirmed_by" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := service.ConfirmDiscardRecord(req.DiscardID, req.ConfirmedBy); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "废弃确认成功",
	})
}

func GenerateReport(c *gin.Context) {
	var req struct {
		StartDate   time.Time `json:"start_date" binding:"required"`
		EndDate     time.Time `json:"end_date" binding:"required"`
		GeneratedBy string    `json:"generated_by" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	report, err := service.GenerateColdChainReport(req.StartDate, req.EndDate, req.GeneratedBy)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    report,
		Message: "报告生成成功",
	})
}

func ExportReportCSV(c *gin.Context) {
	reportID := c.Param("id")
	filePath := "./report_" + reportID + ".csv"

	if err := service.ExportReportToCSV(reportID, filePath); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.FileAttachment(filePath, "cold_chain_report.csv")
}

func HealthCheck(c *gin.Context) {
	result, err := service.HealthCheck()
	if err != nil {
		c.JSON(http.StatusServiceUnavailable, APIResponse{
			Success: false,
			Data:    result,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    result,
	})
}

func ConsistencyCheck(c *gin.Context) {
	result, err := service.DataConsistencyCheck()
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    result,
	})
}

func CreateRefrigerator(c *gin.Context) {
	var req models.Refrigerator
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := repository.CreateRefrigerator(&req); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    req,
		Message: "冰箱创建成功",
	})
}

func CreateVaccine(c *gin.Context) {
	var req models.Vaccine
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := repository.CreateVaccine(&req); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    req,
		Message: "疫苗创建成功",
	})
}

func CreateInventory(c *gin.Context) {
	var req models.VaccineInventory
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := repository.CreateVaccineInventory(&req); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    req,
		Message: "库存创建成功",
	})
}

func CreateTemperatureRecord(c *gin.Context) {
	var req models.TemperatureRecord
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := repository.CreateTemperatureRecord(&req); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    req,
		Message: "温度记录创建成功",
	})
}

func CreateOpenRecord(c *gin.Context) {
	var req models.OpenRecord
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := repository.CreateOpenRecord(&req); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    req,
		Message: "开瓶记录创建成功",
	})
}

func CreateDiscardRecord(c *gin.Context) {
	var req models.DiscardRecord
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := repository.CreateDiscardRecord(&req); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    req,
		Message: "废弃记录创建成功",
	})
}

func CreateTransfer(c *gin.Context) {
	var req struct {
		BatchNumber   string `json:"batch_number" binding:"required"`
		FromFridge    string `json:"from_fridge" binding:"required"`
		ToFridge      string `json:"to_fridge" binding:"required"`
		Doses         int    `json:"doses" binding:"required"`
		TransferredBy string `json:"transferred_by" binding:"required"`
		Reason        string `json:"reason"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := service.ProcessVaccineTransfer(req.BatchNumber, req.FromFridge, req.ToFridge, req.Doses, req.TransferredBy, req.Reason); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: "调拨成功",
	})
}

func CreateVaccination(c *gin.Context) {
	var req models.VaccinationRecord
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	if err := repository.CreateVaccinationRecord(&req); err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Error:   err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Data:    req,
		Message: "接种记录创建成功",
	})
}
