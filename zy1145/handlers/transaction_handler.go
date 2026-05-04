package handlers

import (
	"btc-recharge-service/models"
	"btc-recharge-service/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

type TransactionHandler struct {
	txSvc   *services.TransactionService
	riskSvc *services.RiskControlService
}

func NewTransactionHandler(txSvc *services.TransactionService, riskSvc *services.RiskControlService) *TransactionHandler {
	return &TransactionHandler{
		txSvc:   txSvc,
		riskSvc: riskSvc,
	}
}

type MarkSuspiciousRequest struct {
	Reason string `json:"reason" binding:"required"`
	UserID string `json:"user_id" binding:"required"`
}

type RiskConfigResponse struct {
	Code            string `json:"code"`
	Message         string `json:"message"`
	ConfirmedBlocks int    `json:"confirmed_blocks"`
	DustThreshold   int64  `json:"dust_threshold"`
	FeeRate         int64  `json:"fee_rate"`
	EnableZeroConf  bool   `json:"enable_zero_conf"`
	MaxHotBalance   int64  `json:"max_hot_balance"`
	MinColdBalance  int64  `json:"min_cold_balance"`
}

type EstimateFeeRequest struct {
	InputCount  int `form:"input_count" binding:"required"`
	OutputCount int `form:"output_count" binding:"required"`
}

type EstimateFeeResponse struct {
	Code         string `json:"code"`
	Message      string `json:"message"`
	InputCount   int    `json:"input_count"`
	OutputCount  int    `json:"output_count"`
	FeeRate      int64  `json:"fee_rate"`
	EstimatedFee int64  `json:"estimated_fee"`
}

func (h *TransactionHandler) ImportBlock(c *gin.Context) {
	var req services.ImportBlockRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "请求参数无效: " + err.Error(),
		})
		return
	}

	resp, err := h.txSvc.ImportBlock(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "导入区块失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *TransactionHandler) ImportMempool(c *gin.Context) {
	var req services.ImportMempoolRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "请求参数无效: " + err.Error(),
		})
		return
	}

	resp, err := h.txSvc.ImportMempool(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "导入 mempool 交易失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *TransactionHandler) GetTransaction(c *gin.Context) {
	txID := c.Param("tx_id")
	if txID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "交易 ID 不能为空",
		})
		return
	}

	tx, err := h.txSvc.GetTransactionByID(txID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询交易失败: " + err.Error(),
		})
		return
	}

	if tx == nil {
		c.JSON(http.StatusNotFound, APIResponse{
			Code:    models.ResourceNotFound.Code,
			Message: models.ResourceNotFound.Message,
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    tx,
	})
}

func (h *TransactionHandler) GetTransactionsByAddress(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "地址不能为空",
		})
		return
	}

	txs, err := h.txSvc.GetTransactionsByAddress(address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询地址交易失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    txs,
	})
}

func (h *TransactionHandler) CalculateDepositStatus(c *gin.Context) {
	txID := c.Param("tx_id")
	if txID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "交易 ID 不能为空",
		})
		return
	}

	status, err := h.txSvc.CalculateDepositStatus(txID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "计算充值状态失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    status,
	})
}

func (h *TransactionHandler) MarkAsSuspicious(c *gin.Context) {
	txID := c.Param("tx_id")
	if txID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "交易 ID 不能为空",
		})
		return
	}

	var req MarkSuspiciousRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "请求参数无效: " + err.Error(),
		})
		return
	}

	resp, err := h.txSvc.MarkTransactionAsSuspicious(txID, req.Reason, req.UserID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "标记可疑交易失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *TransactionHandler) GetRiskConfig(c *gin.Context) {
	c.JSON(http.StatusOK, RiskConfigResponse{
		Code:            models.Success.Code,
		Message:         models.Success.Message,
		ConfirmedBlocks: h.riskSvc.GetConfirmedBlocks(),
		DustThreshold:   h.riskSvc.GetDustThreshold(),
		FeeRate:         h.riskSvc.GetFeeRate(),
		EnableZeroConf:  false,
		MaxHotBalance:   1000000000,
		MinColdBalance:  100000000,
	})
}

func (h *TransactionHandler) EstimateFee(c *gin.Context) {
	var req EstimateFeeRequest
	if err := c.ShouldBindQuery(&req); err != nil {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "请求参数无效: " + err.Error(),
		})
		return
	}

	feeRate := h.riskSvc.GetFeeRate()
	estimatedFee := h.riskSvc.CalculateEstimatedFee(req.InputCount, req.OutputCount)

	c.JSON(http.StatusOK, EstimateFeeResponse{
		Code:         models.Success.Code,
		Message:      models.Success.Message,
		InputCount:   req.InputCount,
		OutputCount:  req.OutputCount,
		FeeRate:      feeRate,
		EstimatedFee: estimatedFee,
	})
}
