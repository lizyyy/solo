package service

import (
	"certificate-renewal-api/internal/config"
	"certificate-renewal-api/internal/models"
	"certificate-renewal-api/internal/repository"
	"certificate-renewal-api/internal/util"
	"time"
)

type ReportService struct {
	store  repository.Store
	config *config.Config
}

func NewReportService(store repository.Store, config *config.Config) *ReportService {
	return &ReportService{store: store, config: config}
}

func (s *ReportService) GenerateExpiryReport() (*models.ExpiryReport, error) {
	allCerts := s.store.ListCertificates()
	now := util.Now()
	periodStart := now.Add(-30 * 24 * time.Hour)
	periodEnd := now.Add(90 * 24 * time.Hour)
	
	report := &models.ExpiryReport{
		ReportID:    util.GenerateID("report"),
		GeneratedAt: now,
		PeriodStart: periodStart,
		PeriodEnd:   periodEnd,
	}
	
	stats := &models.ReportStatistics{
		TotalCerts: len(allCerts),
	}
	
	for _, cert := range allCerts {
		daysLeft := util.CalculateDaysLeft(cert.ValidTo)
		summary := models.CertificateSummary{
			ID:         cert.ID,
			CommonName: cert.CommonName,
			ValidTo:    cert.ValidTo,
			DaysLeft:   daysLeft,
			Status:     cert.Status,
			AutoRenew:  cert.AutoRenew,
		}
		
		switch {
		case cert.Status == models.CertStatusActive:
			stats.ActiveCerts++
			report.ActiveCerts = append(report.ActiveCerts, summary)
			
			if util.IsExpiring(cert.ValidTo, 30*24*time.Hour) {
				stats.ExpiringCerts++
				report.ExpiringCerts = append(report.ExpiringCerts, summary)
			}
			
		case cert.Status == models.CertStatusExpired:
			stats.ExpiredCerts++
			report.ExpiredCerts = append(report.ExpiredCerts, summary)
			
		case cert.Status == models.CertStatusRenewing:
			stats.RenewingCerts++
			
		case cert.Status == models.CertStatusRenewed:
			stats.RenewedCerts++
		}
	}
	
	allTasks := s.store.ListTasks()
	failedTasks := 0
	completedTasks := 0
	
	for _, task := range allTasks {
		if task.Status == models.TaskStatusFailed || 
		   task.Status == models.TaskStatusTimeout || 
		   task.Status == models.TaskStatusRolledBack {
			failedTasks++
		}
		if task.Status == models.TaskStatusCompleted {
			completedTasks++
		}
		if task.Status == models.TaskStatusConflict {
			stats.PendingApproval++
		}
	}
	
	stats.FailedRenewals = failedTasks
	
	totalTasks := completedTasks + failedTasks
	if totalTasks > 0 {
		stats.SuccessRate = float64(completedTasks) / float64(totalTasks) * 100
	}
	
	report.Statistics = *stats
	
	if err := s.store.SaveReport(report); err != nil {
		return nil, err
	}
	
	return report, nil
}

func (s *ReportService) ListReports() []*models.ExpiryReport {
	return s.store.ListReports()
}

func (s *ReportService) GetReport(id string) (*models.ExpiryReport, error) {
	return s.store.GetReport(id)
}
