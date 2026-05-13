package database

import (
	"log"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

type RevocationStatus string

const (
	StatusRegistered   RevocationStatus = "REGISTERED"
	StatusDistributed  RevocationStatus = "DISTRIBUTED"
	StatusCacheConfirm RevocationStatus = "CACHE_CONFIRMED"
	StatusActive       RevocationStatus = "ACTIVE"
)

type RevocationReason string

const (
	ReasonKeyCompromise   RevocationReason = "KEY_COMPROMISE"
	ReasonCACompromise    RevocationReason = "CA_COMPROMISE"
	ReasonAffiliationChan RevocationReason = "AFFILIATION_CHANGED"
	ReasonSuperseded      RevocationReason = "SUPERSEDED"
	ReasonCessation       RevocationReason = "CESSATION_OF_OPERATION"
	ReasonCertificateHold RevocationReason = "CERTIFICATE_HOLD"
	ReasonRemoveFromCRL   RevocationReason = "REMOVE_FROM_CRL"
	ReasonPrivilegeWithdr RevocationReason = "PRIVILEGE_WITHDRAWN"
	ReasonAACompromise    RevocationReason = "AA_COMPROMISE"
)

type CertificateRevocation struct {
	ID                 uint             `gorm:"primaryKey"`
	SerialNumber       string           `gorm:"uniqueIndex;size:128;not null"`
	Reason             RevocationReason `gorm:"size:32;not null"`
	Status             RevocationStatus `gorm:"size:20;not null;default:'REGISTERED'"`
	DistributionVersion int64           `gorm:"default:0"`
	ServiceConfirmed   bool             `gorm:"default:false"`
	CacheStatus        string           `gorm:"size:20;default:'PENDING'"`
	RevocationTime     int64            `gorm:"not null"`
	EffectiveTime      int64            `gorm:"not null"`
	RequestID          string           `gorm:"uniqueIndex;size:64"`
	CreatedAt          int64            `gorm:"autoCreateTime"`
	UpdatedAt          int64            `gorm:"autoUpdateTime"`
}

type DistributionVersion struct {
	ID          uint   `gorm:"primaryKey"`
	Version     int64  `gorm:"uniqueIndex;not null"`
	PublishedAt int64  `gorm:"not null"`
	Status      string `gorm:"size:20;default:'PUBLISHED'"`
	ItemCount   int    `gorm:"default:0"`
}

type QueryLog struct {
	ID           uint   `gorm:"primaryKey"`
	SerialNumber string `gorm:"index;size:128"`
	QueryTime    int64  `gorm:"autoCreateTime"`
	ClientIP     string `gorm:"size:45"`
	Result       string `gorm:"size:20"`
	UserAgent    string `gorm:"size:256"`
}

type StatusTransitionLog struct {
	ID               uint             `gorm:"primaryKey"`
	SerialNumber     string           `gorm:"index;size:128"`
	FromStatus       RevocationStatus `gorm:"size:20"`
	ToStatus         RevocationStatus `gorm:"size:20"`
	TransitionTime   int64            `gorm:"autoCreateTime"`
	Operator         string           `gorm:"size:64"`
	DistributionVersion int64
}

func Init(dbPath string) *gorm.DB {
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("数据库连接失败: %v", err)
	}

	err = db.AutoMigrate(
		&CertificateRevocation{},
		&DistributionVersion{},
		&QueryLog{},
		&StatusTransitionLog{},
	)
	if err != nil {
		log.Fatalf("数据库迁移失败: %v", err)
	}

	log.Println("数据库初始化成功")
	return db
}
