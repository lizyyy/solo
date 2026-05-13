package api

import (
	"errors"
	"net/http"
	"strings"

	"crl-service/database"
	"crl-service/service"

	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

type Handler struct {
	crlService *service.CRLService
}

func NewHandler(db *gorm.DB) *Handler {
	return &Handler{
		crlService: service.NewCRLService(db),
	}
}

type RegisterRevocationRequest struct {
	SerialNumber   string                     `json:"serial_number" binding:"required"`
	Reason         database.RevocationReason `json:"reason" binding:"required"`
	RevocationTime int64                      `json:"revocation_time"`
	EffectiveTime  int64                      `json:"effective_time"`
	RequestID      string                     `json:"request_id"`
}

type ErrorResponse struct {
	Error   string `json:"error"`
	Code    string `json:"code"`
	Message string `json:"message,omitempty"`
}

func (h *Handler) RegisterRevocation(c *gin.Context) {
	var req RegisterRevocationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "INVALID_REQUEST",
			Code:    "400",
			Message: err.Error(),
		})
		return
	}

	revocation, err := h.crlService.RegisterRevocation(service.RegisterRevocationRequest{
		SerialNumber:   req.SerialNumber,
		Reason:         req.Reason,
		RevocationTime: req.RevocationTime,
		EffectiveTime:  req.EffectiveTime,
		RequestID:      req.RequestID,
	})

	if err != nil {
		if errors.Is(err, service.ErrCertificateAlreadyRevoked) {
			c.JSON(http.StatusConflict, ErrorResponse{
				Error:   "CERTIFICATE_ALREADY_REVOKED",
				Code:    "409",
				Message: "该证书已被吊销",
			})
			return
		}
		if errors.Is(err, service.ErrDuplicateRequest) {
			c.JSON(http.StatusOK, gin.H{
				"message":    "请求已处理",
				"revocation": revocation,
			})
			return
		}
		if errors.Is(err, service.ErrInvalidRevocationReason) {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "INVALID_REVOCATION_REASON",
				Code:    "400",
				Message: "无效的吊销原因",
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Code:    "500",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message":    "吊销登记成功",
		"revocation": revocation,
	})
}

func (h *Handler) CheckRevocation(c *gin.Context) {
	serialNumber := c.Param("serial_number")
	clientIP := c.ClientIP()
	userAgent := c.GetHeader("User-Agent")

	isRevoked, revocation, err := h.crlService.CheckRevocation(serialNumber, clientIP, userAgent)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Code:    "500",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"serial_number": serialNumber,
		"is_revoked":    isRevoked,
		"revocation":    revocation,
	})
}

func (h *Handler) CreateDistributionVersion(c *gin.Context) {
	version, err := h.crlService.CreateDistributionVersion()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Code:    "500",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "分发版本创建成功",
		"version": version,
	})
}

func (h *Handler) ConfirmCache(c *gin.Context) {
	serialNumber := c.Param("serial_number")

	revocation, err := h.crlService.ConfirmCache(serialNumber)
	if err != nil {
		if errors.Is(err, service.ErrCertificateNotFound) {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "CERTIFICATE_NOT_FOUND",
				Code:    "404",
				Message: "证书未找到",
			})
			return
		}
		if errors.Is(err, service.ErrInvalidStatusTransition) {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "INVALID_STATUS_TRANSITION",
				Code:    "400",
				Message: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Code:    "500",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "缓存确认成功",
		"revocation": revocation,
	})
}

func (h *Handler) ActivateRevocation(c *gin.Context) {
	serialNumber := c.Param("serial_number")

	revocation, err := h.crlService.ActivateRevocation(serialNumber)
	if err != nil {
		if errors.Is(err, service.ErrCertificateNotFound) {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Error:   "CERTIFICATE_NOT_FOUND",
				Code:    "404",
				Message: "证书未找到",
			})
			return
		}
		if errors.Is(err, service.ErrInvalidStatusTransition) {
			c.JSON(http.StatusBadRequest, ErrorResponse{
				Error:   "INVALID_STATUS_TRANSITION",
				Code:    "400",
				Message: err.Error(),
			})
			return
		}
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Code:    "500",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":    "吊销激活成功",
		"revocation": revocation,
	})
}

func (h *Handler) GetRevocationHistory(c *gin.Context) {
	serialNumber := c.Param("serial_number")

	logs, err := h.crlService.GetRevocationHistory(serialNumber)
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Code:    "500",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"serial_number": serialNumber,
		"history":       logs,
	})
}

func (h *Handler) GetAllRevocations(c *gin.Context) {
	status := c.Query("status")

	revocations, err := h.crlService.GetAllRevocations(database.RevocationStatus(strings.ToUpper(status)))
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Code:    "500",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"revocations": revocations,
		"count":       len(revocations),
	})
}

func (h *Handler) GetDistributionVersions(c *gin.Context) {
	versions, err := h.crlService.GetDistributionVersions()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Code:    "500",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"versions": versions,
		"count":    len(versions),
	})
}

func (h *Handler) GetRefreshReport(c *gin.Context) {
	report, err := h.crlService.GetRefreshReport()
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "INTERNAL_ERROR",
			Code:    "500",
			Message: err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, report)
}
