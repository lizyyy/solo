package store

import (
	"encoding/json"
	"errors"
	"sync"

	"strategy-hotload-api/internal/model"
)

var (
	ErrPackageNotFound     = errors.New("package not found")
	ErrVersionNotFound     = errors.New("version not found")
	ErrDuplicateVersion    = errors.New("duplicate version")
	ErrDuplicateRequestID  = errors.New("duplicate request id")
	ErrInvalidStatus       = errors.New("invalid status transition")
)

type Store interface {
	CreatePackage(pkg *model.StrategyPackage) error
	GetPackage(id string) (*model.StrategyPackage, error)
	ListPackages() ([]*model.StrategyPackage, error)
	UpdatePackage(pkg *model.StrategyPackage) error

	CreateRuleVersion(version *model.RuleVersion) error
	GetRuleVersion(id string) (*model.RuleVersion, error)
	GetRuleVersionByPackage(packageID, version string) (*model.RuleVersion, error)
	ListRuleVersions(packageID string) ([]*model.RuleVersion, error)
	UpdateRuleVersion(version *model.RuleVersion) error
	GetLatestPublishedVersion(packageID string) (*model.RuleVersion, error)

	CreateHitRequest(hit *model.HitRequest) error
	GetHitRequest(id string) (*model.HitRequest, error)
	ListHitRequests(packageID string, limit int) ([]*model.HitRequest, error)

	CreateAuditLog(log *model.AuditLog) error
	ListAuditLogs(entityType, entityID string, page, pageSize int) ([]*model.AuditLog, int, error)

	CreateRollbackPoint(point *model.RollbackPoint) error
	GetRollbackPoint(versionID string) (*model.RollbackPoint, error)
}

type MemoryStore struct {
	packages     map[string]*model.StrategyPackage
	versions     map[string]*model.RuleVersion
	versionIndex map[string]map[string]*model.RuleVersion
	hitRequests  map[string]*model.HitRequest
	requestIDMap map[string]bool
	auditLogs    []*model.AuditLog
	rollbackPoints map[string]*model.RollbackPoint

	mu sync.RWMutex
}

func NewMemoryStore() Store {
	return &MemoryStore{
		packages:       make(map[string]*model.StrategyPackage),
		versions:       make(map[string]*model.RuleVersion),
		versionIndex:   make(map[string]map[string]*model.RuleVersion),
		hitRequests:    make(map[string]*model.HitRequest),
		requestIDMap:   make(map[string]bool),
		auditLogs:      make([]*model.AuditLog, 0),
		rollbackPoints: make(map[string]*model.RollbackPoint),
	}
}

func (s *MemoryStore) CreatePackage(pkg *model.StrategyPackage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.packages[pkg.ID] = pkg
	return nil
}

func (s *MemoryStore) GetPackage(id string) (*model.StrategyPackage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	pkg, exists := s.packages[id]
	if !exists {
		return nil, ErrPackageNotFound
	}
	return pkg, nil
}

func (s *MemoryStore) ListPackages() ([]*model.StrategyPackage, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	pkgs := make([]*model.StrategyPackage, 0, len(s.packages))
	for _, pkg := range s.packages {
		pkgs = append(pkgs, pkg)
	}
	return pkgs, nil
}

func (s *MemoryStore) UpdatePackage(pkg *model.StrategyPackage) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.packages[pkg.ID]; !exists {
		return ErrPackageNotFound
	}
	s.packages[pkg.ID] = pkg
	return nil
}

func (s *MemoryStore) CreateRuleVersion(version *model.RuleVersion) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, exists := s.versionIndex[version.PackageID]; !exists {
		s.versionIndex[version.PackageID] = make(map[string]*model.RuleVersion)
	}

	if _, exists := s.versionIndex[version.PackageID][version.Version]; exists {
		return ErrDuplicateVersion
	}

	s.versions[version.ID] = version
	s.versionIndex[version.PackageID][version.Version] = version
	return nil
}

func (s *MemoryStore) GetRuleVersion(id string) (*model.RuleVersion, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	v, exists := s.versions[id]
	if !exists {
		return nil, ErrVersionNotFound
	}
	return v, nil
}

func (s *MemoryStore) GetRuleVersionByPackage(packageID, version string) (*model.RuleVersion, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	if pkgVersions, exists := s.versionIndex[packageID]; exists {
		if v, ok := pkgVersions[version]; ok {
			return v, nil
		}
	}
	return nil, ErrVersionNotFound
}

func (s *MemoryStore) ListRuleVersions(packageID string) ([]*model.RuleVersion, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var versions []*model.RuleVersion
	if pkgVersions, exists := s.versionIndex[packageID]; exists {
		for _, v := range pkgVersions {
			versions = append(versions, v)
		}
	}
	return versions, nil
}

func (s *MemoryStore) UpdateRuleVersion(version *model.RuleVersion) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, exists := s.versions[version.ID]; !exists {
		return ErrVersionNotFound
	}
	s.versions[version.ID] = version
	return nil
}

func (s *MemoryStore) GetLatestPublishedVersion(packageID string) (*model.RuleVersion, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var latest *model.RuleVersion
	if pkgVersions, exists := s.versionIndex[packageID]; exists {
		for _, v := range pkgVersions {
			if v.Status == model.StatusPublished {
				if latest == nil || v.CreatedAt.After(latest.CreatedAt) {
					latest = v
				}
			}
		}
	}
	return latest, nil
}

func (s *MemoryStore) CreateHitRequest(hit *model.HitRequest) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if hit.RequestID != "" {
		if s.requestIDMap[hit.RequestID] {
			return ErrDuplicateRequestID
		}
		s.requestIDMap[hit.RequestID] = true
	}
	s.hitRequests[hit.ID] = hit
	return nil
}

func (s *MemoryStore) GetHitRequest(id string) (*model.HitRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.hitRequests[id], nil
}

func (s *MemoryStore) ListHitRequests(packageID string, limit int) ([]*model.HitRequest, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var hits []*model.HitRequest
	for _, h := range s.hitRequests {
		if h.PackageID == packageID {
			hits = append(hits, h)
		}
	}
	if limit > 0 && len(hits) > limit {
		hits = hits[:limit]
	}
	return hits, nil
}

func (s *MemoryStore) CreateAuditLog(log *model.AuditLog) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.auditLogs = append(s.auditLogs, log)
	return nil
}

func (s *MemoryStore) ListAuditLogs(entityType, entityID string, page, pageSize int) ([]*model.AuditLog, int, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	var logs []*model.AuditLog
	for _, log := range s.auditLogs {
		match := true
		if entityType != "" && log.EntityType != entityType {
			match = false
		}
		if entityID != "" && log.EntityID != entityID {
			match = false
		}
		if match {
			logs = append(logs, log)
		}
	}
	total := len(logs)
	start := (page - 1) * pageSize
	if start < 0 {
		start = 0
	}
	end := start + pageSize
	if end > total {
		end = total
	}
	return logs[start:end], total, nil
}

func (s *MemoryStore) CreateRollbackPoint(point *model.RollbackPoint) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.rollbackPoints[point.VersionID] = point
	return nil
}

func (s *MemoryStore) GetRollbackPoint(versionID string) (*model.RollbackPoint, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.rollbackPoints[versionID], nil
}

func ToMap(v interface{}) map[string]interface{} {
	data, _ := json.Marshal(v)
	var m map[string]interface{}
	json.Unmarshal(data, &m)
	return m
}
