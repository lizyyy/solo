package model

import "time"

type Response struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

type CreatePartnerRequest struct {
	Name         string `json:"name" binding:"required"`
	Code         string `json:"code" binding:"required"`
	Description  string `json:"description"`
	ContactName  string `json:"contact_name"`
	ContactEmail string `json:"contact_email"`
	ContactPhone string `json:"contact_phone"`
	RequestID    string `json:"request_id" binding:"required"`
}

type CreateCertRequest struct {
	PartnerID         string    `json:"partner_id" binding:"required"`
	SerialNumber      string    `json:"serial_number" binding:"required"`
	Subject           string    `json:"subject" binding:"required"`
	Issuer            string    `json:"issuer" binding:"required"`
	NotBefore         time.Time `json:"not_before" binding:"required"`
	NotAfter          time.Time `json:"not_after" binding:"required"`
	Fingerprint       string    `json:"fingerprint" binding:"required"`
	CertContent       string    `json:"cert_content" binding:"required"`
	PrivateKeyContent string    `json:"private_key_content"`
	Remark            string    `json:"remark"`
	RequestID         string    `json:"request_id" binding:"required"`
}

type CreateRenewalWindowRequest struct {
	PartnerID   string    `json:"partner_id" binding:"required"`
	CertID      string    `json:"cert_id" binding:"required"`
	WindowStart time.Time `json:"window_start" binding:"required"`
	WindowEnd   time.Time `json:"window_end" binding:"required"`
	Remark      string    `json:"remark"`
	RequestID   string    `json:"request_id" binding:"required"`
}

type CreateVerificationRequest struct {
	PartnerID        string `json:"partner_id" binding:"required"`
	NewCertID        string `json:"new_cert_id" binding:"required"`
	OldCertID        string `json:"old_cert_id" binding:"required"`
	VerificationType string `json:"verification_type"`
	VerificationData string `json:"verification_data"`
	RequestID        string `json:"request_id" binding:"required"`
}

type VerifyRequest struct {
	VerificationID     string `json:"verification_id" binding:"required"`
	Status             string `json:"status" binding:"required,oneof=SUCCESS FAILED"`
	VerificationResult string `json:"verification_result"`
	Verifier           string `json:"verifier" binding:"required"`
	RequestID          string `json:"request_id" binding:"required"`
}

type GrayEnableRequest struct {
	CertID      string `json:"cert_id" binding:"required"`
	GrayPercent int    `json:"gray_percent" binding:"required,min=1,max=99"`
	Operator    string `json:"operator" binding:"required"`
	Reason      string `json:"reason"`
	RequestID   string `json:"request_id" binding:"required"`
}

type FullEnableRequest struct {
	CertID    string `json:"cert_id" binding:"required"`
	Operator  string `json:"operator" binding:"required"`
	Reason    string `json:"reason"`
	RequestID string `json:"request_id" binding:"required"`
}

type RollbackRequest struct {
	PartnerID  string `json:"partner_id" binding:"required"`
	CertID     string `json:"cert_id" binding:"required"`
	Reason     string `json:"reason" binding:"required"`
	Operator   string `json:"operator" binding:"required"`
	RequestID  string `json:"request_id" binding:"required"`
}

type QueryParams struct {
	PartnerID string `form:"partner_id"`
	Status    string `form:"status"`
	Page      int    `form:"page,default=1"`
	PageSize  int    `form:"page_size,default=20"`
}

type CertListResponse struct {
	Total int64              `json:"total"`
	List  []ClientCertificate `json:"list"`
}

type HistoryQueryParams struct {
	PartnerID  string    `form:"partner_id"`
	CertID     string    `form:"cert_id"`
	StartTime  time.Time `form:"start_time"`
	EndTime    time.Time `form:"end_time"`
	Page       int       `form:"page,default=1"`
	PageSize   int       `form:"page_size,default=20"`
}

type EnablementHistoryResponse struct {
	Total int64               `json:"total"`
	List  []EnablementRecord  `json:"list"`
}
