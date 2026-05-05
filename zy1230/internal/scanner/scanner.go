package scanner

import (
	"fmt"
	"path/filepath"
	"time"

	"go-policy-scanner/internal/checker"
	"go-policy-scanner/internal/config"
	"go-policy-scanner/internal/storage"
	"go-policy-scanner/pkg/model"
)

type Scanner struct {
	rootDir      string
	policyPath   string
	storage      *storage.SQLiteStorage
	policy       *model.ServicePolicy
}

type ScanConfig struct {
	RootDir        string
	PolicyPath     string
	DBPath         string
	ParallelChecks bool
}

func NewScanner(cfg *ScanConfig) (*Scanner, error) {
	absRoot, err := filepath.Abs(cfg.RootDir)
	if err != nil {
		return nil, fmt.Errorf("failed to get absolute root path: %w", err)
	}

	store, err := storage.NewSQLiteStorage(cfg.DBPath)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize storage: %w", err)
	}

	var policy *model.ServicePolicy
	if cfg.PolicyPath != "" {
		absPolicyPath, err := filepath.Abs(cfg.PolicyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to get absolute policy path: %w", err)
		}
		policy, err = config.LoadServicePolicy(absPolicyPath)
		if err != nil {
			return nil, fmt.Errorf("failed to load policy: %w", err)
		}
	} else {
		policy = config.DefaultServicePolicy()
	}

	return &Scanner{
		rootDir:    absRoot,
		policyPath: cfg.PolicyPath,
		storage:    store,
		policy:     policy,
	}, nil
}

func (s *Scanner) Scan() (*model.ScanResult, error) {
	scanStart := time.Now()

	allViolations := []model.Violation{}
	totalChecks := 0
	failedChecks := 0
	violationsByType := make(map[string]int)

	moduleScanner := checker.NewModuleScanner(s.rootDir)
	moduleInfo, err := moduleScanner.Scan()
	if err != nil {
		return nil, fmt.Errorf("failed to scan modules: %w", err)
	}

	checks := []struct {
		name    string
		checker checker.Checker
	}{
		{"cyclic_dependency", checker.NewCyclicDependencyChecker(moduleInfo)},
		{"cross_layer", checker.NewCrossLayerChecker(moduleInfo, s.policy)},
		{"dependency_count", checker.NewDependencyCountChecker(moduleInfo, s.policy.CheckRules.MaxAllowedDependencies)},
	}

	for _, check := range checks {
		totalChecks++
		violations, err := check.checker.Check()
		if err != nil {
			return nil, fmt.Errorf("%s check failed: %w", check.name, err)
		}

		for i := range violations {
			violations[i].Type = check.name
		}

		allViolations = append(allViolations, violations...)
		if len(violations) > 0 {
			failedChecks++
			violationsByType[check.name] = len(violations)
		}
	}

	_ = scanStart

	result := &model.ScanResult{
		RepoName: s.policy.ProjectName,
		Branch:   "unknown",
		Commit:   "unknown",
		Summary: model.Summary{
			TotalChecks:       totalChecks,
			PassedChecks:      totalChecks - failedChecks,
			FailedChecks:      failedChecks,
			ViolationsByType:  violationsByType,
		},
	}

	scanResultID, err := s.storage.SaveScanResult(result)
	if err != nil {
		return nil, fmt.Errorf("failed to save scan result: %w", err)
	}

	if err := s.storage.SaveViolations(scanResultID, allViolations); err != nil {
		return nil, fmt.Errorf("failed to save violations: %w", err)
	}

	result.ID = scanResultID
	return result, nil
}

func (s *Scanner) Close() error {
	return s.storage.Close()
}

func (s *Scanner) GetStorage() *storage.SQLiteStorage {
	return s.storage
}
