package service

import (
	"api-replay-throttler/internal/model"
	"api-replay-throttler/internal/repository"
	"bytes"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
)

var (
	ErrInvalidInput    = errors.New("invalid input")
	ErrNotFound        = errors.New("resource not found")
	ErrPlanNotRunning  = errors.New("plan is not running")
	ErrPlanAlreadyDone = errors.New("plan already completed or failed")
	ErrTenantNotFound  = errors.New("tenant not found")
	ErrInvalidMethod   = errors.New("invalid HTTP method")
	ErrInvalidURL      = errors.New("invalid URL")
	ErrEmptySamples    = errors.New("samples cannot be empty")
	ErrSampleNotFound  = errors.New("sample not found")
)

type Service struct {
	repo     *repository.Repository
	plans    map[string]*ReplayExecutor
	plansMux sync.RWMutex
}

type ReplayExecutor struct {
	Plan      *model.ReplayPlan
	Rule      *model.ThrottleRule
	Samples   []model.TrafficSample
	StopChan  chan struct{}
	PauseChan chan bool
	running   bool
	paused    bool
	mux       sync.Mutex
	svc       *Service
}

func NewService(repo *repository.Repository) *Service {
	return &Service{
		repo:  repo,
		plans: make(map[string]*ReplayExecutor),
	}
}

func isValidMethod(method string) bool {
	validMethods := map[string]bool{
		http.MethodGet:    true,
		http.MethodPost:   true,
		http.MethodPut:    true,
		http.MethodDelete: true,
		http.MethodPatch:  true,
		http.MethodHead:   true,
	}
	return validMethods[method]
}

func isValidURL(urlStr string) bool {
	if urlStr == "" {
		return false
	}
	parsedURL, err := url.Parse(urlStr)
	if err != nil {
		return false
	}
	if parsedURL.Scheme == "" || parsedURL.Host == "" {
		return false
	}
	return parsedURL.Scheme == "http" || parsedURL.Scheme == "https"
}

func (s *Service) CheckIdempotency(key string) (string, bool, error) {
	record, err := s.repo.CheckIdempotency(key)
	if err != nil {
		return "", false, err
	}
	if record != nil {
		return record.Result, true, nil
	}
	return "", false, nil
}

func (s *Service) SaveIdempotency(key, resource, result string) error {
	return s.repo.SaveIdempotency(key, resource, result)
}

func (s *Service) CreateTenant(name string) (*model.Tenant, error) {
	if name == "" || len(name) > 255 {
		return nil, ErrInvalidInput
	}

	tenant := &model.Tenant{
		ID:        uuid.New().String(),
		Name:      name,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}
	err := s.repo.CreateTenant(tenant)
	return tenant, err
}

func (s *Service) ImportSamples(tenantID string, samples []model.TrafficSample) ([]model.TrafficSample, error) {
	if tenantID == "" {
		return nil, ErrInvalidInput
	}
	if len(samples) == 0 {
		return nil, ErrEmptySamples
	}

	_, err := s.repo.GetTenantByID(tenantID)
	if err != nil {
		return nil, ErrTenantNotFound
	}

	for i := range samples {
		if !isValidMethod(samples[i].Method) {
			return nil, fmt.Errorf("%w: %s", ErrInvalidMethod, samples[i].Method)
		}
		if !isValidURL(samples[i].URL) {
			return nil, fmt.Errorf("%w: %s", ErrInvalidURL, samples[i].URL)
		}

		samples[i].ID = uuid.New().String()
		samples[i].TenantID = tenantID
		samples[i].CreatedAt = time.Now()
		if samples[i].IdempotencyKey == "" {
			samples[i].IdempotencyKey = uuid.New().String()
		}
		if samples[i].Timestamp.IsZero() {
			samples[i].Timestamp = time.Now()
		}
		err := s.repo.CreateSample(&samples[i])
		if err != nil {
			return nil, fmt.Errorf("failed to create sample: %w", err)
		}
	}

	return samples, nil
}

func (s *Service) GetSamples(tenantID string, page, pageSize int) ([]model.TrafficSample, int64, error) {
	offset := (page - 1) * pageSize
	return s.repo.GetSamplesByTenant(tenantID, pageSize, offset)
}

func (s *Service) CreateRule(tenantID, name string, maxRequests, windowSeconds, maxConcurrency int, errorThreshold, backoffMultiplier float64) (*model.ThrottleRule, error) {
	if tenantID == "" || name == "" || len(name) > 255 {
		return nil, ErrInvalidInput
	}
	if maxRequests < 1 || maxRequests > 1000000 {
		return nil, ErrInvalidInput
	}
	if windowSeconds < 1 || windowSeconds > 3600 {
		return nil, ErrInvalidInput
	}
	if maxConcurrency < 1 || maxConcurrency > 1000 {
		return nil, ErrInvalidInput
	}
	if errorThreshold < 0 || errorThreshold > 1 {
		return nil, ErrInvalidInput
	}
	if backoffMultiplier < 1 || backoffMultiplier > 10 {
		return nil, ErrInvalidInput
	}

	_, err := s.repo.GetTenantByID(tenantID)
	if err != nil {
		return nil, ErrTenantNotFound
	}

	rule := &model.ThrottleRule{
		ID:                uuid.New().String(),
		TenantID:          tenantID,
		Name:              name,
		MaxRequests:       maxRequests,
		WindowSeconds:     windowSeconds,
		MaxConcurrency:    maxConcurrency,
		ErrorThreshold:    errorThreshold,
		BackoffMultiplier: backoffMultiplier,
		CreatedAt:         time.Now(),
		UpdatedAt:         time.Now(),
	}

	err = s.repo.CreateRule(rule)
	return rule, err
}

func (s *Service) GetRules(tenantID string) ([]model.ThrottleRule, error) {
	return s.repo.GetRulesByTenant(tenantID)
}

func (s *Service) CreatePlan(tenantID, ruleID, name string) (*model.ReplayPlan, error) {
	if tenantID == "" || ruleID == "" || name == "" || len(name) > 255 {
		return nil, ErrInvalidInput
	}

	_, err := s.repo.GetTenantByID(tenantID)
	if err != nil {
		return nil, ErrTenantNotFound
	}

	_, err = s.repo.GetRuleByID(ruleID)
	if err != nil {
		return nil, ErrNotFound
	}

	plan := &model.ReplayPlan{
		ID:             uuid.New().String(),
		TenantID:       tenantID,
		RuleID:         ruleID,
		Name:           name,
		Status:         model.PlanStatusPending,
		IdempotencyKey: uuid.New().String(),
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	}

	err = s.repo.CreatePlan(plan)
	return plan, err
}

func (s *Service) GetPlans(tenantID string, page, pageSize int) ([]model.ReplayPlan, int64, error) {
	offset := (page - 1) * pageSize
	return s.repo.GetPlansByTenant(tenantID, pageSize, offset)
}

func (s *Service) GetPlan(planID string) (*model.ReplayPlan, error) {
	return s.repo.GetPlanByID(planID)
}

func (s *Service) StartPlan(planID string, sampleIDs []string) (*model.ReplayPlan, error) {
	plan, err := s.repo.GetPlanByID(planID)
	if err != nil {
		return nil, ErrNotFound
	}

	if plan.Status != model.PlanStatusPending {
		return nil, ErrPlanAlreadyDone
	}

	rule, err := s.repo.GetRuleByID(plan.RuleID)
	if err != nil {
		return nil, ErrNotFound
	}

	var samples []model.TrafficSample
	if len(sampleIDs) > 0 {
		var notFoundIDs []string
		for _, id := range sampleIDs {
			sample, err := s.repo.GetSampleByID(id)
			if err != nil {
				notFoundIDs = append(notFoundIDs, id)
			} else {
				samples = append(samples, *sample)
			}
		}
		if len(notFoundIDs) > 0 {
			return nil, fmt.Errorf("%w: %s", ErrSampleNotFound, strings.Join(notFoundIDs, ", "))
		}
	} else {
		sampleList, _, err := s.repo.GetSamplesByTenant(plan.TenantID, 1000, 0)
		if err != nil {
			return nil, err
		}
		samples = sampleList
	}

	if len(samples) == 0 {
		return nil, errors.New("no samples available")
	}

	plan.SampleCount = len(samples)
	plan.Status = model.PlanStatusRunning
	now := time.Now()
	plan.StartTime = &now
	plan.UpdatedAt = time.Now()

	err = s.repo.UpdatePlan(plan)
	if err != nil {
		return nil, err
	}

	executor := &ReplayExecutor{
		Plan:      plan,
		Rule:      rule,
		Samples:   samples,
		StopChan:  make(chan struct{}),
		PauseChan: make(chan bool),
		running:   true,
		paused:    false,
		svc:       s,
	}

	s.plansMux.Lock()
	s.plans[planID] = executor
	s.plansMux.Unlock()

	go s.executeReplay(executor)

	return plan, nil
}

func (s *Service) executeReplay(executor *ReplayExecutor) {
	semaphore := make(chan struct{}, executor.Rule.MaxConcurrency)
	var wg sync.WaitGroup

	ticker := time.NewTicker(time.Duration(executor.Rule.WindowSeconds) * time.Second / time.Duration(executor.Rule.MaxRequests))
	defer ticker.Stop()

	for _, sample := range executor.Samples {
		executor.mux.Lock()
		for executor.paused {
			executor.mux.Unlock()
			time.Sleep(100 * time.Millisecond)
			executor.mux.Lock()
		}
		executor.mux.Unlock()

		select {
		case <-executor.StopChan:
			return
		case <-ticker.C:
		}

		semaphore <- struct{}{}
		wg.Add(1)

		go func(s model.TrafficSample, planID string) {
			defer wg.Done()
			defer func() { <-semaphore }()

			executor.executeSample(s, planID)
		}(sample, executor.Plan.ID)
	}

	wg.Wait()

	executor.Plan.Status = model.PlanStatusCompleted
	now := time.Now()
	executor.Plan.EndTime = &now
	executor.Plan.UpdatedAt = time.Now()
	s.repo.UpdatePlan(executor.Plan)

	s.plansMux.Lock()
	delete(s.plans, executor.Plan.ID)
	s.plansMux.Unlock()
}

func (e *ReplayExecutor) executeSample(sample model.TrafficSample, planID string) {
	startTime := time.Now()
	result := &model.ReplayResult{
		ID:             uuid.New().String(),
		PlanID:         planID,
		SampleID:       sample.ID,
		Status:         model.ResultStatusSuccess,
		StartedAt:      startTime,
		IdempotencyKey: uuid.New().String(),
		CreatedAt:      time.Now(),
	}

	client := &http.Client{
		Timeout: 30 * time.Second,
	}

	var body io.Reader
	if sample.Body != "" {
		body = bytes.NewBufferString(sample.Body)
	}

	req, err := http.NewRequest(sample.Method, sample.URL, body)
	if err != nil {
		result.Status = model.ResultStatusFailed
		result.ErrorCategory = model.ErrorCategoryValidation
		result.ErrorMessage = err.Error()
		result.FinishedAt = time.Now()
		result.DurationMs = time.Since(startTime).Milliseconds()
		e.svc.repo.CreateResult(result)

		e.mux.Lock()
		e.Plan.ProcessedCount++
		e.Plan.ErrorCount++
		e.mux.Unlock()
		e.svc.repo.UpdatePlan(e.Plan)
		return
	}

	if sample.Headers != "" {
		var headers map[string]string
		json.Unmarshal([]byte(sample.Headers), &headers)
		for k, v := range headers {
			req.Header.Set(k, v)
		}
	}

	resp, err := client.Do(req)
	duration := time.Since(startTime).Milliseconds()
	result.DurationMs = duration
	result.FinishedAt = time.Now()

	if err != nil {
		result.Status = model.ResultStatusFailed
		result.ErrorCategory = categorizeError(err)
		result.ErrorMessage = err.Error()
	} else {
		defer resp.Body.Close()
		result.HTTPStatus = resp.StatusCode
		respBody, _ := io.ReadAll(resp.Body)
		result.ResponseBody = string(respBody)

		if resp.StatusCode >= 400 {
			result.Status = model.ResultStatusFailed
			result.ErrorCategory = model.ErrorCategoryHTTP
			result.ErrorMessage = fmt.Sprintf("HTTP %d", resp.StatusCode)
		}
	}

	e.svc.repo.CreateResult(result)

	e.mux.Lock()
	e.Plan.ProcessedCount++
	if result.Status == model.ResultStatusSuccess {
		e.Plan.SuccessCount++
	} else {
		e.Plan.ErrorCount++
	}
	e.mux.Unlock()

	e.svc.repo.UpdatePlan(e.Plan)
}

func categorizeError(err error) string {
	if err, ok := err.(interface{ Timeout() bool }); ok && err.Timeout() {
		return model.ErrorCategoryTimeout
	}
	return model.ErrorCategoryNetwork
}

func (s *Service) PausePlan(planID, reason, pausedBy string) (*model.PausePoint, error) {
	s.plansMux.RLock()
	executor, exists := s.plans[planID]
	s.plansMux.RUnlock()

	if !exists {
		return nil, ErrNotFound
	}

	executor.mux.Lock()
	if !executor.running || executor.paused {
		executor.mux.Unlock()
		return nil, ErrPlanNotRunning
	}
	executor.paused = true
	executor.mux.Unlock()

	executor.Plan.Status = model.PlanStatusPaused
	executor.Plan.UpdatedAt = time.Now()
	s.repo.UpdatePlan(executor.Plan)

	pausePoint := &model.PausePoint{
		ID:        uuid.New().String(),
		PlanID:    planID,
		Reason:    reason,
		PausedAt:  time.Now(),
		PausedBy:  pausedBy,
		CreatedAt: time.Now(),
	}

	err := s.repo.CreatePausePoint(pausePoint)
	return pausePoint, err
}

func (s *Service) ResumePlan(planID string) (*model.ReplayPlan, error) {
	s.plansMux.RLock()
	executor, exists := s.plans[planID]
	s.plansMux.RUnlock()

	if !exists {
		return nil, ErrNotFound
	}

	executor.mux.Lock()
	if !executor.paused {
		executor.mux.Unlock()
		return executor.Plan, nil
	}
	executor.paused = false
	executor.mux.Unlock()

	executor.Plan.Status = model.PlanStatusRunning
	executor.Plan.UpdatedAt = time.Now()
	s.repo.UpdatePlan(executor.Plan)

	pauses, _ := s.repo.GetPausePointsByPlan(planID)
	if len(pauses) > 0 && pauses[0].ResumedAt == nil {
		now := time.Now()
		pauses[0].ResumedAt = &now
		s.repo.UpdatePausePoint(&pauses[0])
	}

	return executor.Plan, nil
}

func (s *Service) GetResults(planID string, page, pageSize int) ([]model.ReplayResult, int64, error) {
	offset := (page - 1) * pageSize
	return s.repo.GetResultsByPlan(planID, pageSize, offset)
}

func (s *Service) GetPlanStatistics(planID string) (map[string]interface{}, error) {
	return s.repo.GetResultStatistics(planID)
}

func (s *Service) ExportResultsCSV(planID string) ([]byte, error) {
	results, err := s.repo.GetAllResultsByPlan(planID)
	if err != nil {
		return nil, err
	}

	var buf bytes.Buffer
	writer := csv.NewWriter(&buf)

	header := []string{"ID", "SampleID", "Status", "HTTPStatus", "ErrorCategory", "ErrorMessage", "DurationMs", "StartedAt", "FinishedAt"}
	writer.Write(header)

	for _, r := range results {
		row := []string{
			r.ID,
			r.SampleID,
			r.Status,
			strconv.Itoa(r.HTTPStatus),
			r.ErrorCategory,
			r.ErrorMessage,
			strconv.FormatInt(r.DurationMs, 10),
			r.StartedAt.Format(time.RFC3339),
			r.FinishedAt.Format(time.RFC3339),
		}
		writer.Write(row)
	}

	writer.Flush()
	return buf.Bytes(), nil
}
