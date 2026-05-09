package service

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net/http"
	"sync"
	"time"

	"grayscale-simulator/internal/model"
	"grayscale-simulator/pkg/database"
	"grayscale-simulator/pkg/logger"
	"grayscale-simulator/pkg/tracer"
)

type FaultType string

const (
	FaultTypeHighConcurrency FaultType = "high_concurrency"
	FaultTypeTimeout         FaultType = "timeout"
	FaultTypeNetworkError    FaultType = "network_error"
	FaultTypeServiceDown     FaultType = "service_down"
	FaultTypeDataCorruption  FaultType = "data_corruption"
	FaultTypeSlowDBQuery     FaultType = "slow_db_query"
)

type FaultInjectionService struct {
	enabled          bool
	configs          map[int64]*model.FaultInjectionConfig
	activeFaults     map[string]*ActiveFault
	mu               sync.RWMutex
	maxConcurrent    int
	queueSize        int
	minTimeout       time.Duration
	maxTimeout       time.Duration
	timeoutProb      float64
	networkFailProb  float64
	networkRetry     int
	backoffStrategy  string
}

type ActiveFault struct {
	ID         int64
	Name       string
	FaultType  FaultType
	Target     string
	Enabled    bool
	Config     map[string]interface{}
	Probability float64
	ExpiresAt  time.Time
	CreatedAt  time.Time
}

func NewFaultInjectionService(enabled bool, maxConcurrent, queueSize int, minTimeout, maxTimeout string, 
	timeoutProb, networkFailProb float64, networkRetry int, backoffStrategy string) *FaultInjectionService {
	
	minTD, _ := time.ParseDuration(minTimeout)
	maxTD, _ := time.ParseDuration(maxTimeout)
	if minTD <= 0 {
		minTD = 100 * time.Millisecond
	}
	if maxTD <= 0 {
		maxTD = 5 * time.Second
	}

	return &FaultInjectionService{
		enabled:         enabled,
		configs:         make(map[int64]*model.FaultInjectionConfig),
		activeFaults:    make(map[string]*ActiveFault),
		maxConcurrent:   maxConcurrent,
		queueSize:       queueSize,
		minTimeout:      minTD,
		maxTimeout:      maxTD,
		timeoutProb:     timeoutProb,
		networkFailProb: networkFailProb,
		networkRetry:    networkRetry,
		backoffStrategy: backoffStrategy,
	}
}

func (s *FaultInjectionService) CreateFaultConfig(ctx context.Context, name, faultType, targetService string, 
	enabled bool, config map[string]interface{}, probability float64, durationSeconds int, createdBy string) (*model.FaultInjectionConfig, error) {
	
	ctx, span := tracer.StartSpan(ctx, "fault_injection.CreateFaultConfig")
	defer span.End()

	configJSON, _ := json.Marshal(config)
	
	now := time.Now()
	cfg := &model.FaultInjectionConfig{
		Name:            name,
		FaultType:       faultType,
		TargetService:   targetService,
		Enabled:         enabled,
		Config:          configJSON,
		Probability:     probability,
		DurationSeconds: durationSeconds,
		CreatedBy:       createdBy,
		CreatedAt:       now,
		UpdatedAt:       now,
	}

	var id int64
	err := database.QueryRow(`
		INSERT INTO fault_injection_configs (name, fault_type, target_service, enabled, config, probability, duration_seconds, created_by, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
		RETURNING id
	`, cfg.Name, cfg.FaultType, cfg.TargetService, cfg.Enabled, cfg.Config, cfg.Probability,
		cfg.DurationSeconds, cfg.CreatedBy, cfg.CreatedAt, cfg.UpdatedAt).Scan(&id)

	if err != nil {
		return nil, fmt.Errorf("failed to create fault config: %w", err)
	}

	cfg.ID = id
	if enabled {
		s.activateFault(cfg)
	}

	logger.WithFields(map[string]interface{}{
		"fault_id":   id,
		"fault_type": faultType,
		"target":     targetService,
	}).Info("Fault injection config created")

	return cfg, nil
}

func (s *FaultInjectionService) UpdateFaultConfig(ctx context.Context, id int64, enabled bool, probability float64) error {
	ctx, span := tracer.StartSpan(ctx, "fault_injection.UpdateFaultConfig")
	defer span.End()

	now := time.Now()
	_, err := database.Exec(`
		UPDATE fault_injection_configs 
		SET enabled = $1, probability = $2, updated_at = $3 
		WHERE id = $4
	`, enabled, probability, now, id)

	if err != nil {
		return err
	}

	var cfg model.FaultInjectionConfig
	if err := database.Get(&cfg, `SELECT * FROM fault_injection_configs WHERE id = $1`, id); err != nil {
		return err
	}

	if enabled {
		s.activateFault(&cfg)
	} else {
		s.deactivateFault(id)
	}

	return nil
}

func (s *FaultInjectionService) activateFault(cfg *model.FaultInjectionConfig) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var configMap map[string]interface{}
	json.Unmarshal(cfg.Config, &configMap)

	expiresAt := time.Now()
	if cfg.DurationSeconds > 0 {
		expiresAt = expiresAt.Add(time.Duration(cfg.DurationSeconds) * time.Second)
	}

	active := &ActiveFault{
		ID:          cfg.ID,
		Name:        cfg.Name,
		FaultType:   FaultType(cfg.FaultType),
		Target:      cfg.TargetService,
		Enabled:     cfg.Enabled,
		Config:      configMap,
		Probability: cfg.Probability,
		ExpiresAt:   expiresAt,
		CreatedAt:   time.Now(),
	}

	key := fmt.Sprintf("%s:%s", cfg.TargetService, cfg.FaultType)
	s.activeFaults[key] = active

	logger.WithFields(map[string]interface{}{
		"fault_id":   cfg.ID,
		"fault_type": cfg.FaultType,
	}).Info("Fault activated")
}

func (s *FaultInjectionService) deactivateFault(id int64) {
	s.mu.Lock()
	defer s.mu.Unlock()

	for key, fault := range s.activeFaults {
		if fault.ID == id {
			delete(s.activeFaults, key)
			logger.WithField("fault_id", id).Info("Fault deactivated")
			return
		}
	}
}

func (s *FaultInjectionService) GetActiveFault(targetService string) *ActiveFault {
	if !s.enabled {
		return nil
	}

	s.mu.RLock()
	defer s.mu.RUnlock()

	now := time.Now()
	for _, fault := range s.activeFaults {
		if (fault.Target == targetService || fault.Target == "*") && 
		   fault.Enabled && 
		   (fault.ExpiresAt.IsZero() || fault.ExpiresAt.After(now)) {
			
			if rand.Float64() < fault.Probability {
				return fault
			}
		}
	}

	return nil
}

func (s *FaultInjectionService) InjectFault(ctx context.Context, targetService string, handler func() error) error {
	ctx, span := tracer.StartSpan(ctx, "fault_injection.InjectFault")
	defer span.End()

	if !s.enabled {
		return handler()
	}

	fault := s.GetActiveFault(targetService)
	if fault == nil {
		return handler()
	}

	logger.WithFields(map[string]interface{}{
		"fault_type": fault.FaultType,
		"target":     targetService,
	}).Info("Injecting fault")

	switch fault.FaultType {
	case FaultTypeTimeout:
		return s.injectTimeout(ctx, fault, handler)
	case FaultTypeNetworkError:
		return s.injectNetworkError(ctx, fault, handler)
	case FaultTypeServiceDown:
		return s.injectServiceDown(ctx, fault)
	case FaultTypeSlowDBQuery:
		return s.injectSlowDBQuery(ctx, fault, handler)
	case FaultTypeHighConcurrency:
		return s.injectHighConcurrency(ctx, fault, handler)
	default:
		return handler()
	}
}

func (s *FaultInjectionService) injectTimeout(ctx context.Context, fault *ActiveFault, handler func() error) error {
	timeout := s.minTimeout + time.Duration(rand.Int63n(int64(s.maxTimeout-s.minTimeout)))
	
	if customMin, ok := fault.Config["min_timeout"].(string); ok {
		if customMinTD, err := time.ParseDuration(customMin); err == nil {
			timeout = customMinTD
		}
	}
	if customMax, ok := fault.Config["max_timeout"].(string); ok {
		if customMaxTD, err := time.ParseDuration(customMax); err == nil {
			timeout = customMaxTD
		}
	}

	logger.WithField("timeout", timeout).Info("Injecting timeout fault")

	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	done := make(chan error, 1)
	go func() {
		done <- handler()
	}()

	select {
	case err := <-done:
		return err
	case <-ctx.Done():
		return fmt.Errorf("request timeout after %v", timeout)
	}
}

func (s *FaultInjectionService) injectNetworkError(ctx context.Context, fault *ActiveFault, handler func() error) error {
	logger.Info("Injecting network error fault with retry")
	
	backoff := 100 * time.Millisecond
	for attempt := 0; attempt <= s.networkRetry; attempt++ {
		if attempt > 0 {
			logger.WithField("attempt", attempt).Info("Retrying after network error")
			
			switch s.backoffStrategy {
			case "exponential":
				backoff *= 2
			case "linear":
				backoff += 100 * time.Millisecond
			}
			
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(backoff):
			}
		}

		if rand.Float64() < s.networkFailProb {
			logger.WithField("attempt", attempt).Warn("Simulated network failure")
			continue
		}

		return handler()
	}

	return fmt.Errorf("network error after %d retries", s.networkRetry)
}

func (s *FaultInjectionService) injectServiceDown(ctx context.Context, fault *ActiveFault) error {
	logger.Info("Injecting service down fault")
	return fmt.Errorf("service unavailable: %s", fault.Target)
}

func (s *FaultInjectionService) injectSlowDBQuery(ctx context.Context, fault *ActiveFault, handler func() error) error {
	delay := 2 * time.Second
	if d, ok := fault.Config["delay"].(string); ok {
		if delayTD, err := time.ParseDuration(d); err == nil {
			delay = delayTD
		}
	}

	logger.WithField("delay", delay).Info("Injecting slow DB query fault")
	time.Sleep(delay)
	
	return handler()
}

func (s *FaultInjectionService) injectHighConcurrency(ctx context.Context, fault *ActiveFault, handler func() error) error {
	maxConcurrent := s.maxConcurrent
	if mc, ok := fault.Config["max_concurrent"].(float64); ok {
		maxConcurrent = int(mc)
	}

	logger.WithField("max_concurrent", maxConcurrent).Info("Injecting high concurrency fault")
	
	sem := make(chan struct{}, maxConcurrent)
	queue := make(chan struct{}, s.queueSize)
	
	select {
	case queue <- struct{}{}:
		defer func() { <-queue }()
		select {
		case sem <- struct{}{}:
			defer func() { <-sem }()
			return handler()
		case <-ctx.Done():
			return fmt.Errorf("concurrency limit reached, request queued and timed out")
		}
	default:
		return fmt.Errorf("queue full, request rejected (simulated high concurrency)")
	}
}

func (s *FaultInjectionService) ListFaultConfigs(ctx context.Context, targetService string, limit, offset int) ([]*model.FaultInjectionConfig, error) {
	query := `SELECT * FROM fault_injection_configs WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if targetService != "" {
		query += fmt.Sprintf(` AND target_service = $%d`, argIndex)
		args = append(args, targetService)
		argIndex++
	}

	query += ` ORDER BY created_at DESC`

	if limit > 0 {
		query += fmt.Sprintf(` LIMIT $%d`, argIndex)
		args = append(args, limit)
	}

	var configs []*model.FaultInjectionConfig
	if err := database.Select(&configs, query, args...); err != nil {
		return nil, err
	}

	return configs, nil
}

func (s *FaultInjectionService) GetFaultConfigByID(ctx context.Context, id int64) (*model.FaultInjectionConfig, error) {
	var cfg model.FaultInjectionConfig
	if err := database.Get(&cfg, `SELECT * FROM fault_injection_configs WHERE id = $1`, id); err != nil {
		return nil, err
	}
	return &cfg, nil
}

func (s *FaultInjectionService) SimulateRequest(targetService string) (int, error) {
	ctx := context.Background()
	
	var statusCode int
	var err error
	
	err = s.InjectFault(ctx, targetService, func() error {
		statusCode = http.StatusOK
		return nil
	})

	if err != nil {
		switch err.Error() {
		case "request timeout":
			statusCode = http.StatusRequestTimeout
		case "service unavailable":
			statusCode = http.StatusServiceUnavailable
		case "concurrency limit reached":
			statusCode = http.StatusTooManyRequests
		case "queue full":
			statusCode = http.StatusTooManyRequests
		default:
			statusCode = http.StatusInternalServerError
		}
	}

	return statusCode, err
}

