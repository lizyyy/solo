package model

import (
	"crypto/sha256"
	"encoding/hex"
	"time"
)

type CallbackParty struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	AppID     string    `json:"app_id"`
	Secret    string    `json:"-"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
	IsActive  bool      `json:"is_active"`
}

type SourceAddress struct {
	ID          string    `json:"id"`
	PartyID     string    `json:"party_id"`
	AddressType string    `json:"address_type"`
	Value       string    `json:"value"`
	CreatedAt   time.Time `json:"created_at"`
	IsEnabled   bool      `json:"is_enabled"`
}

type RuleStatus string

const (
	RuleStatusDraft    RuleStatus = "draft"
	RuleStatusTesting  RuleStatus = "testing"
	RuleStatusActive   RuleStatus = "active"
	RuleStatusInactive RuleStatus = "inactive"
	RuleStatusRollback RuleStatus = "rollback"
)

type WhitelistRule struct {
	ID           string     `json:"id"`
	PartyID      string     `json:"party_id"`
	Version      int        `json:"version"`
	Name         string     `json:"name"`
	Description  string     `json:"description"`
	SourceRules  []string   `json:"source_rules"`
	PathRules    []string   `json:"path_rules"`
	MethodRules  []string   `json:"method_rules"`
	HeaderRules  []string   `json:"header_rules"`
	Status       RuleStatus `json:"status"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
	CreatedBy    string     `json:"created_by"`
	IdempotencyKey string   `json:"-"`
}

type VerificationRequest struct {
	ID             string    `json:"id"`
	RuleID         string    `json:"rule_id"`
	RuleVersion    int       `json:"rule_version"`
	PartyID        string    `json:"party_id"`
	SourceIP       string    `json:"source_ip"`
	RequestPath    string    `json:"request_path"`
	RequestMethod  string    `json:"request_method"`
	Headers        map[string]string `json:"headers"`
	IsDryRun       bool      `json:"is_dry_run"`
	IsApproved     bool      `json:"is_approved"`
	VerifiedAt     time.Time `json:"verified_at"`
	IdempotencyKey string    `json:"-"`
}

type RejectionRecord struct {
	ID             string    `json:"id"`
	RequestID      string    `json:"request_id"`
	RuleID         string    `json:"rule_id"`
	PartyID        string    `json:"party_id"`
	ReasonCode     string    `json:"reason_code"`
	Reason         string    `json:"reason"`
	SourceIP       string    `json:"source_ip"`
	RequestPath    string    `json:"request_path"`
	RejectedAt     time.Time `json:"rejected_at"`
}

type RuleVersion struct {
	ID          string     `json:"id"`
	RuleID      string     `json:"rule_id"`
	Version     int        `json:"version"`
	PreviousID  string     `json:"previous_id,omitempty"`
	ChangeLog   string     `json:"change_log"`
	Status      RuleStatus `json:"status"`
	CreatedAt   time.Time  `json:"created_at"`
	CreatedBy   string     `json:"created_by"`
}

type ApiResponse struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

func GenerateIdempotencyKey(fields ...string) string {
	h := sha256.New()
	for _, f := range fields {
		h.Write([]byte(f))
	}
	return hex.EncodeToString(h.Sum(nil))
}
