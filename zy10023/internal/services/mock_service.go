package services

import (
	"context"
	"encoding/json"
	"fmt"
	"math/rand"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/api-guardian/api-guardian/internal/config"
	"github.com/api-guardian/api-guardian/internal/database"
	"github.com/api-guardian/api-guardian/internal/logger"
	"github.com/api-guardian/api-guardian/internal/models"
	"github.com/api-guardian/api-guardian/internal/tracing"
	"github.com/go-chi/chi/v5"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type MockService struct {
	db       *gorm.DB
	cfg      config.MockConfig
	router   *chi.Mux
	mappings sync.Map
	server   *http.Server
}

func NewMockService(cfg config.MockConfig) *MockService {
	return &MockService{
		db:     database.GetDB(),
		cfg:    cfg,
		router: chi.NewRouter(),
	}
}

func (s *MockService) LoadMappings(ctx context.Context) error {
	_, span := tracing.Start(ctx, "mock.load_mappings")
	defer span.End()

	var apis []models.APIDefinition
	if err := s.db.Preload("MockResponses").Where("is_active = ?", true).Find(&apis).Error; err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, err.Error())
		return err
	}

	for _, api := range apis {
		key := s.buildMappingKey(api.Method, api.Path)
		s.mappings.Store(key, &api)
		logger.Info("Loaded mock mapping",
			zap.String("method", api.Method),
			zap.String("path", api.Path),
			zap.Int("mock_responses", len(api.MockResponses)),
		)
	}

	tracing.AddAttribute(span, "mappings_loaded", len(apis))
	return nil
}

func (s *MockService) buildMappingKey(method, path string) string {
	return fmt.Sprintf("%s:%s", strings.ToUpper(method), path)
}

func (s *MockService) findMapping(method, path string) (*models.APIDefinition, bool) {
	if api, ok := s.mappings.Load(s.buildMappingKey(method, path)); ok {
		return api.(*models.APIDefinition), true
	}

	return nil, false
}

func (s *MockService) SelectMockResponse(ctx context.Context, api *models.APIDefinition, requestBody []byte) *models.MockResponse {
	_, span := tracing.Start(ctx, "mock.select_response")
	defer span.End()

	if len(api.MockResponses) == 0 {
		return nil
	}

	for _, resp := range api.MockResponses {
		if resp.IsDefault {
			return &resp
		}
	}

	return &api.MockResponses[0]
}

func (s *MockService) ApplyFaultInjection(ctx context.Context, mockResp *models.MockResponse) error {
	if mockResp.FaultInjection == nil || !mockResp.FaultInjection.Enabled {
		return nil
	}

	_, span := tracing.Start(ctx, "mock.fault_injection")
	defer span.End()

	rand.New(rand.NewSource(time.Now().UnixNano()))

	if mockResp.FaultInjection.DisconnectRate > 0 {
		if rand.Float64() < mockResp.FaultInjection.DisconnectRate {
			span.SetAttributes(attribute.String("fault_type", "disconnect"))
			span.SetStatus(codes.Error, "connection dropped")
			return &net.OpError{Op: "read", Err: fmt.Errorf("connection reset by peer")}
		}
	}

	if mockResp.FaultInjection.TimeoutMs > 0 {
		delay := time.Duration(mockResp.FaultInjection.TimeoutMs) * time.Millisecond
		span.SetAttributes(attribute.Int64("timeout_ms", int64(mockResp.FaultInjection.TimeoutMs)))
		time.Sleep(delay)
	}

	if mockResp.FaultInjection.ErrorRate > 0 {
		if rand.Float64() < mockResp.FaultInjection.ErrorRate {
			span.SetAttributes(
				attribute.String("fault_type", "error"),
				attribute.Int("error_status_code", mockResp.FaultInjection.ErrorStatusCode),
			)
			mockResp.StatusCode = mockResp.FaultInjection.ErrorStatusCode
		}
	}

	return nil
}

func (s *MockService) HandleRequest(w http.ResponseWriter, r *http.Request) {
	startTime := time.Now()
	ctx := r.Context()

	ctx, span := tracing.Start(ctx, "mock.handle_request")
	defer span.End()

	method := r.Method
	path := r.URL.Path

	logger.Info("Mock request received",
		zap.String("method", method),
		zap.String("path", path),
		zap.String("remote_addr", r.RemoteAddr),
	)

	span.SetAttributes(
		attribute.String("http.method", method),
		attribute.String("http.path", path),
	)

	api, found := s.findMapping(method, path)
	if !found {
		s.writeErrorResponse(w, http.StatusNotFound, "API mapping not found")
		span.SetStatus(codes.Error, "mapping not found")
		return
	}

	mockResp := s.SelectMockResponse(ctx, api, nil)
	if mockResp == nil {
		s.writeErrorResponse(w, http.StatusNotFound, "No mock response configured")
		span.SetStatus(codes.Error, "no mock response")
		return
	}

	if mockResp.DelayMs > 0 {
		delay := time.Duration(mockResp.DelayMs) * time.Millisecond
		span.SetAttributes(attribute.Int64("delay_ms", int64(mockResp.DelayMs)))
		time.Sleep(delay)
	}

	if err := s.ApplyFaultInjection(ctx, mockResp); err != nil {
		logger.Error("Fault injection triggered disconnect", zap.Error(err))
		s.writeErrorResponse(w, http.StatusServiceUnavailable, "Service unavailable")
		return
	}

	responseBody, _ := json.Marshal(mockResp.ResponseBody)

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("X-Mock-Service", "api-guardian")
	for key, values := range mockResp.Headers {
		if strVal, ok := values.(string); ok {
			w.Header().Set(key, strVal)
		}
	}

	w.WriteHeader(mockResp.StatusCode)
	w.Write(responseBody)

	duration := time.Since(startTime)
	logger.Info("Mock response sent",
		zap.Int("status_code", mockResp.StatusCode),
		zap.Duration("duration", duration),
		zap.String("trace_id", span.SpanContext().TraceID().String()),
	)

	span.SetAttributes(
		attribute.Int("http.status_code", mockResp.StatusCode),
		attribute.Int64("duration_ms", duration.Milliseconds()),
	)

	traceService := tracing.NewTraceService()
	traceService.RecordSpan(
		ctx,
		"mock-service",
		fmt.Sprintf("%s %s", method, path),
		map[string]interface{}{
			"api_id":      api.ID,
			"mock_id":     mockResp.ID,
			"status_code": mockResp.StatusCode,
		},
		duration,
		mockResp.StatusCode >= 400,
		"",
	)
}

func (s *MockService) writeErrorResponse(w http.ResponseWriter, statusCode int, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"error":   true,
		"message": message,
		"code":    statusCode,
	})
}

func (s *MockService) RegisterRoutes() {
	s.router.HandleFunc("/*", s.HandleRequest)
}

func (s *MockService) Start(port int) error {
	s.RegisterRoutes()

	addr := fmt.Sprintf(":%d", port)
	s.server = &http.Server{
		Addr:    addr,
		Handler: s.router,
	}

	logger.Info("Starting mock service", zap.String("addr", addr))
	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("Mock server error", zap.Error(err))
		}
	}()

	return nil
}

func (s *MockService) Stop(ctx context.Context) error {
	if s.server != nil {
		return s.server.Shutdown(ctx)
	}
	return nil
}

func (s *MockService) AddMapping(ctx context.Context, api *models.APIDefinition) error {
	if api == nil {
		return fmt.Errorf("api definition is nil")
	}
	key := s.buildMappingKey(api.Method, api.Path)
	s.mappings.Store(key, api)
	logger.Info("Added mock mapping",
		zap.String("key", key),
		zap.String("method", api.Method),
		zap.String("path", api.Path),
		zap.Int("mock_responses", len(api.MockResponses)),
	)
	return nil
}

func (s *MockService) UpdateMapping(ctx context.Context, api *models.APIDefinition) error {
	if api == nil {
		return fmt.Errorf("api definition is nil")
	}
	key := s.buildMappingKey(api.Method, api.Path)
	s.mappings.Store(key, api)
	logger.Info("Updated mock mapping",
		zap.String("key", key),
		zap.String("method", api.Method),
		zap.String("path", api.Path),
	)
	return nil
}

func (s *MockService) RemoveMapping(ctx context.Context, method, path string) error {
	key := s.buildMappingKey(method, path)
	s.mappings.Delete(key)
	logger.Info("Removed mock mapping", zap.String("key", key))
	return nil
}

func (s *MockService) RemoveMappingByID(ctx context.Context, apiID uint) error {
	var found bool
	s.mappings.Range(func(key, value interface{}) bool {
		api := value.(*models.APIDefinition)
		if api.ID == apiID {
			s.mappings.Delete(key)
			found = true
			return false
		}
		return true
	})
	if found {
		logger.Info("Removed mock mapping by ID", zap.Uint("api_id", apiID))
	}
	return nil
}

func (s *MockService) RefreshMapping(ctx context.Context, apiID uint) error {
	var api models.APIDefinition
	if err := s.db.Preload("MockResponses").First(&api, apiID).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			s.RemoveMappingByID(ctx, apiID)
			return nil
		}
		return err
	}

	if !api.IsActive {
		s.RemoveMappingByID(ctx, apiID)
		return nil
	}

	key := s.buildMappingKey(api.Method, api.Path)
	s.mappings.Store(key, &api)
	logger.Info("Refreshed mock mapping",
		zap.Uint("api_id", apiID),
		zap.String("method", api.Method),
		zap.String("path", api.Path),
		zap.Int("mock_responses", len(api.MockResponses)),
	)
	return nil
}

func (s *MockService) GetAllMappings(ctx context.Context) ([]models.APIDefinition, error) {
	var apis []models.APIDefinition
	err := s.db.Preload("MockResponses").Where("is_active = ?", true).Find(&apis).Error
	return apis, err
}
