package service

import (
	"api-status-aggregator/models"
	"api-status-aggregator/storage"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"go.uber.org/zap"
)

type Service struct {
	storage *storage.Storage
	logger  *zap.Logger
	client  *http.Client
}

func NewService(storage *storage.Storage, logger *zap.Logger) *Service {
	return &Service{
		storage: storage,
		logger:  logger,
		client: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

func (s *Service) CreateSubscription(req *models.CreateSubscriptionRequest) (*models.Subscription, error) {
	existingSub, err := s.storage.GetSubscriptionByIdempotentKey(req.IdempotentKey)
	if err != nil {
		return nil, fmt.Errorf("check idempotent key failed: %w", err)
	}
	if existingSub != nil {
		return existingSub, nil
	}

	topic, err := s.storage.GetTopicByName(req.TopicName)
	if err != nil {
		return nil, fmt.Errorf("get topic failed: %w", err)
	}
	if topic == nil {
		topic = &models.SubscriptionTopic{
			Name:        req.TopicName,
			Description: fmt.Sprintf("Auto-created topic for %s", req.TopicName),
			Enabled:     true,
		}
		if err := s.storage.CreateTopic(topic); err != nil {
			return nil, fmt.Errorf("create topic failed: %w", err)
		}
	}

	business := &models.BusinessObject{
		Type:        req.BusinessType,
		Identifier:  req.BusinessID,
		DisplayName: fmt.Sprintf("%s-%s", req.BusinessType, req.BusinessID),
	}
	business, err = s.storage.CreateOrGetBusinessObject(business)
	if err != nil {
		return nil, fmt.Errorf("create business object failed: %w", err)
	}

	sub := &models.Subscription{
		TopicID:       topic.ID,
		BusinessID:    business.ID,
		SubscriberID:  req.SubscriberID,
		Subscriber:    req.Subscriber,
		Enabled:       true,
		FilterExpr:    req.FilterExpr,
		IdempotentKey: req.IdempotentKey,
	}
	if err := s.storage.CreateSubscription(sub); err != nil {
		return nil, fmt.Errorf("create subscription failed: %w", err)
	}

	headersJSON, _ := json.Marshal(req.Headers)
	pref := &models.DeliveryPreference{
		SubscriptionID: sub.ID,
		Endpoint:       req.Endpoint,
		Method:         req.Method,
		Headers:        string(headersJSON),
		Timeout:        req.Timeout,
		RetryCount:     req.RetryCount,
		RetryInterval:  req.RetryInterval,
	}
	if pref.Method == "" {
		pref.Method = "POST"
	}
	if pref.Timeout == 0 {
		pref.Timeout = 30
	}
	if pref.RetryCount == 0 {
		pref.RetryCount = 3
	}
	if pref.RetryInterval == 0 {
		pref.RetryInterval = 60
	}
	if err := s.storage.CreateDeliveryPreference(pref); err != nil {
		return nil, fmt.Errorf("create delivery preference failed: %w", err)
	}

	return sub, nil
}

func (s *Service) ProcessStatusChange(req *models.StatusChangeRequest) (*models.StatusChange, error) {
	existing, err := s.storage.GetStatusChangeByIdempotentKey(req.IdempotentKey)
	if err != nil {
		return nil, fmt.Errorf("check idempotent key failed: %w", err)
	}
	if existing != nil {
		return existing, nil
	}

	topic, err := s.storage.GetTopicByName(req.TopicName)
	if err != nil {
		return nil, fmt.Errorf("get topic failed: %w", err)
	}
	if topic == nil {
		return nil, errors.New("topic not found")
	}

	business, err := s.storage.GetBusinessObject(req.BusinessType, req.BusinessID)
	if err != nil {
		return nil, fmt.Errorf("get business object failed: %w", err)
	}
	if business == nil {
		return nil, errors.New("business object not found")
	}

	change := &models.StatusChange{
		BusinessID:    business.ID,
		TopicID:       topic.ID,
		FromStatus:    req.FromStatus,
		ToStatus:      req.ToStatus,
		ChangeReason:  req.ChangeReason,
		OperatorID:    req.OperatorID,
		OperatorName:  req.OperatorName,
		IdempotentKey: req.IdempotentKey,
	}
	if err := s.storage.CreateStatusChange(change); err != nil {
		return nil, fmt.Errorf("create status change failed: %w", err)
	}

	if err := s.createDeliveryRecords(change, topic.ID, business.ID); err != nil {
		s.logger.Error("create delivery records failed", zap.Error(err))
	}

	return change, nil
}

func (s *Service) createDeliveryRecords(change *models.StatusChange, topicID, businessID string) error {
	subs, err := s.storage.GetSubscriptionsByTopicAndBusiness(topicID, businessID)
	if err != nil {
		return err
	}

	for _, sub := range subs {
		if sub.FilterExpr != "" {
			if !s.matchFilter(sub.FilterExpr, change) {
				s.logger.Info("subscription filter not matched", zap.String("sub_id", sub.ID))
				continue
			}
		}

		pref, err := s.storage.GetDeliveryPreferenceBySubscriptionID(sub.ID)
		if err != nil || pref == nil {
			continue
		}

		record := &models.DeliveryRecord{
			StatusChangeID: change.ID,
			SubscriptionID: sub.ID,
			Endpoint:       pref.Endpoint,
			AttemptCount:   0,
			Status:         models.DeliveryStatusPending,
			NextAttemptAt:  time.Now(),
		}
		if err := s.storage.CreateDeliveryRecord(record); err != nil {
			s.logger.Error("create delivery record failed", zap.Error(err))
		}

		if err := s.createSnapshot(change, sub.ID, topicID, businessID); err != nil {
			s.logger.Error("create snapshot failed", zap.String("sub_id", sub.ID), zap.Error(err))
		}
	}

	return nil
}

func (s *Service) matchFilter(filterExpr string, change *models.StatusChange) bool {
	if filterExpr == "" {
		return true
	}

	conditions := parseFilterConditions(filterExpr)
	for key, expectedValue := range conditions {
		var actualValue string
		switch key {
		case "to_status":
			actualValue = change.ToStatus
		case "from_status":
			actualValue = change.FromStatus
		case "operator_id":
			actualValue = change.OperatorID
		case "topic_id":
			actualValue = change.TopicID
		default:
			s.logger.Warn("unknown filter key", zap.String("key", key))
			continue
		}

		if actualValue != expectedValue {
			s.logger.Info("filter not matched",
				zap.String("key", key),
				zap.String("expected", expectedValue),
				zap.String("actual", actualValue))
			return false
		}
	}

	return true
}

func parseFilterConditions(expr string) map[string]string {
	result := make(map[string]string)
	conditions := splitAndTrim(expr, ",")

	for _, cond := range conditions {
		parts := splitAndTrim(cond, "=")
		if len(parts) == 2 {
			result[parts[0]] = parts[1]
		}
	}

	return result
}

func splitAndTrim(s, sep string) []string {
	var result []string
	parts := splitIgnoreEmpty(s, sep)
	for _, p := range parts {
		if trimmed := trimSpaces(p); trimmed != "" {
			result = append(result, trimmed)
		}
	}
	return result
}

func splitIgnoreEmpty(s, sep string) []string {
	var result []string
	start := 0
	for i := 0; i <= len(s)-len(sep); i++ {
		if s[i:i+len(sep)] == sep {
			if start < i {
				result = append(result, s[start:i])
			}
			start = i + len(sep)
			i = start - 1
		}
	}
	if start < len(s) {
		result = append(result, s[start:])
	}
	return result
}

func trimSpaces(s string) string {
	start := 0
	for start < len(s) && (s[start] == ' ' || s[start] == '\t') {
		start++
	}
	end := len(s)
	for end > start && (s[end-1] == ' ' || s[end-1] == '\t') {
		end--
	}
	return s[start:end]
}

func (s *Service) createSnapshot(change *models.StatusChange, subscriptionID, topicID, businessID string) error {
	snapshotData := map[string]interface{}{
		"subscription_id": subscriptionID,
		"topic_id":        topicID,
		"business_id":     businessID,
		"change":          change,
		"snapshot_at":     time.Now(),
	}
	dataJSON, _ := json.Marshal(snapshotData)

	snapshot := &models.SubscriptionSnapshot{
		SubscriptionID: subscriptionID,
		TopicID:        topicID,
		BusinessID:     businessID,
		SnapshotAt:     time.Now(),
		SnapshotData:   string(dataJSON),
		Conclusion:     fmt.Sprintf("Status changed from %s to %s by %s", change.FromStatus, change.ToStatus, change.OperatorName),
	}
	return s.storage.CreateSnapshot(snapshot)
}

func (s *Service) ProcessDeliveries() error {
	records, err := s.storage.GetPendingDeliveries()
	if err != nil {
		return err
	}

	for _, record := range records {
		go s.deliveryWorker(record)
	}

	return nil
}

func (s *Service) deliveryWorker(record models.DeliveryRecord) {
	pref, err := s.storage.GetDeliveryPreferenceBySubscriptionID(record.SubscriptionID)
	if err != nil || pref == nil {
		return
	}

	change, err := s.getStatusChange(record.StatusChangeID)
	if err != nil {
		return
	}

	payload := map[string]interface{}{
		"id":            change.ID,
		"business_id":   change.BusinessID,
		"topic_id":      change.TopicID,
		"from_status":   change.FromStatus,
		"to_status":     change.ToStatus,
		"change_reason": change.ChangeReason,
		"operator_id":   change.OperatorID,
		"operator_name": change.OperatorName,
		"created_at":    change.CreatedAt,
	}

	record.AttemptCount++
	record.LastAttemptAt = time.Now()

	respCode, respBody, err := s.sendDelivery(pref, payload)
	record.ResponseCode = respCode
	record.ResponseBody = respBody

	if err != nil {
		record.ErrorMessage = err.Error()
	}

	if respCode >= 200 && respCode < 300 {
		record.Status = models.DeliveryStatusSuccess
		s.logger.Info("delivery success", zap.String("record_id", record.ID), zap.Int("status_code", respCode))
	} else {
		if record.AttemptCount >= pref.RetryCount {
			record.Status = models.DeliveryStatusFailed
			record.ErrorMessage = fmt.Sprintf("Max retry attempts reached. Last error: %s", record.ErrorMessage)
			s.logger.Error("delivery failed after max retries", zap.String("record_id", record.ID), zap.Int("attempts", record.AttemptCount))
		} else {
			record.Status = models.DeliveryStatusRetrying
			record.NextAttemptAt = time.Now().Add(time.Duration(pref.RetryInterval) * time.Second)
			s.logger.Warn("delivery failed, will retry", zap.String("record_id", record.ID), zap.Int("attempt", record.AttemptCount))
		}
	}

	if err := s.storage.UpdateDeliveryRecord(&record); err != nil {
		s.logger.Error("update delivery record failed", zap.Error(err))
	}
}

func (s *Service) sendDelivery(pref *models.DeliveryPreference, payload map[string]interface{}) (int, string, error) {
	jsonPayload, _ := json.Marshal(payload)

	req, err := http.NewRequest(pref.Method, pref.Endpoint, bytes.NewBuffer(jsonPayload))
	if err != nil {
		return 0, "", fmt.Errorf("create request failed: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	if pref.Headers != "" {
		var headers map[string]string
		if json.Unmarshal([]byte(pref.Headers), &headers) == nil {
			for k, v := range headers {
				req.Header.Set(k, v)
			}
		}
	}

	client := &http.Client{
		Timeout: time.Duration(pref.Timeout) * time.Second,
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, "", fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(body), nil
}

func (s *Service) getStatusChange(id string) (*models.StatusChange, error) {
	var change models.StatusChange
	err := s.storage.GetDB().Where("id = ?", id).First(&change).Error
	return &change, err
}

func (s *Service) QueryHistory(req *models.QueryHistoryRequest) (map[string]interface{}, error) {
	var businessID, topicID string

	if req.BusinessType != "" && req.BusinessID != "" {
		business, err := s.storage.GetBusinessObject(req.BusinessType, req.BusinessID)
		if err == nil && business != nil {
			businessID = business.ID
		}
	}

	if req.TopicName != "" {
		topic, err := s.storage.GetTopicByName(req.TopicName)
		if err == nil && topic != nil {
			topicID = topic.ID
		}
	}

	var startTime, endTime time.Time
	if req.StartTime != "" {
		startTime, _ = time.Parse(time.RFC3339, req.StartTime)
	}
	if req.EndTime != "" {
		endTime, _ = time.Parse(time.RFC3339, req.EndTime)
	}

	page := req.Page
	if page == 0 {
		page = 1
	}
	pageSize := req.PageSize
	if pageSize == 0 {
		pageSize = 20
	}

	changes, total, err := s.storage.QueryStatusChanges(businessID, topicID, startTime, endTime, page, pageSize)
	if err != nil {
		return nil, err
	}

	result := make([]map[string]interface{}, 0)
	for _, change := range changes {
		records, _ := s.storage.GetDeliveryRecordsByStatusChangeID(change.ID)
		item := map[string]interface{}{
			"change":           change,
			"delivery_records": records,
		}
		result = append(result, item)
	}

	return map[string]interface{}{
		"items": result,
		"total": total,
		"page":  page,
		"size":  pageSize,
	}, nil
}

func (s *Service) GetSubscription(subID string) (*models.Subscription, *models.DeliveryPreference, error) {
	sub, err := s.storage.GetSubscriptionByID(subID)
	if err != nil {
		return nil, nil, err
	}
	if sub == nil {
		return nil, nil, errors.New("subscription not found")
	}

	pref, err := s.storage.GetDeliveryPreferenceBySubscriptionID(subID)
	if err != nil {
		return sub, nil, nil
	}

	return sub, pref, nil
}

func (s *Service) GetSnapshots(subID string, limit int) ([]models.SubscriptionSnapshot, error) {
	return s.storage.GetSnapshotsBySubscriptionID(subID, limit)
}
