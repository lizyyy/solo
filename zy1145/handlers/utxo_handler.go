package handlers

import (
	"btc-recharge-service/models"
	"btc-recharge-service/services"
	"net/http"

	"github.com/gin-gonic/gin"
)

type UTXOHandler struct {
	utxoSvc *services.UTXOService
}

func NewUTXOHandler(utxoSvc *services.UTXOService) *UTXOHandler {
	return &UTXOHandler{
		utxoSvc: utxoSvc,
	}
}

type UTXOSummaryResponse struct {
	Code              string `json:"code"`
	Message           string `json:"message"`
	TotalBalance      int64  `json:"total_balance"`
	ConfirmedBalance  int64  `json:"confirmed_balance"`
	PendingBalance    int64  `json:"pending_balance"`
	SuspiciousBalance int64  `json:"suspicious_balance"`
	TotalUTXOs        int    `json:"total_utxos"`
	SpendableUTXOs    int    `json:"spendable_utxos"`
}

func (h *UTXOHandler) GetAddressBalance(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "地址不能为空",
		})
		return
	}

	balance, err := h.utxoSvc.GetAddressBalance(address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询地址余额失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    balance,
	})
}

func (h *UTXOHandler) GetUserBalances(c *gin.Context) {
	userID := c.Param("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "用户 ID 不能为空",
		})
		return
	}

	balances, err := h.utxoSvc.GetUserBalances(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询用户余额失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    balances,
	})
}

func (h *UTXOHandler) GetUTXOsByAddress(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "地址不能为空",
		})
		return
	}

	utxos, err := h.utxoSvc.GetUTXOsByAddress(address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询地址 UTXO 失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    utxos,
	})
}

func (h *UTXOHandler) GetSpendableUTXOs(c *gin.Context) {
	address := c.Param("address")
	if address == "" {
		c.JSON(http.StatusBadRequest, APIResponse{
			Code:    models.InvalidRequest.Code,
			Message: "地址不能为空",
		})
		return
	}

	utxos, err := h.utxoSvc.GetSpendableUTXOs(address)
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询可花费 UTXO 失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    utxos,
	})
}

func (h *UTXOHandler) GetAllSpendableUTXOs(c *gin.Context) {
	utxos, err := h.utxoSvc.GetAllSpendableUTXOs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询所有可花费 UTXO 失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    utxos,
	})
}

func (h *UTXOHandler) GetSuspiciousUTXOs(c *gin.Context) {
	utxos, err := h.utxoSvc.GetSuspiciousUTXOs()
	if err != nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Code:    models.DatabaseError.Code,
			Message: "查询可疑 UTXO 失败: " + err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, APIResponse{
		Code:    models.Success.Code,
		Message: models.Success.Message,
		Data:    utxos,
	})
}

func (h *UTXOHandler) GetUTXOSummary(c *gin.Context) {
	summary := UTXOSummaryResponse{
		Code:              models.Success.Code,
		Message:           models.Success.Message,
		TotalBalance:      h.utxoSvc.CalculateTotalConfirmedBalance() + h.utxoSvc.CalculateTotalPendingBalance() + h.utxoSvc.CalculateTotalSuspiciousBalance(),
		ConfirmedBalance:  h.utxoSvc.CalculateTotalConfirmedBalance(),
		PendingBalance:    h.utxoSvc.CalculateTotalPendingBalance(),
		SuspiciousBalance: h.utxoSvc.CalculateTotalSuspiciousBalance(),
	}

	c.JSON(http.StatusOK, summary)
}
