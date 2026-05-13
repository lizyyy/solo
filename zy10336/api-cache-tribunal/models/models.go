package models

import (
	"crypto/md5"
	"encoding/hex"
	"encoding/json"
	"time"
)

type CacheStrategy struct {
	ID           string        `json:"id"`
	Path         string        `json:"path"`
	Method       string        `json:"method"`
	TTL          time.Duration `json:"ttl"`
	ParamKeys    []string      `json:"param_keys"`
	Enabled      bool          `json:"enabled"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

type CacheRecord struct {
	ID           string                 `json:"id"`
	StrategyID   string                 `json:"strategy_id"`
	Path         string                 `json:"path"`
	Method       string                 `json:"method"`
	ParamHash    string                 `json:"param_hash"`
	Params       map[string]interface{} `json:"params"`
	Response     json.RawMessage        `json:"response"`
	Status       CacheStatus            `json:"status"`
	HitCount     int                    `json:"hit_count"`
	HitReason    string                 `json:"hit_reason"`
	CreatedAt    time.Time              `json:"created_at"`
	ExpiresAt    time.Time              `json:"expires_at"`
	LastHitAt    *time.Time             `json:"last_hit_at,omitempty"`
}

type CacheStatus string

const (
	StatusPending   CacheStatus = "pending"
	StatusActive    CacheStatus = "active"
	StatusInvalid   CacheStatus = "invalid"
	StatusExpired   CacheStatus = "expired"
	StatusBypassed  CacheStatus = "bypassed"
)

type InvalidationEvent struct {
	ID         string    `json:"id"`
	RecordID   string    `json:"record_id"`
	Reason     string    `json:"reason"`
	Operator   string    `json:"operator"`
	CreatedAt  time.Time `json:"created_at"`
}

type BypassRecord struct {
	ID         string                 `json:"id"`
	Path       string                 `json:"path"`
	Method     string                 `json:"method"`
	ParamHash  string                 `json:"params_hash"`
	Params     map[string]interface{} `json:"params"`
	Reason     string                 `json:"reason"`
	Operator   string                 `json:"operator"`
	CreatedAt  time.Time              `json:"created_at"`
	ExpiresAt  time.Time              `json:"expires_at"`
}

type AuditLog struct {
	ID         string                 `json:"id"`
	Action     string                 `json:"action"`
	Resource   string                 `json:"resource"`
	ResourceID string                 `json:"resource_id"`
	Before     map[string]interface{} `json:"before,omitempty"`
	After      map[string]interface{} `json:"after,omitempty"`
	Operator   string                 `json:"operator"`
	IP         string                 `json:"ip"`
	CreatedAt  time.Time              `json:"created_at"`
}

func (c *CacheRecord) CanTransitionTo(newStatus CacheStatus) bool {
	switch c.Status {
	case StatusPending:
		return newStatus == StatusActive || newStatus == StatusInvalid
	case StatusActive:
		return newStatus == StatusExpired || newStatus == StatusInvalid || newStatus == StatusBypassed
	case StatusInvalid:
		return false
	case StatusExpired:
		return newStatus == StatusActive
	case StatusBypassed:
		return newStatus == StatusActive
	default:
		return false
	}
}

func HashParams(params map[string]interface{}, keys []string) string {
	normalized := make(map[string]interface{})
	for _, k := range keys {
		if v, ok := params[k]; ok {
			normalized[k] = v
		}
	}
	data, _ := json.Marshal(normalized)
	h := md5.Sum(data)
	return hex.EncodeToString(h[:])
}

func GenerateID() string {
	h := md5.Sum([]byte(time.Now().String()))
	return hex.EncodeToString(h[:8])
}
