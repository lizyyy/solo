package service

import (
	"audit-log-retention/model"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestCreateApplication_NormalFlow(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "payment-gateway-logs",
		RetentionDays:   180,
		DefaultDays:     90,
		Department:      "Security",
		ComplianceBasis: "PCI DSS requirement",
		Applicant:       "john.doe@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)
	assert.NotNil(t, app)
	assert.Equal(t, "payment-gateway-logs", app.LogSource)
	assert.Equal(t, 180, app.RetentionDays)
	assert.Equal(t, model.StatusExceptionApplied, app.Status)
	assert.NotEmpty(t, app.ID)
}

func TestCreateApplication_DuplicateActive(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "audit-logs",
		RetentionDays:   365,
		DefaultDays:     90,
		Department:      "Compliance",
		ComplianceBasis: "SOX",
		Applicant:       "jane.smith@company.com",
	}

	app1, err := service.CreateApplication(req)
	assert.NoError(t, err)
	assert.NotNil(t, app1)

	app2, err := service.CreateApplication(req)
	assert.Error(t, err)
	assert.Nil(t, app2)
	assert.Contains(t, err.Error(), "duplicate application")
}

func TestCreateApplication_DuplicateAfterReject(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "system-logs",
		RetentionDays:   30,
		DefaultDays:     7,
		Department:      "IT",
		ComplianceBasis: "Troubleshooting",
		Applicant:       "admin@company.com",
	}

	app1, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Comment:  "Not required",
		Approved: false,
	}
	app1, err = service.ApproveApplication(app1.ID, approveReq)
	assert.NoError(t, err)
	assert.Equal(t, model.StatusDefaultRetention, app1.Status)

	app2, err := service.CreateApplication(req)
	assert.NoError(t, err)
	assert.NotNil(t, app2)
	assert.NotEqual(t, app1.ID, app2.ID)
}

func TestApproveApplication_Approve(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "user-activity-logs",
		RetentionDays:   365,
		DefaultDays:     90,
		Department:      "Legal",
		ComplianceBasis: "Legal hold",
		Applicant:       "legal@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance-officer@company.com",
		Comment:  "Approved per legal requirement",
		Approved: true,
	}

	app, err = service.ApproveApplication(app.ID, approveReq)
	assert.NoError(t, err)
	assert.Equal(t, model.StatusApproved, app.Status)
	assert.NotNil(t, app.ApprovedAt)
	assert.Len(t, app.ApprovalRecords, 1)
	assert.Equal(t, "compliance-officer@company.com", app.ApprovalRecords[0].Approver)
}

func TestApproveApplication_Reject(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "temp-logs",
		RetentionDays:   365,
		DefaultDays:     7,
		Department:      "Dev",
		ComplianceBasis: "Debugging",
		Applicant:       "dev@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Comment:  "No valid compliance basis",
		Approved: false,
	}

	app, err = service.ApproveApplication(app.ID, approveReq)
	assert.NoError(t, err)
	assert.Equal(t, model.StatusDefaultRetention, app.Status)
	assert.Len(t, app.ApprovalRecords, 1)
	assert.False(t, app.ApprovalRecords[0].Approved)
}

func TestApproveApplication_InvalidStatus(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "test-logs",
		RetentionDays:   30,
		DefaultDays:     7,
		Department:      "Test",
		ComplianceBasis: "Test",
		Applicant:       "test@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Comment:  "Approved",
		Approved: true,
	}

	app, err = service.ApproveApplication(app.ID, approveReq)
	assert.NoError(t, err)

	app, err = service.ApproveApplication(app.ID, approveReq)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "invalid status transition")
}

func TestCheckExpiration_NotExpired(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "active-logs",
		RetentionDays:   100,
		DefaultDays:     30,
		Department:      "IT",
		ComplianceBasis: "Security",
		Applicant:       "it@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Approved: true,
	}
	_, err = service.ApproveApplication(app.ID, approveReq)
	assert.NoError(t, err)

	result, err := service.CheckExpiration(app.ID)
	assert.NoError(t, err)
	assert.False(t, result.IsExpired)
	assert.False(t, result.NeedsArchive)
	assert.False(t, result.LongRetentionRisk)
}

func TestCheckExpiration_Expired(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "expiring-logs",
		RetentionDays:   1,
		DefaultDays:     7,
		Department:      "Test",
		ComplianceBasis: "Test",
		Applicant:       "test@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Approved: true,
	}
	_, err = service.ApproveApplication(app.ID, approveReq)
	assert.NoError(t, err)

	app.ExpiresAt = time.Now().AddDate(0, 0, -2)

	result, err := service.CheckExpiration(app.ID)
	assert.NoError(t, err)
	assert.True(t, result.IsExpired)
	assert.True(t, result.NeedsArchive)
	assert.False(t, result.AlreadyArchived)
}

func TestArchiveApplication_Success(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "archive-logs",
		RetentionDays:   1,
		DefaultDays:     7,
		Department:      "Ops",
		ComplianceBasis: "Archive",
		Applicant:       "ops@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Approved: true,
	}
	_, err = service.ApproveApplication(app.ID, approveReq)
	assert.NoError(t, err)

	archiveReq := model.ArchiveApplicationRequest{
		ArchiveLocation: "s3://audit-archive/2024/",
		ArchivedBy:      "archive-admin@company.com",
	}

	record, err := service.ArchiveApplication(app.ID, archiveReq)
	assert.NoError(t, err)
	assert.NotNil(t, record)
	assert.Equal(t, "s3://audit-archive/2024/", record.ArchiveLocation)
	assert.Contains(t, record.ExportedFile, "archive-logs_")

	app, _ = service.GetApplication(app.ID)
	assert.True(t, app.IsArchived)
	assert.Len(t, app.ArchiveRecords, 1)
}

func TestArchiveApplication_AlreadyArchived(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "double-archive",
		RetentionDays:   1,
		DefaultDays:     7,
		Department:      "Ops",
		ComplianceBasis: "Archive",
		Applicant:       "ops@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Approved: true,
	}
	_, err = service.ApproveApplication(app.ID, approveReq)
	assert.NoError(t, err)

	archiveReq := model.ArchiveApplicationRequest{
		ArchiveLocation: "s3://audit-archive/",
		ArchivedBy:      "admin@company.com",
	}

	_, err = service.ArchiveApplication(app.ID, archiveReq)
	assert.NoError(t, err)

	_, err = service.ArchiveApplication(app.ID, archiveReq)
	assert.Error(t, err)
	assert.Equal(t, ErrAlreadyArchived, err)
}

func TestRenewApplication_Success(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "renew-logs",
		RetentionDays:   30,
		DefaultDays:     7,
		Department:      "IT",
		ComplianceBasis: "Ongoing investigation",
		Applicant:       "sec@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Approved: true,
	}
	_, err = service.ApproveApplication(app.ID, approveReq)
	assert.NoError(t, err)

	originalExpiresAt := app.ExpiresAt

	app, err = service.RenewApplication(app.ID, 60, "compliance@company.com")
	assert.NoError(t, err)
	assert.Equal(t, 90, app.RetentionDays)
	assert.True(t, app.ExpiresAt.After(originalExpiresAt))
	assert.Len(t, app.ApprovalRecords, 2)
}

func TestGetLongRetentionRiskApplications(t *testing.T) {
	service := NewRetentionService()

	req := model.CreateApplicationRequest{
		LogSource:       "risky-logs",
		RetentionDays:   1,
		DefaultDays:     7,
		Department:      "Test",
		ComplianceBasis: "Test",
		Applicant:       "test@company.com",
	}

	app, err := service.CreateApplication(req)
	assert.NoError(t, err)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Approved: true,
	}
	_, err = service.ApproveApplication(app.ID, approveReq)
	assert.NoError(t, err)

	app.ExpiresAt = time.Now().AddDate(0, 0, -45)

	riskyApps := service.GetLongRetentionRiskApplications()
	assert.Len(t, riskyApps, 1)
	assert.Equal(t, app.ID, riskyApps[0].ID)
}

func TestGetApplication_NotFound(t *testing.T) {
	service := NewRetentionService()

	app, err := service.GetApplication("non-existent-id")
	assert.Error(t, err)
	assert.Nil(t, app)
	assert.Equal(t, ErrApplicationNotFound, err)
}

func TestListApplications_FilterByStatus(t *testing.T) {
	service := NewRetentionService()

	req1 := model.CreateApplicationRequest{
		LogSource:       "log1",
		RetentionDays:   30,
		DefaultDays:     7,
		Department:      "IT",
		ComplianceBasis: "Test",
		Applicant:       "test@company.com",
	}

	req2 := model.CreateApplicationRequest{
		LogSource:       "log2",
		RetentionDays:   30,
		DefaultDays:     7,
		Department:      "IT",
		ComplianceBasis: "Test",
		Applicant:       "test@company.com",
	}

	app1, _ := service.CreateApplication(req1)
	app2, _ := service.CreateApplication(req2)

	approveReq := model.ApproveApplicationRequest{
		Approver: "compliance@company.com",
		Approved: true,
	}
	_, _ = service.ApproveApplication(app1.ID, approveReq)

	applied := service.ListApplications(model.StatusExceptionApplied)
	assert.Len(t, applied, 1)
	assert.Equal(t, app2.ID, applied[0].ID)

	approved := service.ListApplications(model.StatusApproved)
	assert.Len(t, approved, 1)
	assert.Equal(t, app1.ID, approved[0].ID)
}
