package model

import (
	"time"

	"github.com/google/uuid"
)

type RetentionStatus string

const (
	StatusDefaultRetention RetentionStatus = "DEFAULT_RETENTION"
	StatusExceptionApplied RetentionStatus = "EXCEPTION_APPLIED"
	StatusApproved         RetentionStatus = "APPROVED"
	StatusExpired          RetentionStatus = "EXPIRED"
)

type RetentionApplication struct {
	ID               string          `json:"id"`
	LogSource        string          `json:"log_source"`
	RetentionDays    int             `json:"retention_days"`
	DefaultDays      int             `json:"default_days"`
	Department       string          `json:"department"`
	ComplianceBasis  string          `json:"compliance_basis"`
	Applicant        string          `json:"applicant"`
	Status           RetentionStatus `json:"status"`
	AppliedAt        time.Time       `json:"applied_at"`
	ApprovedAt       *time.Time      `json:"approved_at,omitempty"`
	ExpiresAt        time.Time       `json:"expires_at"`
	ApprovalRecords  []ApprovalRecord `json:"approval_records"`
	ArchiveRecords   []ArchiveRecord  `json:"archive_records"`
	IsArchived       bool            `json:"is_archived"`
	LastCheckedAt    *time.Time      `json:"last_checked_at,omitempty"`
}

type ApprovalRecord struct {
	ID           string    `json:"id"`
	ApplicationID string   `json:"application_id"`
	Approver     string    `json:"approver"`
	Comment      string    `json:"comment"`
	Approved     bool      `json:"approved"`
	ApprovedAt   time.Time `json:"approved_at"`
}

type ArchiveRecord struct {
	ID              string    `json:"id"`
	ApplicationID   string    `json:"application_id"`
	ArchiveLocation string    `json:"archive_location"`
	ArchivedAt      time.Time `json:"archived_at"`
	ArchivedBy      string    `json:"archived_by"`
	ExportedFile    string    `json:"exported_file"`
}

type CreateApplicationRequest struct {
	LogSource       string `json:"log_source" binding:"required"`
	RetentionDays   int    `json:"retention_days" binding:"required,min=1"`
	DefaultDays     int    `json:"default_days" binding:"required,min=1"`
	Department      string `json:"department" binding:"required"`
	ComplianceBasis string `json:"compliance_basis" binding:"required"`
	Applicant       string `json:"applicant" binding:"required"`
}

type ApproveApplicationRequest struct {
	Approver string `json:"approver" binding:"required"`
	Comment  string `json:"comment"`
	Approved bool   `json:"approved"`
}

type ArchiveApplicationRequest struct {
	ArchiveLocation string `json:"archive_location" binding:"required"`
	ArchivedBy      string `json:"archived_by" binding:"required"`
}

type ExpirationCheckResult struct {
	ApplicationID     string `json:"application_id"`
	LogSource         string `json:"log_source"`
	IsExpired         bool   `json:"is_expired"`
	DaysUntilExpiry   int    `json:"days_until_expiry"`
	NeedsArchive      bool   `json:"needs_archive"`
	AlreadyArchived   bool   `json:"already_archived"`
	LongRetentionRisk bool   `json:"long_retention_risk"`
}

func NewRetentionApplication(req CreateApplicationRequest) *RetentionApplication {
	now := time.Now()
	expiresAt := now.AddDate(0, 0, req.RetentionDays)
	
	return &RetentionApplication{
		ID:              uuid.New().String(),
		LogSource:       req.LogSource,
		RetentionDays:   req.RetentionDays,
		DefaultDays:     req.DefaultDays,
		Department:      req.Department,
		ComplianceBasis: req.ComplianceBasis,
		Applicant:       req.Applicant,
		Status:          StatusExceptionApplied,
		AppliedAt:       now,
		ExpiresAt:       expiresAt,
		ApprovalRecords: []ApprovalRecord{},
		ArchiveRecords:  []ArchiveRecord{},
		IsArchived:      false,
	}
}

func (a *RetentionApplication) Approve(approver, comment string) {
	now := time.Now()
	a.Status = StatusApproved
	a.ApprovedAt = &now
	a.ApprovalRecords = append(a.ApprovalRecords, ApprovalRecord{
		ID:           uuid.New().String(),
		ApplicationID: a.ID,
		Approver:     approver,
		Comment:      comment,
		Approved:     true,
		ApprovedAt:   now,
	})
}

func (a *RetentionApplication) Reject(approver, comment string) {
	now := time.Now()
	a.Status = StatusDefaultRetention
	a.ApprovalRecords = append(a.ApprovalRecords, ApprovalRecord{
		ID:           uuid.New().String(),
		ApplicationID: a.ID,
		Approver:     approver,
		Comment:      comment,
		Approved:     false,
		ApprovedAt:   now,
	})
}

func (a *RetentionApplication) CheckExpiration() ExpirationCheckResult {
	now := time.Now()
	a.LastCheckedAt = &now
	
	daysUntilExpiry := int(time.Until(a.ExpiresAt).Hours() / 24)
	isExpired := daysUntilExpiry <= 0
	
	if isExpired && a.Status == StatusApproved {
		a.Status = StatusExpired
	}
	
	daysOverRetention := 0
	if isExpired && !a.IsArchived {
		daysOverRetention = -daysUntilExpiry
	}
	
	return ExpirationCheckResult{
		ApplicationID:     a.ID,
		LogSource:         a.LogSource,
		IsExpired:         isExpired,
		DaysUntilExpiry:   daysUntilExpiry,
		NeedsArchive:      isExpired && !a.IsArchived,
		AlreadyArchived:   a.IsArchived,
		LongRetentionRisk: daysOverRetention > 30,
	}
}

func (a *RetentionApplication) Archive(location, archivedBy string) *ArchiveRecord {
	now := time.Now()
	archiveRecord := ArchiveRecord{
		ID:              uuid.New().String(),
		ApplicationID:   a.ID,
		ArchiveLocation: location,
		ArchivedAt:      now,
		ArchivedBy:      archivedBy,
		ExportedFile:    a.LogSource + "_" + now.Format("20060102") + ".tar.gz",
	}
	
	a.ArchiveRecords = append(a.ArchiveRecords, archiveRecord)
	a.IsArchived = true
	
	return &archiveRecord
}
