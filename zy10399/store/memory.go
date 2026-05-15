package store

import (
	"config-rollback-api/model"
	"errors"
	"sync"
	"time"
)

type MemoryStore struct {
	releases      map[string]*model.ConfigRelease
	baselines     map[string]*model.BaselineWindow
	thresholds    map[string]*model.AnomalyThreshold
	rollbacks     map[string]*model.RollbackAction
	decisions     map[string]*model.DecisionRecord
	idempotentMap map[string]string
	mu            sync.RWMutex
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{
		releases:      make(map[string]*model.ConfigRelease),
		baselines:     make(map[string]*model.BaselineWindow),
		thresholds:    make(map[string]*model.AnomalyThreshold),
		rollbacks:     make(map[string]*model.RollbackAction),
		decisions:     make(map[string]*model.DecisionRecord),
		idempotentMap: make(map[string]string),
	}
}

func (s *MemoryStore) CheckIdempotent(key string) (string, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	id, exists := s.idempotentMap[key]
	return id, exists
}

func (s *MemoryStore) RegisterIdempotent(key, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.idempotentMap[key] = id
}

func (s *MemoryStore) CreateRelease(release *model.ConfigRelease) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.releases[release.ID]; exists {
		return errors.New("release already exists")
	}
	s.releases[release.ID] = release
	return nil
}

func (s *MemoryStore) GetRelease(id string) (*model.ConfigRelease, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	release, exists := s.releases[id]
	if !exists {
		return nil, errors.New("release not found")
	}
	return release, nil
}

func (s *MemoryStore) UpdateReleaseStatus(id string, status model.ReleaseStatus) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	release, exists := s.releases[id]
	if !exists {
		return errors.New("release not found")
	}
	release.Status = status
	release.UpdatedAt = time.Now()
	return nil
}

func (s *MemoryStore) UpdateRelease(id string, updater func(*model.ConfigRelease)) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	release, exists := s.releases[id]
	if !exists {
		return errors.New("release not found")
	}
	updater(release)
	release.UpdatedAt = time.Now()
	return nil
}

func (s *MemoryStore) ListReleases() []*model.ConfigRelease {
	s.mu.RLock()
	defer s.mu.RUnlock()
	releases := make([]*model.ConfigRelease, 0, len(s.releases))
	for _, r := range s.releases {
		releases = append(releases, r)
	}
	return releases
}

func (s *MemoryStore) CreateBaseline(baseline *model.BaselineWindow) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.baselines[baseline.ID] = baseline
	return nil
}

func (s *MemoryStore) GetBaseline(id string) (*model.BaselineWindow, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	baseline, exists := s.baselines[id]
	if !exists {
		return nil, errors.New("baseline not found")
	}
	return baseline, nil
}

func (s *MemoryStore) GetBaselineByRelease(releaseID string) (*model.BaselineWindow, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, b := range s.baselines {
		if b.ReleaseID == releaseID {
			return b, nil
		}
	}
	return nil, errors.New("baseline not found")
}

func (s *MemoryStore) CreateThreshold(threshold *model.AnomalyThreshold) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.thresholds[threshold.ID] = threshold
	return nil
}

func (s *MemoryStore) GetThreshold(id string) (*model.AnomalyThreshold, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	threshold, exists := s.thresholds[id]
	if !exists {
		return nil, errors.New("threshold not found")
	}
	return threshold, nil
}

func (s *MemoryStore) GetThresholdByRelease(releaseID string) (*model.AnomalyThreshold, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, t := range s.thresholds {
		if t.ReleaseID == releaseID {
			return t, nil
		}
	}
	return nil, errors.New("threshold not found")
}

func (s *MemoryStore) CreateRollback(rollback *model.RollbackAction) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rollbacks[rollback.ID] = rollback
	return nil
}

func (s *MemoryStore) GetRollbackByRelease(releaseID string) (*model.RollbackAction, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	for _, r := range s.rollbacks {
		if r.ReleaseID == releaseID {
			return r, nil
		}
	}
	return nil, errors.New("rollback not found")
}

func (s *MemoryStore) CreateDecision(decision *model.DecisionRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.decisions[decision.ID] = decision
	return nil
}

func (s *MemoryStore) GetDecisionsByRelease(releaseID string) []*model.DecisionRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()
	decisions := make([]*model.DecisionRecord, 0)
	for _, d := range s.decisions {
		if d.ReleaseID == releaseID {
			decisions = append(decisions, d)
		}
	}
	return decisions
}

func (s *MemoryStore) ListAllDecisions() []*model.DecisionRecord {
	s.mu.RLock()
	defer s.mu.RUnlock()
	decisions := make([]*model.DecisionRecord, 0, len(s.decisions))
	for _, d := range s.decisions {
		decisions = append(decisions, d)
	}
	return decisions
}
