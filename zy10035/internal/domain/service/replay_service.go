package service

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
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

type ReplayService struct {
	db            database.DB
	cacheMgr      *cache.CacheManager
	locker        utils.DistributedLocker
	trackingSvc   *TrackingService
	mqProducer    messagequeue.RocketMQProducer
	cfg           *config.ReplayConfig
	mu            sync.RWMutex
	activeReplays map[string]bool
}

func NewReplayService(
	db database.DB,
	cacheMgr *cache.CacheManager,
	locker utils.DistributedLocker,
	trackingSvc *TrackingService,
	producer messagequeue.RocketMQProducer,
	cfg *config.ReplayConfig,
) *ReplayService {
	if locker == nil {
		locker = &utils.NoopLocker{}
	}
	if cacheMgr == nil {
		cacheMgr = cache.NewCacheManager(nil, nil)
	}
	return &ReplayService{
		db:            db,
		cacheMgr:      cacheMgr,
		locker:        locker,
		trackingSvc:   trackingSvc,
		mqProducer:    producer,
		cfg:           cfg,
		activeReplays: make(map[string]bool),
	}
}

type ReplayMessagesRequest struct {
	DeadLetterIDs []int64
	TrackingIDs   []string
	ConsumerGroup string
	Topic         string
	Tag           string
	DryRun        bool
	MaxBatchSize  int
	Concurrency   int
	Timeout       int
	Reason        string
	OperatorID    string
}

type ReplayResult struct {
	RequestID    string              `json:"request_id"`
	TotalCount   int                 `json:"total_count"`
	SuccessCount int                 `json:"success_count"`
	FailedCount  int                 `json:"failed_count"`
	Status       string              `json:"status"`
	Results      []*ReplayItemResult `json:"results,omitempty"`
	StartTime    *time.Time          `json:"start_time"`
	EndTime      *time.Time          `json:"end_time"`
	Duration     int64               `json:"duration_ms"`
}

type ReplayItemResult struct {
	TrackingID    string `json:"tracking_id"`
	DeadLetterID  int64  `json:"dead_letter_id"`
	MessageID     string `json:"message_id"`
	Success       bool   `json:"success"`
	ErrorMessage  string `json:"error_message,omitempty"`
	ExecutionTime int64  `json:"execution_time_ms"`
}

func (s *ReplayService) ReplayMessages(ctx context.Context, req *ReplayMessagesRequest) (*ReplayResult, error) {
	if req == nil {
		return nil, errors.ErrInvalidParameter("request", "cannot be nil")
	}

	if req.MaxBatchSize <= 0 {
		req.MaxBatchSize = s.cfg.MaxBatchSize
	}
	if req.Concurrency <= 0 {
		req.Concurrency = s.cfg.Concurrency
	}
	if req.Timeout <= 0 {
		req.Timeout = int(s.cfg.Timeout.Seconds())
	}

	deadLetters, err := s.getDeadLettersToReplay(ctx, req)
	if err != nil {
		return nil, err
	}

	if len(deadLetters) == 0 {
		return nil, errors.ErrInvalidParameter("dead_letters", "no messages to replay")
	}

	requestID := utils.GenerateRequestID()

	lockKey := fmt.Sprintf("replay:%s", requestID)
	success, err := s.locker.TryLock(ctx, lockKey, time.Duration(req.Timeout+30)*time.Second)
	if err != nil || !success {
		return nil, errors.ErrConcurrentOperation("replay messages")
	}
	defer s.locker.Unlock(ctx, lockKey)

	now := time.Now()
	replayRequest := &model.ReplayRequest{
		RequestID:     requestID,
		DeadLetterIDs: s.stringifyIDs(deadLetters),
		ConsumerGroup: req.ConsumerGroup,
		Topic:         req.Topic,
		Tag:           req.Tag,
		DryRun:        req.DryRun,
		MaxBatchSize:  req.MaxBatchSize,
		Concurrency:   req.Concurrency,
		Timeout:       req.Timeout,
		Status:        "RUNNING",
		TotalCount:    len(deadLetters),
		OperatorID:    req.OperatorID,
		Reason:        req.Reason,
		StartTime:     &now,
	}

	if err := s.db.GetDB().Create(replayRequest).Error; err != nil {
		return nil, errors.ErrDatabaseOperationFailed("create replay request", err)
	}

	result := &ReplayResult{
		RequestID:  requestID,
		TotalCount: len(deadLetters),
		Status:     "RUNNING",
		StartTime:  &now,
	}

	s.mu.Lock()
	s.activeReplays[requestID] = true
	s.mu.Unlock()
	defer func() {
		s.mu.Lock()
		delete(s.activeReplays, requestID)
		s.mu.Unlock()
	}()

	go s.executeReplay(ctx, requestID, deadLetters, req)

	return result, nil
}

func (s *ReplayService) executeReplay(
	ctx context.Context,
	requestID string,
	deadLetters []*model.DeadLetterMessage,
	req *ReplayMessagesRequest,
) {
	startTime := time.Now()
	timeoutCtx, cancel := context.WithTimeout(ctx, time.Duration(req.Timeout)*time.Second)
	defer cancel()

	var successCount int64
	var failedCount int64

	semaphore := make(chan struct{}, req.Concurrency)
	var wg sync.WaitGroup

	results := make([]*ReplayItemResult, len(deadLetters))
	resultChan := make(chan *ReplayItemResult, len(deadLetters))

	for i, dl := range deadLetters {
		wg.Add(1)
		semaphore <- struct{}{}

		go func(index int, dl *model.DeadLetterMessage) {
			defer wg.Done()
			defer func() { <-semaphore }()

			itemStart := time.Now()
			itemResult := &ReplayItemResult{
				TrackingID:   dl.TrackingID,
				DeadLetterID: dl.ID,
				MessageID:    dl.MessageID,
			}

			task := &model.ReplayTask{
				RequestID:    requestID,
				TrackingID:   dl.TrackingID,
				DeadLetterID: dl.ID,
				MessageID:    dl.MessageID,
				Sequence:     index,
				Status:       "PROCESSING",
			}
			s.db.GetDB().Create(task)

			if req.DryRun {
				itemResult.Success = true
				itemResult.ExecutionTime = time.Since(itemStart).Milliseconds()
				task.Status = "SUCCESS"
				task.ExecutionTime = itemResult.ExecutionTime
				atomic.AddInt64(&successCount, 1)
			} else {
				err := s.replaySingleMessage(timeoutCtx, dl, req)
				if err != nil {
					itemResult.Success = false
					itemResult.ErrorMessage = err.Error()
					task.Status = "FAILED"
					task.ErrorMessage = err.Error()
					atomic.AddInt64(&failedCount, 1)
				} else {
					itemResult.Success = true
					task.Status = "SUCCESS"
					atomic.AddInt64(&successCount, 1)
				}
				itemResult.ExecutionTime = time.Since(itemStart).Milliseconds()
				task.ExecutionTime = itemResult.ExecutionTime
			}

			now := time.Now()
			task.StartTime = &itemStart
			task.EndTime = &now
			s.db.GetDB().Save(task)

			resultChan <- itemResult
		}(i, dl)
	}

	wg.Wait()
	close(resultChan)

	for itemResult := range results {
		_ = itemResult
	}

	endTime := time.Now()
	duration := endTime.Sub(startTime).Milliseconds()

	success := int(successCount)
	failed := int(failedCount)

	var finalStatus string
	if failed > 0 {
		finalStatus = "PARTIAL_SUCCESS"
		if success == 0 {
			finalStatus = "FAILED"
		}
	} else {
		finalStatus = "SUCCESS"
	}

	s.db.GetDB().Model(&model.ReplayRequest{}).
		Where("request_id = ?", requestID).
		Updates(map[string]interface{}{
			"status":        finalStatus,
			"success_count": success,
			"failed_count":  failed,
			"end_time":      &endTime,
		})

	logger.Info("Replay completed, request_id=%s, total=%d, success=%d, failed=%d, duration=%dms",
		requestID, len(deadLetters), success, failed, duration)
}

func (s *ReplayService) replaySingleMessage(
	ctx context.Context,
	dl *model.DeadLetterMessage,
	req *ReplayMessagesRequest,
) error {
	lockKey := fmt.Sprintf("replay_item:%d", dl.ID)
	success, err := s.locker.TryLock(ctx, lockKey, 5*time.Minute)
	if err != nil || !success {
		return errors.ErrConcurrentOperation(fmt.Sprintf("replay item %d", dl.ID))
	}
	defer s.locker.Unlock(ctx, lockKey)

	tracking, err := s.trackingSvc.GetByTrackingID(ctx, dl.TrackingID)
	if err != nil {
		return err
	}

	if tracking.Status != model.MessageStatusDeadLetter {
		return fmt.Errorf("message not in dead letter state: %s", tracking.Status)
	}

	if dl.ReplayCount >= dl.MaxReplayCount {
		return fmt.Errorf("exceeded max replay count: %d", dl.MaxReplayCount)
	}

	_, err = s.trackingSvc.UpdateStatus(ctx, dl.TrackingID, model.MessageStatusReplaying, "", "")
	if err != nil {
		return err
	}

	var properties map[string]string
	if dl.Properties != "" {
		json.Unmarshal([]byte(dl.Properties), &properties)
	}
	if properties == nil {
		properties = make(map[string]string)
	}
	properties["replay_count"] = fmt.Sprintf("%d", dl.ReplayCount+1)
	properties["original_message_id"] = dl.MessageID
	properties["replay_time"] = time.Now().Format(time.RFC3339)

	topic := dl.OriginTopic
	if req.Topic != "" {
		topic = req.Topic
	}

	msg := &messagequeue.Message{
		Topic:      topic,
		Tag:        dl.Tag,
		Keys:       dl.Keys,
		Body:       dl.Body,
		Properties: properties,
	}

	newMessageID, err := s.mqProducer.Send(ctx, msg)
	if err != nil {
		_, _ = s.trackingSvc.UpdateStatus(ctx, dl.TrackingID, model.MessageStatusDeadLetter, err.Error(), "")
		return errors.ErrMQOperationFailed("replay send", err)
	}

	now := time.Now()
	updates := map[string]interface{}{
		"replay_count":      dl.ReplayCount + 1,
		"replay_status":     model.MessageStatusReplayed,
		"last_replay_at":    &now,
		"origin_message_id": dl.MessageID,
	}
	s.db.GetDB().Model(&model.DeadLetterMessage{}).Where("id = ?", dl.ID).Updates(updates)

	_, err = s.trackingSvc.UpdateStatus(ctx, dl.TrackingID, model.MessageStatusReplayed, "", "")
	if err != nil {
		logger.Warn("Failed to update tracking status after replay: %v", err)
	}

	eventLog := &model.MessageEventLog{
		TrackingID:  dl.TrackingID,
		MessageID:   dl.MessageID,
		EventName:   "MESSAGE_REPLAYED",
		FromStatus:  model.MessageStatusDeadLetter,
		ToStatus:    model.MessageStatusReplayed,
		Operation:   "REPLAY_MESSAGE",
		Description: fmt.Sprintf("消息重放成功，新消息ID: %s", newMessageID),
		Success:     true,
	}
	s.db.GetDB().Create(eventLog)

	logger.Info("Message replayed successfully, tracking_id=%s, new_message_id=%s", dl.TrackingID, newMessageID)
	return nil
}

func (s *ReplayService) getDeadLettersToReplay(
	ctx context.Context,
	req *ReplayMessagesRequest,
) ([]*model.DeadLetterMessage, error) {
	var deadLetters []*model.DeadLetterMessage
	query := s.db.GetDB().WithContext(ctx).Model(&model.DeadLetterMessage{})

	if len(req.DeadLetterIDs) > 0 {
		query = query.Where("id IN ?", req.DeadLetterIDs)
	}
	if len(req.TrackingIDs) > 0 {
		query = query.Where("tracking_id IN ?", req.TrackingIDs)
	}
	if req.ConsumerGroup != "" {
		query = query.Where("consumer_group = ?", req.ConsumerGroup)
	}
	if req.Topic != "" {
		query = query.Where("topic = ? OR origin_topic = ?", req.Topic, req.Topic)
	}
	if req.Tag != "" {
		query = query.Where("tag = ?", req.Tag)
	}

	query = query.Where("replay_count < max_replay_count")

	if err := query.Order("dead_letter_at ASC").Find(&deadLetters).Error; err != nil {
		return nil, errors.ErrDatabaseOperationFailed("query dead letters", err)
	}

	return deadLetters, nil
}

func (s *ReplayService) stringifyIDs(deadLetters []*model.DeadLetterMessage) string {
	ids := make([]int64, len(deadLetters))
	for i, dl := range deadLetters {
		ids[i] = dl.ID
	}
	data, _ := json.Marshal(ids)
	return string(data)
}

func (s *ReplayService) GetReplayRequest(ctx context.Context, requestID string) (*model.ReplayRequest, error) {
	var request model.ReplayRequest
	if err := s.db.GetDB().WithContext(ctx).Where("request_id = ?", requestID).First(&request).Error; err != nil {
		return nil, errors.ErrMessageNotFound(requestID)
	}
	return &request, nil
}

func (s *ReplayService) GetReplayTasks(ctx context.Context, requestID string) ([]*model.ReplayTask, error) {
	var tasks []*model.ReplayTask
	if err := s.db.GetDB().WithContext(ctx).
		Where("request_id = ?", requestID).
		Order("sequence ASC").
		Find(&tasks).Error; err != nil {
		return nil, errors.ErrDatabaseOperationFailed("query replay tasks", err)
	}
	return tasks, nil
}

func (s *ReplayService) ListReplayRequests(ctx context.Context, status string, page, pageSize int) ([]*model.ReplayRequest, int64, error) {
	var total int64
	var requests []*model.ReplayRequest

	query := s.db.GetDB().WithContext(ctx).Model(&model.ReplayRequest{})
	if status != "" {
		query = query.Where("status = ?", status)
	}

	if err := query.Count(&total).Error; err != nil {
		return nil, 0, errors.ErrDatabaseOperationFailed("count replay requests", err)
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
		Find(&requests).Error; err != nil {
		return nil, 0, errors.ErrDatabaseOperationFailed("list replay requests", err)
	}

	return requests, total, nil
}

func (s *ReplayService) CancelReplay(ctx context.Context, requestID string) error {
	lockKey := fmt.Sprintf("replay_cancel:%s", requestID)
	if err := s.locker.Lock(ctx, lockKey, 10*time.Second); err != nil {
		return errors.ErrConcurrentOperation("cancel replay")
	}
	defer s.locker.Unlock(ctx, lockKey)

	result := s.db.GetDB().Model(&model.ReplayRequest{}).
		Where("request_id = ? AND status = ?", requestID, "RUNNING").
		Updates(map[string]interface{}{
			"status":   "CANCELLED",
			"end_time": time.Now(),
		})

	if result.RowsAffected == 0 {
		return fmt.Errorf("replay not running or not found: %s", requestID)
	}

	logger.Info("Replay cancelled, request_id=%s", requestID)
	return nil
}

func (s *ReplayService) IsReplayActive(requestID string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.activeReplays[requestID]
}
