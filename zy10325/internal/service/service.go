package service

import (
	"batch-notification-dedup/internal/model"
	"batch-notification-dedup/internal/repository"
	"batch-notification-dedup/pkg/utils"
	"errors"
	"fmt"
	"time"
)

type DedupService struct {
	repo *repository.Repository
}

func NewDedupService(repo *repository.Repository) *DedupService {
	return &DedupService{repo: repo}
}

type CreateRequest struct {
	RequestID   string                `json:"request_id"`
	Scene       string                `json:"scene" binding:"required"`
	User        model.UserIdentifier  `json:"user" binding:"required"`
	Content     string                `json:"content"`
	DedupWindow int64                 `json:"dedup_window"`
	Credential  string                `json:"credential,omitempty"`
}

type CreateResponse struct {
	RequestID   string                  `json:"request_id"`
	Allowed     bool                    `json:"allowed"`
	Status      model.NotificationStatus `json:"status"`
	SkipReason  model.SkipReason        `json:"skip_reason,omitempty"`
	Credential  string                  `json:"credential,omitempty"`
	Message     string                  `json:"message"`
}

func (s *DedupService) CreateNotification(req *CreateRequest) (*CreateResponse, error) {
	if req.RequestID == "" {
		req.RequestID = utils.GenerateUUID()
	}

	existing, err := s.repo.GetNotificationRequestByRequestID(req.RequestID)
	if err != nil {
		return nil, fmt.Errorf("check existing failed: %w", err)
	}
	if existing != nil {
		return &CreateResponse{
			RequestID:  existing.RequestID,
			Allowed:    existing.Status == model.StatusAllowed,
			Status:     existing.Status,
			SkipReason: existing.SkipReason,
			Message:    "request already processed",
		}, nil
	}

	userHash := req.User.Hash()

	dedupWindow := req.DedupWindow
	if dedupWindow <= 0 {
		sceneConfig, _ := s.repo.GetBusinessScene(req.Scene)
		if sceneConfig != nil {
			dedupWindow = sceneConfig.DefaultWindow
		}
		if dedupWindow <= 0 {
			dedupWindow = 300
		}
	}

	now := time.Now()
	duplicate, err := s.repo.FindDuplicateInWindow(req.Scene, userHash, dedupWindow, now)
	if err != nil {
		return nil, fmt.Errorf("check duplicate failed: %w", err)
	}

	notification := &model.NotificationRequest{
		RequestID:     req.RequestID,
		Scene:         req.Scene,
		UserIdentifier: req.User,
		UserHash:      userHash,
		Content:       req.Content,
		DedupWindow:   dedupWindow,
		Credential:    req.Credential,
		CreatedAt:     now,
		UpdatedAt:     now,
	}

	if duplicate != nil {
		notification.Status = model.StatusSkipped
		notification.SkipReason = model.ReasonDuplicateInWindow

		if err := s.repo.CreateNotificationRequest(notification); err != nil {
			return nil, fmt.Errorf("create notification failed: %w", err)
		}

		skipRecord := &model.SkipRecord{
			RequestID:     req.RequestID,
			Scene:         req.Scene,
			UserHash:      userHash,
			SkipReason:    model.ReasonDuplicateInWindow,
			OriginalReqID: duplicate.RequestID,
			WindowStart:   now.Add(-time.Duration(dedupWindow) * time.Second),
			WindowEnd:     now,
			CreatedAt:     now,
		}
		if err := s.repo.CreateSkipRecord(skipRecord); err != nil {
			return nil, fmt.Errorf("create skip record failed: %w", err)
		}

		return &CreateResponse{
			RequestID:  req.RequestID,
			Allowed:    false,
			Status:     model.StatusSkipped,
			SkipReason: model.ReasonDuplicateInWindow,
			Message:    fmt.Sprintf("duplicate request found in window: original=%s", duplicate.RequestID),
		}, nil
	}

	if req.Credential != "" {
		cred, err := s.repo.GetSendCredential(req.Credential)
		if err != nil {
			return nil, fmt.Errorf("check credential failed: %w", err)
		}
		if cred == nil || cred.Used || cred.ExpiresAt.Before(now) || cred.Scene != req.Scene || cred.UserHash != userHash {
			notification.Status = model.StatusSkipped
			notification.SkipReason = model.ReasonInvalidCredential

			if err := s.repo.CreateNotificationRequest(notification); err != nil {
				return nil, fmt.Errorf("create notification failed: %w", err)
			}

			skipRecord := &model.SkipRecord{
				RequestID:   req.RequestID,
				Scene:       req.Scene,
				UserHash:    userHash,
				SkipReason:  model.ReasonInvalidCredential,
				WindowStart: now,
				WindowEnd:   now,
				CreatedAt:   now,
			}
			if err := s.repo.CreateSkipRecord(skipRecord); err != nil {
				return nil, fmt.Errorf("create skip record failed: %w", err)
			}

			return &CreateResponse{
				RequestID:  req.RequestID,
				Allowed:    false,
				Status:     model.StatusSkipped,
				SkipReason: model.ReasonInvalidCredential,
				Message:    "invalid or expired credential",
			}, nil
		}
	}

	notification.Status = model.StatusAllowed
	if err := s.repo.CreateNotificationRequest(notification); err != nil {
		return nil, fmt.Errorf("create notification failed: %w", err)
	}

	credential := utils.GenerateCredential()
	sendCred := &model.SendCredential{
		Credential: credential,
		Scene:      req.Scene,
		UserHash:   userHash,
		ExpiresAt:  now.Add(time.Duration(dedupWindow) * time.Second),
		Used:       false,
		CreatedAt:  now,
	}
	if err := s.repo.CreateSendCredential(sendCred); err != nil {
		return nil, fmt.Errorf("create credential failed: %w", err)
	}

	return &CreateResponse{
		RequestID:  req.RequestID,
		Allowed:    true,
		Status:     model.StatusAllowed,
		Credential: credential,
		Message:    "notification allowed to send",
	}, nil
}

type UpdateStatusRequest struct {
	RequestID string                  `json:"request_id" binding:"required"`
	Status    model.NotificationStatus `json:"status" binding:"required"`
}

func (s *DedupService) UpdateNotificationStatus(req *UpdateStatusRequest) error {
	existing, err := s.repo.GetNotificationRequestByRequestID(req.RequestID)
	if err != nil {
		return err
	}
	if existing == nil {
		return errors.New("request not found")
	}

	return s.repo.UpdateNotificationRequestStatus(req.RequestID, req.Status)
}

func (s *DedupService) GetNotification(requestID string) (*model.NotificationRequest, error) {
	return s.repo.GetNotificationRequestByRequestID(requestID)
}

type QueryRequest struct {
	Scene     string                  `form:"scene"`
	UserHash  string                  `form:"user_hash"`
	Status    model.NotificationStatus `form:"status"`
	StartTime string                  `form:"start_time"`
	EndTime   string                  `form:"end_time"`
	Offset    int                     `form:"offset"`
	Limit     int                     `form:"limit"`
}

func (s *DedupService) ListNotifications(query *QueryRequest) ([]model.NotificationRequest, int64, error) {
	startTime, _ := parseTime(query.StartTime)
	endTime, _ := parseTime(query.EndTime)
	if query.Limit <= 0 || query.Limit > 100 {
		query.Limit = 20
	}
	return s.repo.ListNotificationRequests(query.Scene, query.UserHash, query.Status, startTime, endTime, query.Offset, query.Limit)
}

func (s *DedupService) ListSkipRecords(query *QueryRequest) ([]model.SkipRecord, int64, error) {
	startTime, _ := parseTime(query.StartTime)
	endTime, _ := parseTime(query.EndTime)
	if query.Limit <= 0 || query.Limit > 100 {
		query.Limit = 20
	}
	return s.repo.ListSkipRecords(query.Scene, query.UserHash, startTime, endTime, query.Offset, query.Limit)
}

func (s *DedupService) GetStatistics(scene, startTime, endTime string) (*model.Statistics, error) {
	st, _ := parseTime(startTime)
	et, _ := parseTime(endTime)
	return s.repo.GetStatistics(scene, st, et)
}

func (s *DedupService) CreateBusinessScene(scene, description string, defaultWindow int64, enabled bool) (*model.BusinessScene, error) {
	existing, err := s.repo.GetBusinessScene(scene)
	if err != nil {
		return nil, err
	}
	if existing != nil {
		return existing, nil
	}

	bs := &model.BusinessScene{
		Scene:         scene,
		Description:   description,
		DefaultWindow: defaultWindow,
		Enabled:       enabled,
		CreatedAt:     time.Now(),
		UpdatedAt:     time.Now(),
	}
	if err := s.repo.CreateBusinessScene(bs); err != nil {
		return nil, err
	}
	return bs, nil
}

func parseTime(s string) (time.Time, error) {
	if s == "" {
		return time.Time{}, nil
	}
	formats := []string{
		time.RFC3339,
		"2006-01-02 15:04:05",
		"2006-01-02",
	}
	for _, f := range formats {
		if t, err := time.Parse(f, s); err == nil {
			return t, nil
		}
	}
	return time.Parse(time.RFC3339, s)
}
