package service

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"mq-deadletter-review/internal/config"
	"mq-deadletter-review/internal/domain/model"
	"mq-deadletter-review/internal/infrastructure/cache"
	"mq-deadletter-review/internal/infrastructure/database"
	"mq-deadletter-review/internal/infrastructure/messagequeue"
	"mq-deadletter-review/pkg/errors"
	"mq-deadletter-review/pkg/logger"
	"mq-deadletter-review/pkg/utils"
)

type TrackingService struct {
	db         database.DB
	cacheMgr   *cache.CacheManager
	locker     utils.DistributedLocker
	cfg        *config.TrackingConfig
	mqProducer messagequeue.RocketMQProducer
	mu         sync.RWMutex
}

func NewTrackingService(
	db database.DB,
	cacheMgr *cache.CacheManager,
	locker utils.DistributedLocker,
	cfg *config.TrackingConfig,
	producer messagequeue.RocketMQProducer,
) *TrackingService {
	if locker == nil {
		locker = &utils.NoopLocker{}
	}
	if cacheMgr == nil {
		cacheMgr = cache.NewCacheManager(nil, nil)
	}
	return &TrackingService{
		db:         db,
		cacheMgr:   cacheMgr,
		locker:     locker,
		cfg:        cfg,
		mqProducer: producer,
	}
}

type CreateTrackingRequest struct {
	MessageID     string
	Topic         string
	Tag           string
	Keys          string
	ProducerGroup string
	ConsumerGroup string
	Body          string
	Properties    map[string]string
}

func (s *TrackingService) CreateTracking(ctx context.Context, req *CreateTrackingRequest) (*model.MessageTracking, error) {
	if req.MessageID == "" {
		return nil, errors.ErrInvalidParameter("message_id", "cannot be empty")
	}

	lockKey := fmt.Sprintf("tracking_create:%s", req.MessageID)
	success, err := s.locker.TryLock(ctx, lockKey, 30*time.Second)
	if err != nil {
		return nil, errors.ErrConcurrentOperation("create tracking")
	}
	if !success {
		existing, err := s.GetByMessageID(ctx, req.MessageID)
		if err == nil {
			return existing, nil
		}
		return nil, errors.ErrConcurrentOperation("create tracking")
	}
	defer s.locker.Unlock(ctx, lockKey)

	existing, err := s.GetByMessageID(ctx, req.MessageID)
	if err == nil && existing != nil {
		return existing, nil
	}

	trackingID := utils.GenerateTrackingID()
	now := time.Now()

	propertiesJSON := "{}"
	if req.Properties != nil {
		if propsData, err := json.Marshal(req.Properties); err == nil {
			propertiesJSON = string(propsData)
		}
	}

	tracking := &model.MessageTracking{
		TrackingID:     trackingID,
		MessageID:      req.MessageID,
		Topic:          req.Topic,
		Tag:            req.Tag,
		Keys:           req.Keys,
		ProducerGroup:  req.ProducerGroup,
		ConsumerGroup:  req.ConsumerGroup,
		Status:         model.MessageStatusProduced,
		PreviousStatus: "",
		RetryCount:     0,
		MaxRetryCount:  s.cfg.MaxRetryTimes,
		Body:           req.Body,
		Properties:     propertiesJSON,
		ProducedAt:     &now,
	}

	if err := s.db.GetDB().WithContext(ctx).Create(tracking).Error; err != nil {
		if strings.Contains(err.Error(), "Duplicate entry") {
			return s.GetByMessageID(ctx, req.MessageID)
		}
		return nil, errors.ErrDatabaseOperationFailed("create tracking", err)
	}

	eventLog := &model.MessageEventLog{
		TrackingID:  tracking.TrackingID,
		MessageID:   tracking.MessageID,
		EventName:   "MESSAGE_PRODUCED",
		FromStatus:  "",
		ToStatus:    model.MessageStatusProduced,
		Operation:   "CREATE_TRACKING",
		Description: "消息生产追踪记录创建",
		Success:     true,
	}
	s.db.GetDB().Create(eventLog)

	cacheKey := cache.GenerateTrackingCacheKey(tracking.TrackingID)
	if trackingJSON, err := json.Marshal(tracking); err == nil {
		s.cacheMgr.Set(ctx, cacheKey, string(trackingJSON), 10*time.Minute)
	}

	logger.Info("Created tracking record, tracking_id=%s, message_id=%s", tracking.TrackingID, tracking.MessageID)
	return tracking, nil
}

func (s *TrackingService) UpdateStatus(ctx context.Context, trackingID string, newStatus model.MessageStatus, errMsg string, stack string) (*model.MessageTracking, error) {
	lockKey := fmt.Sprintf("tracking_status:%s", trackingID)
	if err := s.locker.Lock(ctx, lockKey, 30*time.Second); err != nil {
		return nil, errors.ErrConcurrentOperation("update status")
	}
	defer s.locker.Unlock(ctx, lockKey)

	var tracking model.MessageTracking
	if err := s.db.GetDB().WithContext(ctx).Where("tracking_id = ?", trackingID).First(&tracking).Error; err != nil {
		return nil, errors.ErrMessageNotFound(trackingID)
	}

	oldStatus := tracking.Status

	if err := tracking.TransitionTo(newStatus); err != nil {
		return nil, errors.ErrInvalidStatusTransition(string(oldStatus), string(newStatus))
	}

	now := time.Now()
	tracking.UpdatedAt = now

	if errMsg != "" {
		tracking.LatestError = errMsg
		tracking.LatestErrorAt = &now
		tracking.ErrorMessage = errMsg
		if stack != "" {
			tracking.ErrorStack = stack
		}
	}

	switch newStatus {
	case model.MessageStatusSent:
		tracking.SentAt = &now
	case model.MessageStatusConsumed:
		tracking.ConsumedAt = &now
	case model.MessageStatusRetry:
		tracking.RetryCount++
	case model.MessageStatusDeadLetter:
		tracking.DeadLetterAt = &now
	case model.MessageStatusReplayed:
		tracking.ReplayedAt = &now
	case model.MessageStatusProcessed:
		tracking.ProcessedAt = &now
	}

	if err := s.db.GetDB().WithContext(ctx).Save(&tracking).Error; err != nil {
		return nil, errors.ErrDatabaseOperationFailed("update status", err)
	}

	eventLog := &model.MessageEventLog{
		TrackingID:  tracking.TrackingID,
		MessageID:   tracking.MessageID,
		EventName:   "STATUS_TRANSITION",
		FromStatus:  oldStatus,
		ToStatus:    newStatus,
		Operation:   "UPDATE_STATUS",
		Description: fmt.Sprintf("状态从 %s 转换到 %s", oldStatus, newStatus),
		Success:     errMsg == "",
		ErrorInfo:   errMsg,
	}
	s.db.GetDB().Create(eventLog)

	cacheKey := cache.GenerateTrackingCacheKey(tracking.TrackingID)
	s.cacheMgr.Delete(ctx, cacheKey)

	if trackingJSON, err := json.Marshal(tracking); err == nil {
		s.cacheMgr.Set(ctx, cacheKey, string(trackingJSON), 10*time.Minute)
	}

	logger.Info("Updated tracking status, tracking_id=%s, from=%s, to=%s", trackingID, oldStatus, newStatus)
	return &tracking, nil
}

func (s *TrackingService) GetByTrackingID(ctx context.Context, trackingID string) (*model.MessageTracking, error) {
	cacheKey := cache.GenerateTrackingCacheKey(trackingID)

	if cachedData, err := s.cacheMgr.Get(ctx, cacheKey); err == nil {
		var tracking model.MessageTracking
		if err := json.Unmarshal([]byte(cachedData), &tracking); err == nil {
			return &tracking, nil
		}
	}

	var tracking model.MessageTracking
	if err := s.db.GetDB().WithContext(ctx).Where("tracking_id = ?", trackingID).First(&tracking).Error; err != nil {
		return nil, errors.ErrMessageNotFound(trackingID)
	}

	if trackingJSON, err := json.Marshal(tracking); err == nil {
		s.cacheMgr.Set(ctx, cacheKey, string(trackingJSON), 10*time.Minute)
	}

	return &tracking, nil
}

func (s *TrackingService) GetByMessageID(ctx context.Context, messageID string) (*model.MessageTracking, error) {
	var tracking model.MessageTracking
	if err := s.db.GetDB().WithContext(ctx).Where("message_id = ?", messageID).First(&tracking).Error; err != nil {
		return nil, errors.ErrMessageNotFound(messageID)
	}
	return &tracking, nil
}

func (s *TrackingService) GetEventLogs(ctx context.Context, trackingID string, limit int) ([]*model.MessageEventLog, error) {
	var logs []*model.MessageEventLog
	if limit <= 0 {
		limit = 100
	}
	if err := s.db.GetDB().WithContext(ctx).
		Where("tracking_id = ?", trackingID).
		Order("created_at DESC").
		Limit(limit).
		Find(&logs).Error; err != nil {
		return nil, errors.ErrDatabaseOperationFailed("get event logs", err)
	}
	return logs, nil
}

func (s *TrackingService) ListByStatus(ctx context.Context, status model.MessageStatus, page, pageSize int) ([]*model.MessageTracking, int64, error) {
	var total int64
	var trackings []*model.MessageTracking

	query := s.db.GetDB().WithContext(ctx).Model(&model.MessageTracking{}).Where("status = ?", status)

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, errors.ErrDatabaseOperationFailed("count trackings", err)
	}

	if pageSize <= 0 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}

	offset := (page - 1) * pageSize
	if err := query.Order("created_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&trackings).Error; err != nil {
		return nil, 0, errors.ErrDatabaseOperationFailed("list trackings", err)
	}

	return trackings, total, nil
}

func (s *TrackingService) MarkAsDeadLetter(ctx context.Context, trackingID string, errMsg string, stack string) (*model.DeadLetterMessage, error) {
	tracking, err := s.UpdateStatus(ctx, trackingID, model.MessageStatusDeadLetter, errMsg, stack)
	if err != nil {
		return nil, err
	}

	lockKey := fmt.Sprintf("deadletter_create:%s", trackingID)
	success, err := s.locker.TryLock(ctx, lockKey, 30*time.Second)
	if err != nil {
		return nil, errors.ErrConcurrentOperation("create deadletter")
	}
	if !success {
		var existing model.DeadLetterMessage
		if err := s.db.GetDB().Where("tracking_id = ?", trackingID).First(&existing).Error; err == nil {
			return &existing, nil
		}
		return nil, errors.ErrConcurrentOperation("create deadletter")
	}
	defer s.locker.Unlock(ctx, lockKey)

	var existing model.DeadLetterMessage
	if err := s.db.GetDB().Where("tracking_id = ?", trackingID).First(&existing).Error; err == nil {
		return &existing, nil
	}

	now := time.Now()
	deadLetter := &model.DeadLetterMessage{
		TrackingID:      tracking.TrackingID,
		MessageID:       tracking.MessageID,
		Topic:           tracking.Topic,
		Tag:             tracking.Tag,
		Keys:            tracking.Keys,
		ConsumerGroup:   tracking.ConsumerGroup,
		Body:            tracking.Body,
		Properties:      tracking.Properties,
		ErrorMessage:    errMsg,
		ErrorStack:      stack,
		TotalRetryCount: tracking.RetryCount,
		ReplayCount:     0,
		MaxReplayCount:  5,
		OriginTopic:     tracking.Topic,
		OriginMessageID: tracking.MessageID,
		ReplayStatus:    model.MessageStatusDeadLetter,
		DeadLetterAt:    &now,
	}

	if err := s.db.GetDB().WithContext(ctx).Create(deadLetter).Error; err != nil {
		return nil, errors.ErrDatabaseOperationFailed("create deadletter", err)
	}

	logger.Info("Message moved to dead letter, tracking_id=%s, message_id=%s", trackingID, tracking.MessageID)
	return deadLetter, nil
}

func (s *TrackingService) GetDeadLetter(ctx context.Context, id int64) (*model.DeadLetterMessage, error) {
	var deadLetter model.DeadLetterMessage
	if err := s.db.GetDB().WithContext(ctx).First(&deadLetter, id).Error; err != nil {
		return nil, errors.ErrDeadLetterNotFound(fmt.Sprintf("%d", id))
	}
	return &deadLetter, nil
}

func (s *TrackingService) GetDeadLetterByTrackingID(ctx context.Context, trackingID string) (*model.DeadLetterMessage, error) {
	var deadLetter model.DeadLetterMessage
	if err := s.db.GetDB().WithContext(ctx).Where("tracking_id = ?", trackingID).First(&deadLetter).Error; err != nil {
		return nil, errors.ErrDeadLetterNotFound(trackingID)
	}
	return &deadLetter, nil
}

func (s *TrackingService) ListDeadLetters(ctx context.Context, consumerGroup, topic, tag string, page, pageSize int) ([]*model.DeadLetterMessage, int64, error) {
	var total int64
	var deadLetters []*model.DeadLetterMessage

	query := s.db.GetDB().WithContext(ctx).Model(&model.DeadLetterMessage{})
	if consumerGroup != "" {
		query = query.Where("consumer_group = ?", consumerGroup)
	}
	if topic != "" {
		query = query.Where("topic = ?", topic)
	}
	if tag != "" {
		query = query.Where("tag = ?", tag)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, errors.ErrDatabaseOperationFailed("count deadletters", err)
	}

	if pageSize <= 0 {
		pageSize = 20
	}
	if page <= 0 {
		page = 1
	}

	offset := (page - 1) * pageSize
	if err := query.Order("dead_letter_at DESC").
		Offset(offset).Limit(pageSize).
		Find(&deadLetters).Error; err != nil {
		return nil, 0, errors.ErrDatabaseOperationFailed("list deadletters", err)
	}

	return deadLetters, total, nil
}

func (s *TrackingService) GetStatistics(ctx context.Context) (map[string]interface{}, error) {
	stats := make(map[string]interface{})

	statuses := []model.MessageStatus{
		model.MessageStatusProduced,
		model.MessageStatusSent,
		model.MessageStatusConsumed,
		model.MessageStatusRetry,
		model.MessageStatusDeadLetter,
		model.MessageStatusReplayed,
		model.MessageStatusProcessed,
		model.MessageStatusFailed,
	}

	for _, status := range statuses {
		var count int64
		s.db.GetDB().Model(&model.MessageTracking{}).Where("status = ?", status).Count(&count)
		stats[string(status)] = count
	}

	var deadLetterCount int64
	s.db.GetDB().Model(&model.DeadLetterMessage{}).Count(&deadLetterCount)
	stats["DEAD_LETTER_TOTAL"] = deadLetterCount

	return stats, nil
}
