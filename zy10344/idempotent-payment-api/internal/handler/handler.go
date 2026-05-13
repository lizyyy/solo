package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/idempotent-payment-api/internal/model"
	"github.com/idempotent-payment-api/internal/service"
)

type PaymentHandler struct {
	paymentService *service.PaymentService
}

func NewPaymentHandler(paymentService *service.PaymentService) *PaymentHandler {
	return &PaymentHandler{
		paymentService: paymentService,
	}
}

func (h *PaymentHandler) CreatePayment(c *gin.Context) {
	var req model.CreatePaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: "请求参数错误",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := h.paymentService.CreatePayment(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "CREATE_FAILED",
			Message: "创建支付指令失败",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *PaymentHandler) QueryPayment(c *gin.Context) {
	paymentNo := c.Query("payment_no")
	idempotentKey := c.Query("idempotent_key")

	resp, err := h.paymentService.QueryPayment(paymentNo, idempotentKey)
	if err != nil {
		if err.Error() == "payment not found" {
			c.JSON(http.StatusNotFound, model.ErrorResponse{
				Code:    "NOT_FOUND",
				Message: "支付指令不存在",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "QUERY_FAILED",
			Message: "查询支付指令失败",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *PaymentHandler) CancelPayment(c *gin.Context) {
	var req model.CancelPaymentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: "请求参数错误",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := h.paymentService.CancelPayment(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "CANCEL_FAILED",
			Message: "撤销支付指令失败",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *PaymentHandler) ChannelCallback(c *gin.Context) {
	var req model.ChannelCallbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ChannelCallbackResponse{
			Code:    "INVALID_REQUEST",
			Message: "请求参数错误",
		})
		return
	}

	err := h.paymentService.ProcessChannelCallback(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ChannelCallbackResponse{
			Code:    "PROCESS_FAILED",
			Message: "处理回调失败",
		})
		return
	}

	c.JSON(http.StatusOK, model.ChannelCallbackResponse{
		Code:    "SUCCESS",
		Message: "回调处理成功",
	})
}

func (h *PaymentHandler) QueryHistory(c *gin.Context) {
	var req model.HistoryQueryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: "请求参数错误",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := h.paymentService.QueryHistory(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "QUERY_FAILED",
			Message: "查询历史记录失败",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *PaymentHandler) GetProblemSummary(c *gin.Context) {
	var req model.ProblemSummaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: "请求参数错误",
			Detail:  err.Error(),
		})
		return
	}

	resp, err := h.paymentService.GetProblemSummary(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "QUERY_FAILED",
			Message: "查询问题汇总失败",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, resp)
}

func (h *PaymentHandler) ExportProblemSummary(c *gin.Context) {
	var req model.ProblemSummaryRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: "请求参数错误",
			Detail:  err.Error(),
		})
		return
	}

	filename, err := h.paymentService.ExportProblemSummary(&req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, model.ErrorResponse{
			Code:    "EXPORT_FAILED",
			Message: "导出问题汇总失败",
			Detail:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"code":      "SUCCESS",
		"message":   "导出成功",
		"filename":  filename,
		"download_url": "/export/" + filename,
	})
}

func (h *PaymentHandler) HealthCheck(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status":  "ok",
		"service": "idempotent-payment-api",
	})
}
