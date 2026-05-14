package service

import (
	"crypto/md5"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"sync"
	"time"

	"multi-cloud-storage-router/internal/model"
	"multi-cloud-storage-router/pkg/errors"
)

type Store struct {
	mu              sync.RWMutex
	buckets         map[string]*model.Bucket
	strategies      map[string]*model.RoutingStrategy
	uploadRequests  map[string]*model.UploadRequest
	idempotencyMap  map[string]*model.UploadRequest
	routingSwitches map[string][]*model.RoutingSwitch
	checksumSummary map[string][]*model.ChecksumSummary
	accessLinks     map[string][]*model.AccessLink
	auditLogs       map[string][]*model.RoutingAudit
	roundRobinIndex map[string]int
}

func NewStore() *Store {
	return &Store{
		buckets:         make(map[string]*model.Bucket),
		strategies:      make(map[string]*model.RoutingStrategy),
		uploadRequests:  make(map[string]*model.UploadRequest),
		idempotencyMap:  make(map[string]*model.UploadRequest),
		routingSwitches: make(map[string][]*model.RoutingSwitch),
		checksumSummary: make(map[string][]*model.ChecksumSummary),
		accessLinks:     make(map[string][]*model.AccessLink),
		auditLogs:       make(map[string][]*model.RoutingAudit),
		roundRobinIndex: make(map[string]int),
	}
}

func (s *Store) CreateBucket(bucket *model.Bucket) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	bucket.ID = fmt.Sprintf("bkt_%d", time.Now().UnixNano())
	bucket.CreatedAt = time.Now()
	bucket.UpdatedAt = time.Now()
	s.buckets[bucket.ID] = bucket
	return nil
}

func (s *Store) GetBucket(id string) (*model.Bucket, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	bucket, exists := s.buckets[id]
	if !exists {
		return nil, errors.New(errors.ErrCodeBucketNotFound, "bucket not found")
	}
	return bucket, nil
}

func (s *Store) ListBuckets() []*model.Bucket {
	s.mu.RLock()
	defer s.mu.RUnlock()
	buckets := make([]*model.Bucket, 0, len(s.buckets))
	for _, b := range s.buckets {
		buckets = append(buckets, b)
	}
	return buckets
}

func (s *Store) CreateStrategy(strategy *model.RoutingStrategy) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	strategy.ID = fmt.Sprintf("strat_%d", time.Now().UnixNano())
	strategy.CreatedAt = time.Now()
	strategy.UpdatedAt = time.Now()
	s.strategies[strategy.ID] = strategy
	return nil
}

func (s *Store) GetStrategy(id string) (*model.RoutingStrategy, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	strategy, exists := s.strategies[id]
	if !exists {
		return nil, errors.New(errors.ErrCodeStrategyNotFound, "strategy not found")
	}
	return strategy, nil
}

func (s *Store) CreateUploadRequest(req *model.UploadRequest) (*model.UploadRequest, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if req.IdempotencyKey != "" {
		if existing, exists := s.idempotencyMap[req.IdempotencyKey]; exists {
			if existing.FileName != req.FileName ||
				existing.FileSize != req.FileSize ||
				existing.ContentType != req.ContentType ||
				existing.StrategyID != req.StrategyID {
				return nil, errors.New(errors.ErrCodeIdempotencyConflict, "idempotency key conflict with different request content")
			}
			return existing, nil
		}
	}

	req.ID = fmt.Sprintf("upload_%d", time.Now().UnixNano())
	req.RequestID = fmt.Sprintf("req_%d", time.Now().UnixNano())
	req.Status = model.UploadStatusPending
	req.CreatedAt = time.Now()
	req.UpdatedAt = time.Now()
	s.uploadRequests[req.ID] = req

	if req.IdempotencyKey != "" {
		s.idempotencyMap[req.IdempotencyKey] = req
	}

	return req, nil
}

func (s *Store) GetAndIncrementRoundRobinIndex(strategyID string) int {
	s.mu.Lock()
	defer s.mu.Unlock()
	idx := s.roundRobinIndex[strategyID]
	s.roundRobinIndex[strategyID] = idx + 1
	return idx
}

func (s *Store) GetUploadRequest(id string) (*model.UploadRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	req, exists := s.uploadRequests[id]
	if !exists {
		return nil, errors.New(errors.ErrCodeNotFound, "upload request not found")
	}
	return req, nil
}

func (s *Store) UpdateUploadRequest(req *model.UploadRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	req.UpdatedAt = time.Now()
	s.uploadRequests[req.ID] = req
	return nil
}

func (s *Store) GetUploadByRequestID(requestID string) (*model.UploadRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, req := range s.uploadRequests {
		if req.RequestID == requestID {
			return req, nil
		}
	}
	return nil, errors.New(errors.ErrCodeNotFound, "upload request not found")
}

func (s *Store) AddRoutingSwitch(sw *model.RoutingSwitch) {
	s.mu.Lock()
	defer s.mu.Unlock()
	sw.ID = fmt.Sprintf("sw_%d", time.Now().UnixNano())
	sw.CreatedAt = time.Now()
	s.routingSwitches[sw.UploadRequestID] = append(s.routingSwitches[sw.UploadRequestID], sw)
}

func (s *Store) GetRoutingSwitches(uploadID string) []*model.RoutingSwitch {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.routingSwitches[uploadID]
}

func (s *Store) AddChecksumSummary(summary *model.ChecksumSummary) {
	s.mu.Lock()
	defer s.mu.Unlock()
	summary.ID = fmt.Sprintf("cs_%d", time.Now().UnixNano())
	summary.CreatedAt = time.Now()
	s.checksumSummary[summary.UploadRequestID] = append(s.checksumSummary[summary.UploadRequestID], summary)
}

func (s *Store) GetChecksumSummaries(uploadID string) []*model.ChecksumSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.checksumSummary[uploadID]
}

func (s *Store) AddAccessLink(link *model.AccessLink) {
	s.mu.Lock()
	defer s.mu.Unlock()
	link.ID = fmt.Sprintf("link_%d", time.Now().UnixNano())
	link.CreatedAt = time.Now()
	s.accessLinks[link.UploadRequestID] = append(s.accessLinks[link.UploadRequestID], link)
}

func (s *Store) GetAccessLinks(uploadID string) []*model.AccessLink {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.accessLinks[uploadID]
}

func (s *Store) AddAuditLog(audit *model.RoutingAudit) {
	s.mu.Lock()
	defer s.mu.Unlock()
	audit.ID = fmt.Sprintf("audit_%d", time.Now().UnixNano())
	audit.CreatedAt = time.Now()
	s.auditLogs[audit.UploadRequestID] = append(s.auditLogs[audit.UploadRequestID], audit)
}

func (s *Store) GetAuditLogs(uploadID string) []*model.RoutingAudit {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.auditLogs[uploadID]
}

func (s *Store) GetAllUploadRequests() []*model.UploadRequest {
	s.mu.RLock()
	defer s.mu.RUnlock()
	reqs := make([]*model.UploadRequest, 0, len(s.uploadRequests))
	for _, req := range s.uploadRequests {
		reqs = append(reqs, req)
	}
	return reqs
}

func generateID(prefix string) string {
	return fmt.Sprintf("%s_%d", prefix, time.Now().UnixNano())
}

func calculateChecksum(data []byte, algorithm model.ChecksumAlgorithm) string {
	switch algorithm {
	case model.ChecksumMD5:
		hash := md5.Sum(data)
		return hex.EncodeToString(hash[:])
	case model.ChecksumSHA1:
		hash := sha1.Sum(data)
		return hex.EncodeToString(hash[:])
	case model.ChecksumSHA256:
		hash := sha256.Sum256(data)
		return hex.EncodeToString(hash[:])
	default:
		return ""
	}
}
