package handler

import (
	"cert-renewal/internal/model"
	"cert-renewal/internal/service"
	"net/http"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	partnerService    service.PartnerService
	certService       service.CertService
	idempotentService service.IdempotentService
	logger            *zap.Logger
}

func NewHandler(logger *zap.Logger) *Handler {
	return &Handler{
		partnerService:    service.NewPartnerService(),
		certService:       service.NewCertService(),
		idempotentService: service.NewIdempotentService(),
		logger:            logger,
	}
}

func (h *Handler) success(c *gin.Context, data interface{}) {
	c.JSON(http.StatusOK, model.Response{
		Code:    0,
		Message: "success",
		Data:    data,
	})
}

func (h *Handler) error(c *gin.Context, code int, message string) {
	c.JSON(http.StatusOK, model.Response{
		Code:    code,
		Message: message,
	})
}

func (h *Handler) handleError(c *gin.Context, err error) {
	h.logger.Error("request failed", zap.Error(err))

	switch err {
	case model.ErrPartnerNotFound, model.ErrCertNotFound, model.ErrVerificationNotFound:
		h.error(c, 404, err.Error())
	case model.ErrDuplicateRequest, model.ErrCertAlreadyExists, model.ErrPartnerAlreadyExists:
		h.error(c, 409, err.Error())
	case model.ErrInvalidStatus, model.ErrInvalidCertStatus, model.ErrInvalidGrayPercent:
		h.error(c, 400, err.Error())
	default:
		h.error(c, 500, "internal server error")
	}
}

func (h *Handler) CreatePartner(c *gin.Context) {
	var req model.CreatePartnerRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.CheckAndMark("CreatePartner", req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, "duplicate request")
		return
	}

	partner, err := h.partnerService.CreatePartner(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, partner)
}

func (h *Handler) GetPartner(c *gin.Context) {
	id := c.Param("id")
	partner, err := h.partnerService.GetPartner(id)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, partner)
}

func (h *Handler) ListPartners(c *gin.Context) {
	var params model.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	partners, total, err := h.partnerService.ListPartners(&params)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, gin.H{
		"total": total,
		"list":  partners,
	})
}

func (h *Handler) CreateCert(c *gin.Context) {
	var req model.CreateCertRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.CheckAndMark("CreateCert", req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, "duplicate request")
		return
	}

	cert, err := h.certService.CreateCert(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, cert)
}

func (h *Handler) GetCert(c *gin.Context) {
	id := c.Param("id")
	cert, err := h.certService.GetCert(id)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, cert)
}

func (h *Handler) ListCerts(c *gin.Context) {
	var params model.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	certs, total, err := h.certService.ListCerts(&params)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, gin.H{
		"total": total,
		"list":  certs,
	})
}

func (h *Handler) CreateVerification(c *gin.Context) {
	var req model.CreateVerificationRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.CheckAndMark("CreateVerification", req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, "duplicate request")
		return
	}

	verification, err := h.certService.CreateVerification(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, verification)
}

func (h *Handler) VerifyCert(c *gin.Context) {
	var req model.VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.CheckAndMark("VerifyCert", req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, "duplicate request")
		return
	}

	verification, err := h.certService.VerifyCert(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, verification)
}

func (h *Handler) GrayEnable(c *gin.Context) {
	var req model.GrayEnableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.CheckAndMark("GrayEnable", req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, "duplicate request")
		return
	}

	cert, err := h.certService.GrayEnable(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, cert)
}

func (h *Handler) FullEnable(c *gin.Context) {
	var req model.FullEnableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.CheckAndMark("FullEnable", req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, "duplicate request")
		return
	}

	cert, err := h.certService.FullEnable(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, cert)
}

func (h *Handler) Rollback(c *gin.Context) {
	var req model.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.CheckAndMark("Rollback", req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, "duplicate request")
		return
	}

	record, err := h.certService.Rollback(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, record)
}

func (h *Handler) GetEnablementHistory(c *gin.Context) {
	var params model.HistoryQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	records, total, err := h.certService.GetEnablementHistory(&params)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, gin.H{
		"total": total,
		"list":  records,
	})
}

func (h *Handler) CreateRenewalWindow(c *gin.Context) {
	var req model.CreateRenewalWindowRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.CheckAndMark("CreateRenewalWindow", req)
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, "duplicate request")
		return
	}

	window, err := h.certService.CreateRenewalWindow(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, window)
}
