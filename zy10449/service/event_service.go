package service

import (
	"webhook-migration/model"
	"webhook-migration/repository"
)

type RecordEventRequest struct {
	MigrationID        string `json:"migration_id"`
	EventType          string `json:"event_type"`
	EventID            string `json:"event_id"`
	PayloadHash        string `json:"payload_hash"`
	OldDelivered       bool   `json:"old_delivered"`
	OldResponseStatus  int    `json:"old_response_status"`
	OldResponseTime    int64  `json:"old_response_time_ms"`
	OldResponseBody    string `json:"old_response_body"`
	NewDelivered       bool   `json:"new_delivered"`
	NewResponseStatus  int    `json:"new_response_status"`
	NewResponseTime    int64  `json:"new_response_time_ms"`
	NewResponseBody    string `json:"new_response_body"`
	RawOldRequest      string `json:"raw_old_request"`
	RawNewRequest      string `json:"raw_new_request"`
}

type EventService struct {
	eventRepo *repository.EventRecordRepository
}

func NewEventService() *EventService {
	return &EventService{
		eventRepo: repository.NewEventRecordRepository(),
	}
}

func (s *EventService) RecordEvent(req *RecordEventRequest) (*model.EventRecord, error) {
	compareResult, compareDetail := s.compareResponses(req)

	event := &model.EventRecord{
		MigrationID:       req.MigrationID,
		EventType:         req.EventType,
		EventID:           req.EventID,
		PayloadHash:       req.PayloadHash,
		OldDelivered:      req.OldDelivered,
		OldResponseStatus: req.OldResponseStatus,
		OldResponseTime:   req.OldResponseTime,
		OldResponseBody:   req.OldResponseBody,
		NewDelivered:      req.NewDelivered,
		NewResponseStatus: req.NewResponseStatus,
		NewResponseTime:   req.NewResponseTime,
		NewResponseBody:   req.NewResponseBody,
		CompareResult:     compareResult,
		CompareDetail:     compareDetail,
		RawOldRequest:     req.RawOldRequest,
		RawNewRequest:     req.RawNewRequest,
	}

	if err := s.eventRepo.Create(event); err != nil {
		return nil, err
	}

	return event, nil
}

func (s *EventService) compareResponses(req *RecordEventRequest) (model.EventCompareResult, string) {
	if !req.OldDelivered || !req.NewDelivered {
		return model.CompareMissing, "旧地址或新地址未成功投递"
	}

	if req.OldResponseStatus != req.NewResponseStatus {
		return model.CompareMismatch, "HTTP状态码不一致"
	}

	if req.OldResponseBody != req.NewResponseBody {
		return model.CompareMismatch, "响应体内容不一致"
	}

	return model.CompareMatch, "完全匹配"
}

func (s *EventService) GetEvents(migrationID string, page, pageSize int) ([]model.EventRecord, int64, error) {
	return s.eventRepo.GetByMigrationID(migrationID, page, pageSize)
}

func (s *EventService) GetEvent(eventID string) (*model.EventRecord, error) {
	return s.eventRepo.GetByID(eventID)
}

func (s *EventService) BatchRecordEvents(events []RecordEventRequest) error {
	var records []model.EventRecord
	for _, req := range events {
		compareResult, compareDetail := s.compareResponses(&req)
		records = append(records, model.EventRecord{
			MigrationID:       req.MigrationID,
			EventType:         req.EventType,
			EventID:           req.EventID,
			PayloadHash:       req.PayloadHash,
			OldDelivered:      req.OldDelivered,
			OldResponseStatus: req.OldResponseStatus,
			OldResponseTime:   req.OldResponseTime,
			OldResponseBody:   req.OldResponseBody,
			NewDelivered:      req.NewDelivered,
			NewResponseStatus: req.NewResponseStatus,
			NewResponseTime:   req.NewResponseTime,
			NewResponseBody:   req.NewResponseBody,
			CompareResult:     compareResult,
			CompareDetail:     compareDetail,
			RawOldRequest:     req.RawOldRequest,
			RawNewRequest:     req.RawNewRequest,
		})
	}
	return s.eventRepo.BatchCreate(records)
}
