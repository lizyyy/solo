package services

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"math"
	"net/http"
	"sort"
	"sync"
	"sync/atomic"
	"time"

	"github.com/api-guardian/api-guardian/internal/database"
	"github.com/api-guardian/api-guardian/internal/logger"
	"github.com/api-guardian/api-guardian/internal/models"
	"github.com/api-guardian/api-guardian/internal/tracing"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.uber.org/zap"
	"golang.org/x/time/rate"
	"gorm.io/gorm"
)

type TrafficService struct {
	db         *gorm.DB
	httpClient *http.Client
	running    sync.Map
}

func NewTrafficService() *TrafficService {
	return &TrafficService{
		db: database.GetDB(),
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type TrafficTestContext struct {
	testID      uint
	cancelFunc  context.CancelFunc
	totalReq    int64
	successCount int64
	failureCount int64
	responseTimes []int64
	mu          sync.Mutex
}

func (s *TrafficService) StartTest(ctx context.Context, testID uint) error {
	ctx, span := tracing.Start(ctx, "traffic.start_test")
	defer span.End()

	var test models.TrafficTest
	if err := s.db.First(&test, testID).Error; err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	now := time.Now()
	test.Status = "running"
	test.StartTime = &now
	s.db.Save(&test)

	tracing.AddAttribute(span, "test_id", testID)
	tracing.AddAttribute(span, "concurrent_users", test.ConcurrentUsers)
	tracing.AddAttribute(span, "duration_seconds", test.DurationSeconds)

	testCtx := &TrafficTestContext{
		testID: testID,
	}
	ctxWithTimeout, cancel := context.WithTimeout(ctx, time.Duration(test.DurationSeconds)*time.Second)
	testCtx.cancelFunc = cancel
	s.running.Store(testID, testCtx)

	go s.runTrafficTest(ctxWithTimeout, testCtx, &test)

	return nil
}

func (s *TrafficService) runTrafficTest(ctx context.Context, testCtx *TrafficTestContext, test *models.TrafficTest) {
	logger.Info("Starting traffic test",
		zap.Uint("test_id", test.ID),
		zap.Int("concurrent_users", test.ConcurrentUsers),
		zap.Int("duration_seconds", test.DurationSeconds),
	)

	var wg sync.WaitGroup
	limiter := rate.NewLimiter(rate.Limit(test.ConcurrentUsers), test.ConcurrentUsers)

	requestNum := int64(0)
	ticker := time.NewTicker(10 * time.Millisecond)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			wg.Wait()
			s.finishTest(test)
			return
		case <-ticker.C:
			if err := limiter.Wait(ctx); err != nil {
				continue
			}

			currentReq := atomic.AddInt64(&requestNum, 1)
			if test.RequestsPerUser > 0 && currentReq > int64(test.ConcurrentUsers*test.RequestsPerUser) {
				wg.Wait()
				s.finishTest(test)
				return
			}

			wg.Add(1)
			go func(reqNum int64) {
				defer wg.Done()
				s.makeRequest(ctx, testCtx, test, int(reqNum), 0)
			}(currentReq)
		}
	}
}

func (s *TrafficService) makeRequest(
	ctx context.Context,
	testCtx *TrafficTestContext,
	test *models.TrafficTest,
	requestNum int,
	retryAttempt int,
) {
	startTime := time.Now()
	reqCtx, span := tracing.Start(ctx, "traffic.make_request")
	defer span.End()

	var reqBody io.Reader
	if test.RequestBody != nil {
		bodyBytes, _ := json.Marshal(test.RequestBody)
		reqBody = bytes.NewBuffer(bodyBytes)
	}

	req, err := http.NewRequestWithContext(reqCtx, test.Method, test.TargetURL, reqBody)
	if err != nil {
		s.recordResult(testCtx, test, requestNum, 0, 0, false, err.Error(), retryAttempt)
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return
	}

	req.Header.Set("Content-Type", "application/json")
	for key, value := range test.Headers {
		if strVal, ok := value.(string); ok {
			req.Header.Set(key, strVal)
		}
	}

	tracing.AddAttribute(span, "request_num", requestNum)
	tracing.AddAttribute(span, "retry_attempt", retryAttempt)
	tracing.AddAttribute(span, "url", test.TargetURL)
	tracing.AddAttribute(span, "method", test.Method)

	client := &http.Client{
		Timeout: time.Duration(test.TimeoutMs) * time.Millisecond,
	}

	resp, err := client.Do(req)
	duration := time.Since(startTime)

	var responseTimeMs = duration.Milliseconds()
	var statusCode int
	var isSuccess bool
	var errorMsg string
	var responseBody []byte

	if err != nil {
		errorMsg = err.Error()
		isSuccess = false

		if test.RetryOnFailure && retryAttempt < test.MaxRetries {
			logger.Warn("Request failed, retrying",
				zap.Int("request_num", requestNum),
				zap.Int("retry_attempt", retryAttempt+1),
				zap.Error(err),
			)
			time.Sleep(time.Duration(math.Pow(2, float64(retryAttempt))) * time.Second)
			s.makeRequest(ctx, testCtx, test, requestNum, retryAttempt+1)
			return
		}
	} else {
		defer resp.Body.Close()
		statusCode = resp.StatusCode
		isSuccess = statusCode >= 200 && statusCode < 300
		responseBody, _ = io.ReadAll(resp.Body)
	}

	span.SetAttributes(
		attribute.Int("status_code", statusCode),
		attribute.Int64("response_time_ms", responseTimeMs),
		attribute.Bool("is_success", isSuccess),
	)

	var respBodyMap map[string]interface{}
	if len(responseBody) > 0 {
		json.Unmarshal(responseBody, &respBodyMap)
	}

	s.recordResult(
		testCtx,
		test,
		requestNum,
		statusCode,
		responseTimeMs,
		isSuccess,
		errorMsg,
		retryAttempt,
	)

	result := &models.TrafficTestResult{
		TrafficTestID:  test.ID,
		RequestNumber: requestNum,
		StatusCode:   statusCode,
		ResponseTimeMs: responseTimeMs,
		IsSuccess:  isSuccess,
		ErrorMessage: errorMsg,
		RequestURL: test.TargetURL,
		RequestBody: test.RequestBody,
		ResponseBody: respBodyMap,
		TraceID:    span.SpanContext().TraceID().String(),
		Timestamp:  time.Now(),
		RetryAttempt: retryAttempt,
	}

	s.db.Create(result)

	atomic.AddInt64(&testCtx.totalReq, 1)
	if isSuccess {
		atomic.AddInt64(&testCtx.successCount, 1)
	} else {
		atomic.AddInt64(&testCtx.failureCount, 1)
	}

	testCtx.mu.Lock()
	testCtx.responseTimes = append(testCtx.responseTimes, responseTimeMs)
	testCtx.mu.Unlock()
}

func (s *TrafficService) recordResult(
	testCtx *TrafficTestContext,
	test *models.TrafficTest,
	requestNum int,
	statusCode int,
	responseTimeMs int64,
	isSuccess bool,
	errorMsg string,
	retryAttempt int,
) {
	if isSuccess {
		logger.Debug("Request succeeded",
			zap.Uint("test_id", test.ID),
			zap.Int("request_num", requestNum),
			zap.Int("status_code", statusCode),
			zap.Int64("response_time_ms", responseTimeMs),
		)
	} else {
		logger.Warn("Request failed",
			zap.Uint("test_id", test.ID),
			zap.Int("request_num", requestNum),
			zap.Int("retry_attempt", retryAttempt),
			zap.String("error", errorMsg),
		)
	}
}

func (s *TrafficService) finishTest(test *models.TrafficTest) {
	testCtxVal, ok := s.running.Load(test.ID)
	if !ok {
		return
	}
	testCtx := testCtxVal.(*TrafficTestContext)

	now := time.Now()
	test.Status = "completed"
	test.EndTime = &now
	test.TotalRequests = int(atomic.LoadInt64(&testCtx.totalReq))
	test.SuccessCount = int(atomic.LoadInt64(&testCtx.successCount))
	test.FailureCount = int(atomic.LoadInt64(&testCtx.failureCount))

	if len(testCtx.responseTimes) > 0 {
		var total int64
		for _, rt := range testCtx.responseTimes {
			total += rt
		}
		test.AvgResponseTimeMs = float64(total) / float64(len(testCtx.responseTimes))

		sorted := make([]int64, len(testCtx.responseTimes))
		copy(sorted, testCtx.responseTimes)
		sort.Slice(sorted, func(i, j int) bool { return sorted[i] < sorted[j] })

		p95Index := int(float64(len(sorted)) * 0.95)
		p99Index := int(float64(len(sorted)) * 0.99)

		if p95Index >= 0 && p95Index < len(sorted) {
			test.P95ResponseTimeMs = float64(sorted[p95Index])
		}
		if p99Index >= 0 && p99Index < len(sorted) {
			test.P99ResponseTimeMs = float64(sorted[p99Index])
		}
	}

	s.db.Save(test)
	s.running.Delete(test.ID)

	logger.Info("Traffic test completed",
		zap.Uint("test_id", test.ID),
		zap.Int("total_requests", test.TotalRequests),
		zap.Int("success_count", test.SuccessCount),
		zap.Int("failure_count", test.FailureCount),
		zap.Float64("avg_response_time_ms", test.AvgResponseTimeMs),
		zap.Float64("p95_response_time_ms", test.P95ResponseTimeMs),
		zap.Float64("p99_response_time_ms", test.P99ResponseTimeMs),
	)
}

func (s *TrafficService) StopTest(ctx context.Context, testID uint) error {
	testCtxVal, ok := s.running.Load(testID)
	if !ok {
		return fmt.Errorf("test not running")
	}

	testCtx := testCtxVal.(*TrafficTestContext)
	testCtx.cancelFunc()

	var test models.TrafficTest
	s.db.First(&test, testID)
	now := time.Now()
	test.Status = "stopped"
	test.EndTime = &now
	s.db.Save(&test)

	logger.Info("Traffic test stopped", zap.Uint("test_id", testID))
	return nil
}

func (s *TrafficService) GetTestStatus(ctx context.Context, testID uint) (*models.TrafficTest, error) {
	_, span := tracing.Start(ctx, "traffic.get_status")
	defer span.End()

	var test models.TrafficTest
	if err := s.db.Preload("TrafficTestResults").First(&test, testID).Error; err != nil {
		return nil, err
	}

	return &test, nil
}

func (s *TrafficService) ListTests(ctx context.Context, page, pageSize int) ([]models.TrafficTest, int64, error) {
	_, span := tracing.Start(ctx, "traffic.list_tests")
	defer span.End()

	var tests []models.TrafficTest
	var total int64

	if err := s.db.Model(&models.TrafficTest{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	offset := (page - 1) * pageSize
	if err := s.db.Order("created_at DESC").Offset(offset).Limit(pageSize).Find(&tests).Error; err != nil {
		return nil, 0, err
	}

	return tests, total, nil
}

func (s *TrafficService) CreateTest(ctx context.Context, test *models.TrafficTest) error {
	_, span := tracing.Start(ctx, "traffic.create_test")
	defer span.End()

	if err := s.db.Create(test).Error; err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	tracing.AddAttribute(span, "test_id", test.ID)
	return nil
}
