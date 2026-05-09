package service

import (
	"context"
	"time"

	"device-borrow-system/internal/eventstore"
	"device-borrow-system/internal/models"
	"device-borrow-system/internal/repository"

	"github.com/google/uuid"
)

type AuditService struct {
	auditRepo  *repository.AuditRepository
	eventStore *eventstore.EventStore
}

func NewAuditService(auditRepo *repository.AuditRepository, es *eventstore.EventStore) *AuditService {
	return &AuditService{
		auditRepo:  auditRepo,
		eventStore: es,
	}
}

func (s *AuditService) ListAuditLogs(filters map[string]interface{}, page, pageSize int) ([]models.AuditLog, int64, error) {
	return s.auditRepo.FindAll(filters, page, pageSize)
}

func (s *AuditService) GetResourceHistory(resourceType string, resourceID uuid.UUID) ([]models.AuditLog, error) {
	return s.auditRepo.FindByResource(resourceType, resourceID)
}

func (s *AuditService) GetEventHistory(aggregateType string, aggregateID uuid.UUID, limit int) ([]models.Event, error) {
	return s.eventStore.GetEventHistory(context.Background(), aggregateType, aggregateID, limit)
}

func (s *AuditService) ReplayAggregate(aggregateType string, aggregateID uuid.UUID) (map[string]interface{}, error) {
	return s.eventStore.ReplayAggregate(context.Background(), aggregateType, aggregateID)
}

func (s *AuditService) ExportAggregateEvents(aggregateType string, aggregateID uuid.UUID) ([]byte, error) {
	return s.eventStore.ExportEvents(context.Background(), aggregateType, aggregateID)
}

func (s *AuditService) GetEventsByRequestID(requestID uuid.UUID) ([]models.Event, error) {
	return s.eventStore.GetEventsByRequestID(context.Background(), requestID)
}

type ExportService struct {
	borrowRepo *repository.BorrowRepository
	deviceRepo *repository.DeviceRepository
	userRepo   *repository.UserRepository
}

func NewExportService(borrowRepo *repository.BorrowRepository, deviceRepo *repository.DeviceRepository, userRepo *repository.UserRepository) *ExportService {
	return &ExportService{
		borrowRepo: borrowRepo,
		deviceRepo: deviceRepo,
		userRepo:   userRepo,
	}
}

func (s *ExportService) GenerateBorrowReport(startDate, endDate *time.Time, status string) (*BorrowReport, error) {
	filters := make(map[string]interface{})
	if status != "" {
		filters["status"] = status
	}

	records, _, err := s.borrowRepo.FindAll(filters, 1, 10000)
	if err != nil {
		return nil, err
	}

	var filteredRecords []models.BorrowRecord
	for _, record := range records {
		if startDate != nil && record.BorrowDate.Before(*startDate) {
			continue
		}
		if endDate != nil && record.BorrowDate.After(*endDate) {
			continue
		}
		filteredRecords = append(filteredRecords, record)
	}

	report := &BorrowReport{
		GeneratedAt: time.Now(),
		StartDate:   startDate,
		EndDate:     endDate,
		Records:     filteredRecords,
	}

	report.Statistics = s.calculateStatistics(filteredRecords)

	return report, nil
}

func (s *ExportService) calculateStatistics(records []models.BorrowRecord) ReportStatistics {
	stats := ReportStatistics{
		TotalRecords: len(records),
		ByStatus:     make(map[string]int),
	}

	for _, record := range records {
		stats.ByStatus[record.Status]++

		if record.ActualReturnDate != nil && record.ExpectedReturnDate != nil {
			if record.ActualReturnDate.After(*record.ExpectedReturnDate) {
				stats.OverdueCount++
			}
		}
	}

	return stats
}

type BorrowReport struct {
	GeneratedAt time.Time              `json:"generated_at"`
	StartDate   *time.Time             `json:"start_date,omitempty"`
	EndDate     *time.Time             `json:"end_date,omitempty"`
	Records     []models.BorrowRecord  `json:"records"`
	Statistics  ReportStatistics       `json:"statistics"`
}

type ReportStatistics struct {
	TotalRecords int            `json:"total_records"`
	Borrowed     int            `json:"borrowed"`
	Returned     int            `json:"returned"`
	OverdueCount int            `json:"overdue_count"`
	ByStatus     map[string]int `json:"by_status"`
}
