package handler

import (
	"errors"
	"job-signature-api/internal/model"
	"job-signature-api/internal/service"
	"net/http"
	"strconv"
	"strings"

	"github.com/gin-gonic/gin"
)

func getClientIP(c *gin.Context) string {
	ip := c.GetHeader("X-Forwarded-For")
	if ip != "" {
		ips := strings.Split(ip, ",")
		if len(ips) > 0 {
			return strings.TrimSpace(ips[0])
		}
	}
	ip = c.GetHeader("X-Real-IP")
	if ip != "" {
		return ip
	}
	return c.ClientIP()
}

func handleError(c *gin.Context, err error) {
	code := "INTERNAL_ERROR"
	status := http.StatusInternalServerError

	switch {
	case errors.Is(err, service.ErrBatchAlreadyExists):
		code = "BATCH_ALREADY_EXISTS"
		status = http.StatusConflict
	case errors.Is(err, service.ErrBatchNotFound):
		code = "BATCH_NOT_FOUND"
		status = http.StatusNotFound
	case errors.Is(err, service.ErrInvalidStatus):
		code = "INVALID_STATUS"
		status = http.StatusBadRequest
	case errors.Is(err, service.ErrStatusTransitionNotAllowed):
		code = "STATUS_TRANSITION_NOT_ALLOWED"
		status = http.StatusBadRequest
	case errors.Is(err, service.ErrBatchExpired):
		code = "BATCH_EXPIRED"
		status = http.StatusGone
	case errors.Is(err, service.ErrVerifyCountExceeded):
		code = "VERIFY_COUNT_EXCEEDED"
		status = http.StatusTooManyRequests
	case errors.Is(err, service.ErrDigestMismatch):
		code = "DIGEST_MISMATCH"
		status = http.StatusUnauthorized
	case errors.Is(err, service.ErrConsumerNotFound):
		code = "CONSUMER_NOT_FOUND"
		status = http.StatusNotFound
	case errors.Is(err, service.ErrConsumerInactive):
		code = "CONSUMER_INACTIVE"
		status = http.StatusForbidden
	}

	c.JSON(status, model.ErrorResponse{
		Code:    code,
		Message: err.Error(),
	})
}

func CreateBatch(c *gin.Context) {
	var req model.CreateBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	resp, err := service.CreateBatch(&req)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func SignBatch(c *gin.Context) {
	var req model.SignBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	resp, err := service.SignBatch(&req)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func VerifyBatch(c *gin.Context) {
	var req model.VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	clientIP := getClientIP(c)
	resp, err := service.VerifyBatch(&req, clientIP)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func GetBatchStatus(c *gin.Context) {
	batchID := c.Param("batchId")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_PARAM",
			Message: "batchId is required",
		})
		return
	}

	resp, err := service.GetBatchStatus(batchID)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, resp)
}

func GetVerifyHistory(c *gin.Context) {
	batchID := c.Param("batchId")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_PARAM",
			Message: "batchId is required",
		})
		return
	}

	records, err := service.GetVerifyHistory(batchID)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, records)
}

func ListBatches(c *gin.Context) {
	status := model.JobStatus(c.Query("status"))
	limitStr := c.DefaultQuery("limit", "20")
	offsetStr := c.DefaultQuery("offset", "0")

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}
	if limit > 100 {
		limit = 100
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	batches, err := service.ListBatches(status, limit, offset)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, batches)
}

func RevokeBatch(c *gin.Context) {
	batchID := c.Param("batchId")
	if batchID == "" {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_PARAM",
			Message: "batchId is required",
		})
		return
	}

	err := service.RevokeBatch(batchID)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": "batch revoked",
	})
}

func CreateConsumer(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.ErrorResponse{
			Code:    "INVALID_REQUEST",
			Message: err.Error(),
		})
		return
	}

	consumer, err := service.CreateConsumer(req.Name)
	if err != nil {
		handleError(c, err)
		return
	}

	c.JSON(http.StatusOK, consumer)
}

func Health(c *gin.Context) {
	c.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}
