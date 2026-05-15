package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type FileObject struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	Path      string    `gorm:"not null" json:"path"`
	Size      int64     `json:"size"`
	MimeType  string    `json:"mime_type"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type Issuer struct {
	ID        string    `gorm:"primaryKey" json:"id"`
	Name      string    `gorm:"not null" json:"name"`
	Email     string    `gorm:"uniqueIndex" json:"email"`
	Department string   `json:"department"`
	CreatedAt time.Time `json:"created_at"`
	IsActive  bool      `gorm:"default:true" json:"is_active"`
}

type PresignedLink struct {
	ID            string    `gorm:"primaryKey" json:"id"`
	IdempotencyKey string   `gorm:"uniqueIndex" json:"idempotency_key"`
	FileID        string    `gorm:"not null;index" json:"file_id"`
	IssuerID      string    `gorm:"not null;index" json:"issuer_id"`
	Token         string    `gorm:"uniqueIndex;not null" json:"token"`
	ExpiresAt     time.Time `gorm:"not null;index" json:"expires_at"`
	MaxAccess     int       `gorm:"not null" json:"max_access"`
	AccessCount   int       `gorm:"default:0" json:"access_count"`
	Status        string    `gorm:"index;default:active" json:"status"`
	RevokeReason  string    `json:"revoke_reason"`
	RevokedAt     *time.Time `json:"revoked_at"`
	RevokedBy     string    `json:"revoked_by"`
	CreatedAt     time.Time `json:"created_at"`
	UpdatedAt     time.Time `json:"updated_at"`

	File   FileObject `gorm:"foreignKey:FileID" json:"file,omitempty"`
	Issuer Issuer     `gorm:"foreignKey:IssuerID" json:"issuer,omitempty"`
}

type AccessLog struct {
	ID          string    `gorm:"primaryKey" json:"id"`
	LinkID      string    `gorm:"not null;index" json:"link_id"`
	LinkToken   string    `gorm:"index" json:"link_token"`
	AccessTime  time.Time `gorm:"index" json:"access_time"`
	ClientIP    string    `json:"client_ip"`
	UserAgent   string    `json:"user_agent"`
	Success     bool      `json:"success"`
	FailReason  string    `json:"fail_reason"`

	Link PresignedLink `gorm:"foreignKey:LinkID" json:"link,omitempty"`
}

const (
	LinkStatusActive   = "active"
	LinkStatusRevoked  = "revoked"
	LinkStatusExpired  = "expired"
	LinkStatusExhausted = "exhausted"
)

func (f *FileObject) BeforeCreate(tx *gorm.DB) error {
	if f.ID == "" {
		f.ID = uuid.NewString()
	}
	return nil
}

func (i *Issuer) BeforeCreate(tx *gorm.DB) error {
	if i.ID == "" {
		i.ID = uuid.NewString()
	}
	return nil
}

func (p *PresignedLink) BeforeCreate(tx *gorm.DB) error {
	if p.ID == "" {
		p.ID = uuid.NewString()
	}
	if p.Token == "" {
		p.Token = uuid.NewString()
	}
	return nil
}

func (a *AccessLog) BeforeCreate(tx *gorm.DB) error {
	if a.ID == "" {
		a.ID = uuid.NewString()
	}
	return nil
}
