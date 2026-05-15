package service

import (
	"fmt"

	"queue-backoff-api/internal/model"
	"queue-backoff-api/internal/storage"
	"queue-backoff-api/pkg/utils"
)

type ReportService struct {
	store storage.Storage
}

func NewReportService(store storage.Storage) *ReportService {
	return &ReportService{store: store}
}

func (s *ReportService) QueryHistory(req *model.QueryHistoryRequest) (*model.QueryHistoryResponse, error) {
	limit := req.Limit
	if limit <= 0 {
		limit = 100
	}

	events, total, err := s.store.QueryTimeline(
		req.TopicID,
		req.EventType,
		req.StartTime,
		req.EndTime,
		limit,
	)
	if err != nil {
		return nil, err
	}

	return &model.QueryHistoryResponse{
		Events: events,
		Total:  total,
	}, nil
}

func (s *ReportService) ExportReport(req *model.ExportReportRequest) (*model.ExportReportResponse, error) {
	topic, err := s.store.GetTopic(req.TopicID)
	if err != nil {
		return nil, err
	}

	events, _, err := s.store.QueryTimeline(
		req.TopicID,
		"",
		req.StartTime,
		req.EndTime,
		1000,
	)
	if err != nil {
		return nil, err
	}

	var maxBacklog, avgBacklog, totalDelayed int64
	var statusChanges int

	for i, e := range events {
		if e.EventType == "STATUS_CHANGED" || e.EventType == "STATUS_ADVANCED" {
			statusChanges++
		}
		if e.EventType == "MESSAGE_DELAYED" {
			totalDelayed++
		}
		if i%10 == 0 {
			avgBacklog += topic.CurrentSize
		}
		if topic.CurrentSize > maxBacklog {
			maxBacklog = topic.CurrentSize
		}
	}

	if len(events) > 0 {
		avgBacklog = avgBacklog / int64(len(events)/10+1)
	}

	period := "ALL"
	if !req.StartTime.IsZero() && !req.EndTime.IsZero() {
		period = fmt.Sprintf("%s to %s", req.StartTime.Format("2006-01-02"), req.EndTime.Format("2006-01-02"))
	}

	summary := &model.ReportSummary{
		TopicID:        topic.ID,
		TopicName:      topic.Name,
		ReportPeriod:   period,
		MaxBacklog:     maxBacklog,
		AvgBacklog:     avgBacklog,
		TotalDelayed:   totalDelayed,
		StatusChanges:  statusChanges,
		FinalStatus:    topic.Status,
	}

	report := &model.ThrottleReport{
		ID:             utils.GenerateID(),
		TopicID:        topic.ID,
		StartTime:      req.StartTime,
		EndTime:        req.EndTime,
		PeakBacklog:    maxBacklog,
		CurrentBacklog: topic.CurrentSize,
		MessagesDelayed: totalDelayed,
		Status:         topic.Status,
		Timeline:       events,
	}
	s.store.CreateReport(report)

	return &model.ExportReportResponse{
		ReportID:    report.ID,
		GeneratedAt: utils.GetCurrentTime(),
		Summary:     summary,
		Timeline:    events,
	}, nil
}
