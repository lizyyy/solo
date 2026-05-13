package service

import (
	"fmt"
	"sort"
	"time"

	"multi-cloud-storage-router/internal/model"
	"multi-cloud-storage-router/pkg/errors"
)

type RouterService struct {
	store *Store
}

func NewRouterService(store *Store) *RouterService {
	return &RouterService{store: store}
}

func (s *RouterService) RouteUploadRequest(uploadID string) (*model.Bucket, error) {
	upload, err := s.store.GetUploadRequest(uploadID)
	if err != nil {
		return nil, err
	}

	strategy, err := s.store.GetStrategy(upload.StrategyID)
	if err != nil {
		return nil, err
	}

	bucket, err := s.selectBucket(strategy, 0)
	if err != nil {
		upload.Status = model.UploadStatusFailed
		s.store.UpdateUploadRequest(upload)
		s.store.AddAuditLog(&model.RoutingAudit{
			UploadRequestID: uploadID,
			Operation:       "route",
			Status:          "failed",
			Details:         err.Error(),
		})
		return nil, err
	}

	upload.CurrentBucketID = bucket.ID
	upload.Status = model.UploadStatusRouting
	s.store.UpdateUploadRequest(upload)

	s.store.AddAuditLog(&model.RoutingAudit{
		UploadRequestID: uploadID,
		Operation:       "route",
		Status:          "success",
		Details:         fmt.Sprintf("routed to bucket %s", bucket.ID),
	})

	return bucket, nil
}

func (s *RouterService) selectBucket(strategy *model.RoutingStrategy, retryAttempt int) (*model.Bucket, error) {
	availableBuckets := s.getAvailableBuckets(strategy.BucketIDs)
	if len(availableBuckets) == 0 {
		return nil, errors.New(errors.ErrCodeNoAvailableBucket, "no available buckets")
	}

	switch strategy.Type {
	case model.StrategyTypePriority:
		return s.selectByPriority(availableBuckets, retryAttempt)
	case model.StrategyTypeRoundRobin:
		return s.selectRoundRobin(availableBuckets)
	case model.StrategyTypeWeighted:
		return s.selectByWeight(availableBuckets)
	default:
		return s.selectByPriority(availableBuckets, retryAttempt)
	}
}

func (s *RouterService) getAvailableBuckets(bucketIDs []string) []*model.Bucket {
	var available []*model.Bucket
	for _, id := range bucketIDs {
		bucket, err := s.store.GetBucket(id)
		if err == nil && bucket.Status == model.BucketStatusActive {
			available = append(available, bucket)
		}
	}
	return available
}

func (s *RouterService) selectByPriority(buckets []*model.Bucket, retryAttempt int) (*model.Bucket, error) {
	sort.Slice(buckets, func(i, j int) bool {
		return buckets[i].Priority < buckets[j].Priority
	})

	idx := retryAttempt % len(buckets)
	return buckets[idx], nil
}

func (s *RouterService) selectRoundRobin(buckets []*model.Bucket) (*model.Bucket, error) {
	return buckets[0], nil
}

func (s *RouterService) selectByWeight(buckets []*model.Bucket) (*model.Bucket, error) {
	return buckets[0], nil
}

func (s *RouterService) HandleUploadFailure(uploadID string, reason model.SwitchReason, errorCode, errorMsg string) (*model.Bucket, error) {
	upload, err := s.store.GetUploadRequest(uploadID)
	if err != nil {
		return nil, err
	}

	strategy, err := s.store.GetStrategy(upload.StrategyID)
	if err != nil {
		return nil, err
	}

	switches := s.store.GetRoutingSwitches(uploadID)
	retryAttempt := len(switches)

	if retryAttempt >= strategy.RetryCount {
		upload.Status = model.UploadStatusFailed
		s.store.UpdateUploadRequest(upload)
		s.store.AddAuditLog(&model.RoutingAudit{
			UploadRequestID: uploadID,
			Operation:       "failover",
			Status:          "exhausted",
			Details:         fmt.Sprintf("max retries reached: %d", strategy.RetryCount),
		})
		return nil, errors.NewWithDetails(errors.ErrCodeUploadFailed, "upload failed after max retries", errorMsg)
	}

	fromBucketID := upload.CurrentBucketID
	newBucket, err := s.selectBucket(strategy, retryAttempt+1)
	if err != nil {
		upload.Status = model.UploadStatusFailed
		s.store.UpdateUploadRequest(upload)
		return nil, err
	}

	s.store.AddRoutingSwitch(&model.RoutingSwitch{
		UploadRequestID: uploadID,
		FromBucketID:    fromBucketID,
		ToBucketID:      newBucket.ID,
		Reason:          reason,
		ErrorCode:       errorCode,
		ErrorMessage:    errorMsg,
		RetryAttempt:    retryAttempt + 1,
	})

	upload.CurrentBucketID = newBucket.ID
	upload.Status = model.UploadStatusSwitched
	s.store.UpdateUploadRequest(upload)

	s.store.AddAuditLog(&model.RoutingAudit{
		UploadRequestID: uploadID,
		Operation:       "failover",
		Status:          "switched",
		Details:         fmt.Sprintf("switched from %s to %s, reason: %s", fromBucketID, newBucket.ID, reason),
	})

	return newBucket, nil
}

func (s *RouterService) VerifyChecksum(uploadID string, algorithm model.ChecksumAlgorithm, expectedHash string, actualData []byte) (*model.ChecksumSummary, error) {
	upload, err := s.store.GetUploadRequest(uploadID)
	if err != nil {
		return nil, err
	}

	actualHash := calculateChecksum(actualData, algorithm)
	isValid := actualHash == expectedHash

	now := time.Now()
	summary := &model.ChecksumSummary{
		UploadRequestID: uploadID,
		BucketID:        upload.CurrentBucketID,
		Algorithm:       algorithm,
		ExpectedHash:    expectedHash,
		ActualHash:      actualHash,
		IsValid:         isValid,
		VerifiedAt:      &now,
	}

	s.store.AddChecksumSummary(summary)

	if !isValid {
		s.store.AddAuditLog(&model.RoutingAudit{
			UploadRequestID: uploadID,
			Operation:       "checksum",
			Status:          "failed",
			Details:         fmt.Sprintf("checksum mismatch: expected %s, got %s", expectedHash, actualHash),
		})
		return summary, errors.New(errors.ErrCodeChecksumMismatch, "checksum verification failed")
	}

	s.store.AddAuditLog(&model.RoutingAudit{
		UploadRequestID: uploadID,
		Operation:       "checksum",
		Status:          "success",
	})

	return summary, nil
}

func (s *RouterService) GenerateAccessLink(uploadID string, objectKey string, expiresIn time.Duration) (*model.AccessLink, error) {
	upload, err := s.store.GetUploadRequest(uploadID)
	if err != nil {
		return nil, err
	}

	bucket, err := s.store.GetBucket(upload.CurrentBucketID)
	if err != nil {
		return nil, err
	}

	url := fmt.Sprintf("%s/%s/%s", bucket.Endpoint, bucket.Name, objectKey)
	link := &model.AccessLink{
		UploadRequestID: uploadID,
		BucketID:        bucket.ID,
		ObjectKey:       objectKey,
		URL:             url,
		ExpiresAt:       time.Now().Add(expiresIn),
	}

	s.store.AddAccessLink(link)

	s.store.AddAuditLog(&model.RoutingAudit{
		UploadRequestID: uploadID,
		Operation:       "generate_link",
		Status:          "success",
		Details:         fmt.Sprintf("link generated for %s", objectKey),
	})

	return link, nil
}

func (s *RouterService) CompleteUpload(uploadID string) error {
	upload, err := s.store.GetUploadRequest(uploadID)
	if err != nil {
		return err
	}

	upload.Status = model.UploadStatusSuccess
	s.store.UpdateUploadRequest(upload)

	s.store.AddAuditLog(&model.RoutingAudit{
		UploadRequestID: uploadID,
		Operation:       "complete",
		Status:          "success",
	})

	return nil
}

func (s *RouterService) GetUploadHistory(uploadID string) (map[string]interface{}, error) {
	upload, err := s.store.GetUploadRequest(uploadID)
	if err != nil {
		return nil, err
	}

	history := map[string]interface{}{
		"upload_request":  upload,
		"routing_switches": s.store.GetRoutingSwitches(uploadID),
		"checksum_summary": s.store.GetChecksumSummaries(uploadID),
		"access_links":    s.store.GetAccessLinks(uploadID),
		"audit_logs":      s.store.GetAuditLogs(uploadID),
	}

	return history, nil
}

func (s *RouterService) ListUploadHistory() []map[string]interface{} {
	uploads := s.store.GetAllUploadRequests()
	historyList := make([]map[string]interface{}, 0, len(uploads))

	for _, upload := range uploads {
		history := map[string]interface{}{
			"upload_request":  upload,
			"routing_switches": s.store.GetRoutingSwitches(upload.ID),
			"checksum_summary": s.store.GetChecksumSummaries(upload.ID),
			"access_links":    s.store.GetAccessLinks(upload.ID),
			"audit_logs":      s.store.GetAuditLogs(upload.ID),
		}
		historyList = append(historyList, history)
	}

	return historyList
}
