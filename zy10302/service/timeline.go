package service

import (
	"lease-api/model"
	"lease-api/repository"
	"time"
)

type TimelineService struct {
	repo *repository.Repository
}

func NewTimelineService(repo *repository.Repository) *TimelineService {
	return &TimelineService{repo: repo}
}

func (s *TimelineService) RecordEvent(taskID, leaseID, eventType, holderID, message, details string) error {
	event := &model.TimelineEvent{
		ID:        generateID(),
		TaskID:    taskID,
		LeaseID:   leaseID,
		EventType: eventType,
		HolderID:  holderID,
		Message:   message,
		Details:   details,
		CreatedAt: time.Now().UTC(),
	}
	return s.repo.CreateTimelineEvent(event)
}

func (s *TimelineService) GetTaskTimeline(taskID string) ([]model.TimelineEvent, error) {
	return s.repo.GetTaskTimeline(taskID)
}

func (s *TimelineService) GetRecentEvents(limit int) ([]model.TimelineEvent, error) {
	return s.repo.GetRecentTimelineEvents(limit)
}

func (s *TimelineService) GenerateDiagnosticsReport() (*model.DiagnosticsReport, error) {
	total, err := s.repo.CountAllTasks()
	if err != nil {
		return nil, err
	}
	pending, err := s.repo.CountTasksByStatus(model.TaskStatusPending)
	if err != nil {
		return nil, err
	}
	running, err := s.repo.CountTasksByStatus(model.TaskStatusRunning)
	if err != nil {
		return nil, err
	}
	completed, err := s.repo.CountTasksByStatus(model.TaskStatusCompleted)
	if err != nil {
		return nil, err
	}
	failed, err := s.repo.CountTasksByStatus(model.TaskStatusFailed)
	if err != nil {
		return nil, err
	}
	activeLeases, err := s.repo.CountActiveLeases()
	if err != nil {
		return nil, err
	}
	recentEvents, err := s.GetRecentEvents(50)
	if err != nil {
		return nil, err
	}

	return &model.DiagnosticsReport{
		TotalTasks:     total,
		PendingTasks:   pending,
		RunningTasks:   running,
		CompletedTasks: completed,
		FailedTasks:    failed,
		ActiveLeases:   activeLeases,
		RecentEvents:   recentEvents,
		GeneratedAt:    time.Now().UTC(),
	}, nil
}
