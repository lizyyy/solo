package service

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"push-token-lifecycle/internal/model"
	"push-token-lifecycle/internal/storage"
	"time"
)

type LifecycleService struct {
	storage storage.Storage
}

func NewLifecycleService(s storage.Storage) *LifecycleService {
	return &LifecycleService{storage: s}
}

func generateID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return hex.EncodeToString(b)
}

func (s *LifecycleService) BindToken(req *model.TokenLifecycleRequest) (*model.PushToken, error) {
	if req.Token == "" || req.UserID == "" || req.DeviceID == "" {
		return nil, errors.New("token, user_id and device_id are required")
	}

	existingToken, err := s.storage.GetTokenByToken(req.Token)
	if err != nil {
		return nil, fmt.Errorf("failed to check existing token: %w", err)
	}

	now := time.Now()

	if existingToken != nil {
		bindType := "REBIND"
		if existingToken.UserID != req.UserID {
			bindType = "USER_CHANGE"
			existingToken.Status = model.TokenStatusRebound
		}
		if existingToken.DeviceID != req.DeviceID {
			bindType = "DEVICE_CHANGE"
		}

		prevUserID := existingToken.UserID
		prevDeviceID := existingToken.DeviceID

		existingToken.UserID = req.UserID
		existingToken.DeviceID = req.DeviceID
		existingToken.Platform = req.Platform
		existingToken.BindCount++
		existingToken.LastBindAt = now
		existingToken.UpdatedAt = now

		if existingToken.Status == model.TokenStatusUnsubscribed {
			existingToken.Status = model.TokenStatusActive
		}

		if err := s.storage.UpdateToken(existingToken); err != nil {
			return nil, fmt.Errorf("failed to update token: %w", err)
		}

		bindEvent := &model.BindEvent{
			ID:               generateID(),
			TokenID:          existingToken.ID,
			UserID:           req.UserID,
			DeviceID:         req.DeviceID,
			PreviousUserID:   &prevUserID,
			PreviousDeviceID: &prevDeviceID,
			BindType:         bindType,
			CreatedAt:        now,
		}
		if err := s.storage.CreateBindEvent(bindEvent); err != nil {
			return nil, fmt.Errorf("failed to create bind event: %w", err)
		}

		return existingToken, nil
	}

	device, err := s.storage.GetDeviceByDeviceID(req.DeviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to check device: %w", err)
	}
	if device == nil {
		device = &model.Device{
			ID:          generateID(),
			UserID:      req.UserID,
			DeviceID:    req.DeviceID,
			Platform:    req.Platform,
			DeviceName:  req.DeviceName,
			AppVersion:  req.AppVersion,
			OSVersion:   req.OSVersion,
			CreatedAt:   now,
			UpdatedAt:   now,
		}
		if err := s.storage.CreateDevice(device); err != nil {
			return nil, fmt.Errorf("failed to create device: %w", err)
		}
	}

	newToken := &model.PushToken{
		ID:         generateID(),
		Token:      req.Token,
		UserID:     req.UserID,
		DeviceID:   req.DeviceID,
		Platform:   req.Platform,
		Status:     model.TokenStatusActive,
		BindCount:  1,
		LastBindAt: now,
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	if err := s.storage.CreateToken(newToken); err != nil {
		return nil, fmt.Errorf("failed to create token: %w", err)
	}

	bindEvent := &model.BindEvent{
		ID:         generateID(),
		TokenID:    newToken.ID,
		UserID:     req.UserID,
		DeviceID:   req.DeviceID,
		BindType:   "INITIAL",
		CreatedAt:  now,
	}
	if err := s.storage.CreateBindEvent(bindEvent); err != nil {
		return nil, fmt.Errorf("failed to create bind event: %w", err)
	}

	return newToken, nil
}

func (s *LifecycleService) RecordPushReceipt(req *model.PushReceiptRequest) (*model.PushReceipt, error) {
	if req.PushID == "" || req.Token == "" {
		return nil, errors.New("push_id and token are required")
	}

	token, err := s.storage.GetTokenByToken(req.Token)
	if err != nil {
		return nil, fmt.Errorf("failed to get token: %w", err)
	}
	if token == nil {
		return nil, errors.New("token not found")
	}

	now := time.Now()
	receipt := &model.PushReceipt{
		ID:            generateID(),
		TokenID:       token.ID,
		PushID:        req.PushID,
		Success:       req.Success,
		FailureReason: req.FailureReason,
		ErrorMessage:  req.ErrorMessage,
		RawResponse:   req.RawResponse,
		SentAt:        req.SentAt,
		ReceivedAt:    &now,
		CreatedAt:     now,
	}

	if err := s.storage.CreatePushReceipt(receipt); err != nil {
		return nil, fmt.Errorf("failed to create receipt: %w", err)
	}

	if !req.Success {
		if req.FailureReason == model.FailureReasonInvalidToken ||
			req.FailureReason == model.FailureReasonUnregistered {
			token.Status = model.TokenStatusExpired
			token.UpdatedAt = now
			if err := s.storage.UpdateToken(token); err != nil {
				return nil, fmt.Errorf("failed to update token status: %w", err)
			}
		}
	} else {
		token.LastPushAt = &now
		if token.Status == model.TokenStatusInactive {
			token.Status = model.TokenStatusActive
		}
		token.UpdatedAt = now
		if err := s.storage.UpdateToken(token); err != nil {
			return nil, fmt.Errorf("failed to update token: %w", err)
		}
	}

	return receipt, nil
}

func (s *LifecycleService) Unsubscribe(tokenID, reason, channel string) (*model.UnsubscribeEvent, error) {
	if tokenID == "" {
		return nil, errors.New("token_id is required")
	}

	token, err := s.storage.GetToken(tokenID)
	if err != nil {
		return nil, fmt.Errorf("failed to get token: %w", err)
	}
	if token == nil {
		return nil, errors.New("token not found")
	}

	now := time.Now()
	event := &model.UnsubscribeEvent{
		ID:        generateID(),
		TokenID:   tokenID,
		UserID:    token.UserID,
		DeviceID:  token.DeviceID,
		Reason:    reason,
		Channel:   channel,
		CreatedAt: now,
	}

	if err := s.storage.CreateUnsubscribeEvent(event); err != nil {
		return nil, fmt.Errorf("failed to create unsubscribe event: %w", err)
	}

	token.Status = model.TokenStatusUnsubscribed
	token.UpdatedAt = now
	if err := s.storage.UpdateToken(token); err != nil {
		return nil, fmt.Errorf("failed to update token status: %w", err)
	}

	return event, nil
}

func (s *LifecycleService) ManualCorrection(req *model.ManualCorrectionRequest) (*model.PushToken, error) {
	if req.TokenID == "" || req.NewStatus == "" || req.Reason == "" {
		return nil, errors.New("token_id, new_status and reason are required")
	}

	token, err := s.storage.GetToken(req.TokenID)
	if err != nil {
		return nil, fmt.Errorf("failed to get token: %w", err)
	}
	if token == nil {
		return nil, errors.New("token not found")
	}

	token.Status = req.NewStatus
	token.UpdatedAt = time.Now()

	if err := s.storage.UpdateToken(token); err != nil {
		return nil, fmt.Errorf("failed to update token: %w", err)
	}

	return token, nil
}

func (s *LifecycleService) GetToken(tokenID string) (*model.PushToken, error) {
	return s.storage.GetToken(tokenID)
}

func (s *LifecycleService) GetTokenByToken(token string) (*model.PushToken, error) {
	return s.storage.GetTokenByToken(token)
}

func (s *LifecycleService) ListTokensByUser(userID string) ([]*model.PushToken, error) {
	return s.storage.ListTokensByUser(userID)
}

func (s *LifecycleService) GenerateLifecycleReport(tokenID string) (*model.LifecycleReport, error) {
	token, err := s.storage.GetToken(tokenID)
	if err != nil {
		return nil, fmt.Errorf("failed to get token: %w", err)
	}
	if token == nil {
		return nil, errors.New("token not found")
	}

	bindEvents, err := s.storage.ListBindEventsByToken(tokenID)
	if err != nil {
		return nil, fmt.Errorf("failed to get bind events: %w", err)
	}

	totalBinds := len(bindEvents)
	isRebound := totalBinds > 1 || token.Status == model.TokenStatusRebound

	totalPushes, successPushes, failedPushes, lastFailureAt, lastFailureReason, err := s.storage.GetFailureStatsByToken(tokenID)
	if err != nil {
		return nil, fmt.Errorf("failed to get failure stats: %w", err)
	}

	unsubEvent, err := s.storage.GetLatestUnsubscribeByToken(tokenID)
	if err != nil {
		return nil, fmt.Errorf("failed to get unsubscribe event: %w", err)
	}
	isUnsubscribed := unsubEvent != nil

	report := &model.LifecycleReport{
		TokenID:           tokenID,
		Token:             token.Token,
		UserID:            token.UserID,
		DeviceID:          token.DeviceID,
		Status:            token.Status,
		TotalBinds:        totalBinds,
		TotalPushes:       totalPushes,
		SuccessPushes:     successPushes,
		FailedPushes:      failedPushes,
		LastFailureAt:     lastFailureAt,
		LastFailureReason: lastFailureReason,
		IsUnsubscribed:    isUnsubscribed,
		IsRebound:         isRebound,
		GeneratedAt:       time.Now(),
	}

	if err := s.storage.CreateReport(report); err != nil {
		return nil, fmt.Errorf("failed to save report: %w", err)
	}

	return report, nil
}

func (s *LifecycleService) GetLifecycleReports(startTime, endTime time.Time) ([]*model.LifecycleReport, error) {
	return s.storage.ListReports(startTime, endTime)
}

func (s *LifecycleService) GetTokenLifecycleDetails(tokenID string) (map[string]interface{}, error) {
	token, err := s.storage.GetToken(tokenID)
	if err != nil {
		return nil, err
	}
	if token == nil {
		return nil, errors.New("token not found")
	}

	bindEvents, err := s.storage.ListBindEventsByToken(tokenID)
	if err != nil {
		return nil, err
	}

	unsubEvents, err := s.storage.ListUnsubscribeEventsByToken(tokenID)
	if err != nil {
		return nil, err
	}

	receipts, err := s.storage.ListReceiptsByToken(tokenID)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"token":            token,
		"bind_events":      bindEvents,
		"unsubscribe_events": unsubEvents,
		"push_receipts":    receipts,
	}, nil
}
