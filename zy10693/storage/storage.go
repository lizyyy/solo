package storage

import (
	"errors"
	"grayscale-pause-recovery/models"
	"sync"
)

var (
	ErrBatchNotFound = errors.New("batch not found")
	ErrBatchExists   = errors.New("batch already exists")
)

type Storage interface {
	CreateBatch(batch *models.Batch) error
	GetBatch(appName string, batchNo int) (*models.Batch, error)
	UpdateBatch(batch *models.Batch) error
	ListBatches(appName string) ([]*models.Batch, error)
}

type MemoryStorage struct {
	mu     sync.RWMutex
	batches map[string]map[int]*models.Batch
}

func NewMemoryStorage() *MemoryStorage {
	return &MemoryStorage{
		batches: make(map[string]map[int]*models.Batch),
	}
}

func (s *MemoryStorage) CreateBatch(batch *models.Batch) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.batches[batch.AppName]; !ok {
		s.batches[batch.AppName] = make(map[int]*models.Batch)
	}

	if _, ok := s.batches[batch.AppName][batch.BatchNo]; ok {
		return ErrBatchExists
	}

	s.batches[batch.AppName][batch.BatchNo] = batch
	return nil
}

func (s *MemoryStorage) GetBatch(appName string, batchNo int) (*models.Batch, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	appBatches, ok := s.batches[appName]
	if !ok {
		return nil, ErrBatchNotFound
	}

	batch, ok := appBatches[batchNo]
	if !ok {
		return nil, ErrBatchNotFound
	}

	return batch, nil
}

func (s *MemoryStorage) UpdateBatch(batch *models.Batch) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	appBatches, ok := s.batches[batch.AppName]
	if !ok {
		return ErrBatchNotFound
	}

	if _, ok := appBatches[batch.BatchNo]; !ok {
		return ErrBatchNotFound
	}

	s.batches[batch.AppName][batch.BatchNo] = batch
	return nil
}

func (s *MemoryStorage) ListBatches(appName string) ([]*models.Batch, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	appBatches, ok := s.batches[appName]
	if !ok {
		return []*models.Batch{}, nil
	}

	batches := make([]*models.Batch, 0, len(appBatches))
	for _, batch := range appBatches {
		batches = append(batches, batch)
	}

	return batches, nil
}
