package model

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

type InstanceScopeType string

const (
	ScopeAll      InstanceScopeType = "all"
	ScopeGray     InstanceScopeType = "gray"
	ScopeSpecific InstanceScopeType = "specific"
	ScopeOffline  InstanceScopeType = "offline"
)

type RollbackStatus string

const (
	RollbackStatusPending   RollbackStatus = "pending"
	RollbackStatusConfirmed RollbackStatus = "confirmed"
	RollbackStatusExecuted  RollbackStatus = "executed"
	RollbackStatusFailed    RollbackStatus = "failed"
)

type RollbackConfirmation struct {
	ID                string            `gorm:"primaryKey;type:varchar(36)" json:"id"`
	AppName           string            `gorm:"type:varchar(100);not null;index" json:"app_name"`
	ConfigKey         string            `gorm:"type:varchar(200);not null;index" json:"config_key"`
	TargetVersion     int64             `gorm:"not null" json:"target_version"`
	SourceVersion     int64             `gorm:"not null" json:"source_version"`
	Confirmer         string            `gorm:"type:varchar(100);not null" json:"confirmer"`
	InstanceScopeType InstanceScopeType `gorm:"type:varchar(20);not null" json:"instance_scope_type"`
	InstanceIDs       string            `gorm:"type:text" json:"instance_ids"`
	GrayGroupID       string            `gorm:"type:varchar(36)" json:"gray_group_id"`
	Status            RollbackStatus    `gorm:"type:varchar(20);not null;default:pending" json:"status"`
	Remark            string            `gorm:"type:text" json:"remark"`
	CreatedAt         time.Time         `json:"created_at"`
	UpdatedAt         time.Time         `json:"updated_at"`
	ConfirmedAt       *time.Time        `json:"confirmed_at"`
	ExecutedAt        *time.Time        `json:"executed_at"`
}

func (rc *RollbackConfirmation) BeforeCreate(tx *gorm.DB) error {
	if rc.ID == "" {
		rc.ID = uuid.NewString()
	}
	return nil
}

type ConfigRelease struct {
	ID          string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	AppName     string    `gorm:"type:varchar(100);not null;index" json:"app_name"`
	ConfigKey   string    `gorm:"type:varchar(200);not null;index" json:"config_key"`
	Version     int64     `gorm:"not null;index" json:"version"`
	Content     string    `gorm:"type:text;not null" json:"content"`
	GrayGroupID string    `gorm:"type:varchar(36)" json:"gray_group_id"`
	IsGray      bool      `gorm:"default:false" json:"is_gray"`
	Operator    string    `gorm:"type:varchar(100);not null" json:"operator"`
	Status      string    `gorm:"type:varchar(20);not null" json:"status"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (cr *ConfigRelease) BeforeCreate(tx *gorm.DB) error {
	if cr.ID == "" {
		cr.ID = uuid.NewString()
	}
	return nil
}

type InstancePullLog struct {
	ID           string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	AppName      string    `gorm:"type:varchar(100);not null;index" json:"app_name"`
	ConfigKey    string    `gorm:"type:varchar(200);not null;index" json:"config_key"`
	InstanceID   string    `gorm:"type:varchar(100);not null;index" json:"instance_id"`
	PulledVersion int64    `gorm:"not null" json:"pulled_version"`
	ReleaseID    string    `gorm:"type:varchar(36);index" json:"release_id"`
	RollbackID   string    `gorm:"type:varchar(36);index" json:"rollback_id"`
	IP           string    `gorm:"type:varchar(50)" json:"ip"`
	Hostname     string    `gorm:"type:varchar(100)" json:"hostname"`
	IsGray       bool      `gorm:"default:false" json:"is_gray"`
	IsOffline    bool      `gorm:"default:false" json:"is_offline"`
	PulledAt     time.Time `gorm:"index" json:"pulled_at"`
	CreatedAt    time.Time `json:"created_at"`
}

func (ipl *InstancePullLog) BeforeCreate(tx *gorm.DB) error {
	if ipl.ID == "" {
		ipl.ID = uuid.NewString()
	}
	return nil
}

type GrayGroup struct {
	ID          string    `gorm:"primaryKey;type:varchar(36)" json:"id"`
	Name        string    `gorm:"type:varchar(100);not null" json:"name"`
	AppName     string    `gorm:"type:varchar(100);not null;index" json:"app_name"`
	InstanceIDs string    `gorm:"type:text;not null" json:"instance_ids"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

func (gg *GrayGroup) BeforeCreate(tx *gorm.DB) error {
	if gg.ID == "" {
		gg.ID = uuid.NewString()
	}
	return nil
}
