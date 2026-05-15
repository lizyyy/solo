package handler

import (
	"cert-renewal/internal/model"
	"cert-renewal/internal/service"
	"encoding/csv"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"go.uber.org/zap"
)

type Handler struct {
	partnerService    service.PartnerService
	certService       service.CertService
	idempotentService service.IdempotentService
	renewalService    service.RenewalReminderService
	logger            *zap.Logger
}

func NewHandler(logger *zap.Logger) *Handler {
	return &Handler{
		partnerService:    service.NewPartnerService(),
		certService:       service.NewCertService(),
		idempotentService: service.NewIdempotentService(),
		renewalService:    service.NewRenewalReminderService(),
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
	case model.ErrPartnerNotFound, model.ErrCertNotFound, model.ErrVerificationNotFound, model.ErrRenewalWindowNotFound:
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

	_, exists, err := h.idempotentService.Check(req.RequestID, "CreatePartner")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	partner, err := h.partnerService.CreatePartner(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "CreatePartner", req, partner)
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

	_, exists, err := h.idempotentService.Check(req.RequestID, "CreateCert")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	cert, err := h.certService.CreateCert(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "CreateCert", req, cert)
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

	_, exists, err := h.idempotentService.Check(req.RequestID, "CreateVerification")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	verification, err := h.certService.CreateVerification(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "CreateVerification", req, verification)
	h.success(c, verification)
}

func (h *Handler) VerifyCert(c *gin.Context) {
	var req model.VerifyRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.Check(req.RequestID, "VerifyCert")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	verification, err := h.certService.VerifyCert(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "VerifyCert", req, verification)
	h.success(c, verification)
}

func (h *Handler) GrayEnable(c *gin.Context) {
	var req model.GrayEnableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.Check(req.RequestID, "GrayEnable")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	cert, err := h.certService.GrayEnable(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "GrayEnable", req, cert)
	h.success(c, cert)
}

func (h *Handler) FullEnable(c *gin.Context) {
	var req model.FullEnableRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.Check(req.RequestID, "FullEnable")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	cert, err := h.certService.FullEnable(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "FullEnable", req, cert)
	h.success(c, cert)
}

func (h *Handler) Rollback(c *gin.Context) {
	var req model.RollbackRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.Check(req.RequestID, "Rollback")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	result, err := h.certService.Rollback(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "Rollback", req, result)
	h.success(c, result)
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

	_, exists, err := h.idempotentService.Check(req.RequestID, "CreateRenewalWindow")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	window, err := h.certService.CreateRenewalWindow(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "CreateRenewalWindow", req, window)
	h.success(c, window)
}

func (h *Handler) TriggerReminders(c *gin.Context) {
	var req model.TriggerReminderRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.Check(req.RequestID, "TriggerReminders")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	reminders, err := h.renewalService.TriggerReminders(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "TriggerReminders", req, reminders)
	h.success(c, reminders)
}

func (h *Handler) ListReminders(c *gin.Context) {
	var params model.ReminderQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	reminders, total, err := h.renewalService.ListReminders(&params)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.success(c, gin.H{
		"total": total,
		"list":  reminders,
	})
}

func (h *Handler) MarkReminderSent(c *gin.Context) {
	var req model.MarkReminderSentRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	_, exists, err := h.idempotentService.Check(req.RequestID, "MarkReminderSent")
	if err != nil {
		h.handleError(c, err)
		return
	}
	if exists {
		h.error(c, 409, fmt.Sprintf("duplicate request: %s", req.RequestID))
		return
	}

	reminder, err := h.renewalService.MarkSent(&req)
	if err != nil {
		h.handleError(c, err)
		return
	}

	h.idempotentService.MarkSuccess(req.RequestID, "MarkReminderSent", req, reminder)
	h.success(c, reminder)
}

func (h *Handler) ExportCerts(c *gin.Context) {
	var params model.ExportQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	certs, _, err := h.certService.ListCerts(&model.QueryParams{
		PartnerID: params.PartnerID,
		Status:    params.Status,
		Page:      1,
		PageSize:  10000,
	})
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"certs_%s.csv\"", time.Now().Format("20060102150405")))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"ID", "PartnerID", "SerialNumber", "Subject", "Issuer", "NotBefore", "NotAfter", "Status", "IsCurrent", "GrayPercent", "CreatedAt"})

	for _, cert := range certs {
		writer.Write([]string{
			cert.ID,
			cert.PartnerID,
			cert.SerialNumber,
			cert.Subject,
			cert.Issuer,
			cert.NotBefore.Format(time.RFC3339),
			cert.NotAfter.Format(time.RFC3339),
			string(cert.Status),
			strconv.FormatBool(cert.IsCurrent),
			strconv.Itoa(cert.GrayPercent),
			cert.CreatedAt.Format(time.RFC3339),
		})
	}
}

func (h *Handler) ExportEnablementHistory(c *gin.Context) {
	var params model.HistoryQueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	records, _, err := h.certService.GetEnablementHistory(&params)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"enablement_history_%s.csv\"", time.Now().Format("20060102150405")))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"ID", "PartnerID", "CertID", "EnablementType", "GrayPercent", "Operator", "EnableAt", "PreviousStatus", "NewStatus", "ChangeReason"})

	for _, record := range records {
		writer.Write([]string{
			record.ID,
			record.PartnerID,
			record.CertID,
			string(record.EnablementType),
			strconv.Itoa(record.GrayPercent),
			record.Operator,
			record.EnableAt.Format(time.RFC3339),
			string(record.PreviousStatus),
			string(record.NewStatus),
			record.ChangeReason,
		})
	}
}

func (h *Handler) ExportVerifications(c *gin.Context) {
	var params model.QueryParams
	if err := c.ShouldBindQuery(&params); err != nil {
		h.error(c, 400, err.Error())
		return
	}

	records, _, err := h.certService.ListVerifications(&params)
	if err != nil {
		h.handleError(c, err)
		return
	}

	c.Header("Content-Type", "text/csv; charset=utf-8")
	c.Header("Content-Disposition", fmt.Sprintf("attachment; filename=\"verifications_%s.csv\"", time.Now().Format("20060102150405")))

	writer := csv.NewWriter(c.Writer)
	defer writer.Flush()

	writer.Write([]string{"ID", "PartnerID", "NewCertID", "OldCertID", "Status", "VerificationType", "Verifier", "VerifiedAt", "CreatedAt"})

	for _, record := range records {
		verifiedAt := ""
		if record.VerifiedAt != nil {
			verifiedAt = record.VerifiedAt.Format(time.RFC3339)
		}
		writer.Write([]string{
			record.ID,
			record.PartnerID,
			record.NewCertID,
			record.OldCertID,
			string(record.Status),
			record.VerificationType,
			record.Verifier,
			verifiedAt,
			record.CreatedAt.Format(time.RFC3339),
		})
	}
}
