package model

import (
	"time"

	"github.com/google/uuid"
)

type NegotiationStatus string

const (
	StatusPending   NegotiationStatus = "PENDING"
	StatusSuccess   NegotiationStatus = "SUCCESS"
	StatusFailed    NegotiationStatus = "FAILED"
	StatusFallback  NegotiationStatus = "FALLBACK"
	StatusCancelled NegotiationStatus = "CANCELLED"
)

type ClientIdentity struct {
	ClientID    string    `json:"client_id" gorm:"primaryKey"`
	ClientName  string    `json:"client_name"`
	ClientType  string    `json:"client_type"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
	CreatedBy   string    `json:"created_by"`
	Description string    `json:"description"`
}

type Capability struct {
	Name         string   `json:"name"`
	Version      string   `json:"version"`
	Supported    bool     `json:"supported"`
	Requirements []string `json:"requirements,omitempty"`
}

type FallbackOption struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Priority    int    `json:"priority"`
}

type CapabilityDeclaration struct {
	ID            string       `json:"id" gorm:"primaryKey"`
	ClientID      string       `json:"client_id" gorm:"index"`
	APIVersion    string       `json:"api_version"`
	Capabilities  []Capability `json:"capabilities" gorm:"serializer:json"`
	FallbackOpts  []FallbackOption `json:"fallback_opts" gorm:"serializer:json"`
	DeclaredAt    time.Time    `json:"declared_at"`
	DeclaredBy    string       `json:"declared_by"`
	ExpiresAt     *time.Time   `json:"expires_at,omitempty"`
}

type NegotiationResult struct {
	ID              string            `json:"id" gorm:"primaryKey"`
	ClientID        string            `json:"client_id" gorm:"index"`
	DeclarationID   string            `json:"declaration_id" gorm:"uniqueIndex"`
	APIVersion      string            `json:"api_version"`
	NegotiatedVersion string          `json:"negotiated_version"`
	Status          NegotiationStatus `json:"status"`
	SelectedCapabilities []Capability `json:"selected_capabilities" gorm:"serializer:json"`
	SelectedFallback *FallbackOption  `json:"selected_fallback,omitempty" gorm:"serializer:json"`
	NegotiatedAt    time.Time         `json:"negotiated_at"`
	NegotiatedBy    string            `json:"negotiated_by"`
	CompletedAt     *time.Time        `json:"completed_at,omitempty"`
	ErrorMessage    string            `json:"error_message,omitempty"`
	Remark          string            `json:"remark,omitempty"`
	CreatedAt       time.Time         `json:"created_at"`
	UpdatedAt       time.Time         `json:"updated_at"`
}

type HitLog struct {
	ID              string    `json:"id" gorm:"primaryKey"`
	ResultID        string    `json:"result_id" gorm:"index"`
	ClientID        string    `json:"client_id" gorm:"index"`
	HitTime         time.Time `json:"hit_time"`
	HitSource       string    `json:"hit_source"`
	RequestContext  string    `json:"request_context,omitempty"`
	CacheHit        bool      `json:"cache_hit"`
	ResponseTimeMs  int64     `json:"response_time_ms"`
}

type StatusTransition struct {
	ID          string            `json:"id" gorm:"primaryKey"`
	ResultID    string            `json:"result_id" gorm:"index"`
	FromStatus  NegotiationStatus `json:"from_status"`
	ToStatus    NegotiationStatus `json:"to_status"`
	TransitionedAt time.Time      `json:"transitioned_at"`
	TransitionedBy string         `json:"transitioned_by"`
	Reason      string            `json:"reason,omitempty"`
}

type CreateDeclarationRequest struct {
	ClientID     string           `json:"client_id" binding:"required"`
	APIVersion   string           `json:"api_version" binding:"required"`
	Capabilities []Capability     `json:"capabilities" binding:"required,min=1"`
	FallbackOpts []FallbackOption `json:"fallback_opts"`
	DeclaredBy   string           `json:"declared_by" binding:"required"`
	ExpiresAt    *time.Time       `json:"expires_at"`
}

type NegotiateRequest struct {
	DeclarationID string `json:"declaration_id" binding:"required"`
	NegotiatedBy  string `json:"negotiated_by" binding:"required"`
	TargetVersion string `json:"target_version,omitempty"`
}

type StatusUpdateRequest struct {
	ResultID       string            `json:"result_id" binding:"required"`
	TargetStatus   NegotiationStatus `json:"target_status" binding:"required"`
	UpdatedBy      string            `json:"updated_by" binding:"required"`
	Reason         string            `json:"reason"`
	ErrorMessage   string            `json:"error_message,omitempty"`
}

type ErrorResponse struct {
	Code    string `json:"code"`
	Message string `json:"message"`
	Detail  string `json:"detail,omitempty"`
}

type SuccessResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

func NewUUID() string {
	return uuid.New().String()
}

func NewClientIdentity(clientID, clientName, clientType, createdBy string) *ClientIdentity {
	now := time.Now()
	return &ClientIdentity{
		ClientID:   clientID,
		ClientName: clientName,
		ClientType: clientType,
		CreatedAt:  now,
		UpdatedAt:  now,
		CreatedBy:  createdBy,
	}
}

func NewCapabilityDeclaration(req *CreateDeclarationRequest) *CapabilityDeclaration {
	return &CapabilityDeclaration{
		ID:           NewUUID(),
		ClientID:     req.ClientID,
		APIVersion:   req.APIVersion,
		Capabilities: req.Capabilities,
		FallbackOpts: req.FallbackOpts,
		DeclaredAt:   time.Now(),
		DeclaredBy:   req.DeclaredBy,
		ExpiresAt:    req.ExpiresAt,
	}
}

func NewNegotiationResult(declaration *CapabilityDeclaration, negotiatedBy string) *NegotiationResult {
	now := time.Now()
	return &NegotiationResult{
		ID:            NewUUID(),
		ClientID:      declaration.ClientID,
		DeclarationID: declaration.ID,
		APIVersion:    declaration.APIVersion,
		Status:        StatusPending,
		NegotiatedAt:  now,
		NegotiatedBy:  negotiatedBy,
		CreatedAt:     now,
		UpdatedAt:     now,
	}
}

func NewHitLog(resultID, clientID, hitSource string, cacheHit bool, responseTimeMs int64) *HitLog {
	return &HitLog{
		ID:             NewUUID(),
		ResultID:       resultID,
		ClientID:       clientID,
		HitTime:        time.Now(),
		HitSource:      hitSource,
		CacheHit:       cacheHit,
		ResponseTimeMs: responseTimeMs,
	}
}

func NewStatusTransition(resultID string, fromStatus, toStatus NegotiationStatus, transitionedBy, reason string) *StatusTransition {
	return &StatusTransition{
		ID:             NewUUID(),
		ResultID:       resultID,
		FromStatus:     fromStatus,
		ToStatus:       toStatus,
		TransitionedAt: time.Now(),
		TransitionedBy: transitionedBy,
		Reason:         reason,
	}
}
