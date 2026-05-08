package tracer

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/chaos-simulator/chaos-simulator/internal/repository"
	"github.com/chaos-simulator/chaos-simulator/internal/types"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/propagation"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.17.0"
	"go.opentelemetry.io/otel/trace"
	"go.uber.org/zap"
)

type HybridTracer struct {
	repo          *repository.SQLiteRepository
	otelTracer    trace.Tracer
	otelEnabled   bool
	businessEnabled bool
	recordBuffer  []*types.TraceRecord
	bufferMutex   sync.Mutex
	bufferSize    int
	flushInterval time.Duration
}

type TracerConfig struct {
	OTLPEndpoint    string
	ServiceName     string
	OTELEnabled     bool
	BusinessEnabled bool
	BufferSize      int
	FlushInterval   time.Duration
}

func NewHybridTracer(repo *repository.SQLiteRepository, config TracerConfig) (*HybridTracer, error) {
	ht := &HybridTracer{
		repo:            repo,
		otelEnabled:     config.OTELEnabled,
		businessEnabled: config.BusinessEnabled,
		recordBuffer:    make([]*types.TraceRecord, 0),
		bufferSize:      config.BufferSize,
		flushInterval:   config.FlushInterval,
	}

	if ht.bufferSize == 0 {
		ht.bufferSize = 100
	}
	if ht.flushInterval == 0 {
		ht.flushInterval = 5 * time.Second
	}

	if config.OTELEnabled && config.OTLPEndpoint != "" {
		if err := ht.initOTEL(config); err != nil {
			utils.GetLogger().Warn("Failed to initialize OpenTelemetry, continuing with business tracing only", zap.Error(err))
			ht.otelEnabled = false
		}
	}

	go ht.flushLoop()
	return ht, nil
}

func (t *HybridTracer) initOTEL(config TracerConfig) error {
	ctx := context.Background()

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceName(config.ServiceName),
		),
	)
	if err != nil {
		return fmt.Errorf("failed to create resource: %w", err)
	}

	traceExporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint(config.OTLPEndpoint),
	)
	if err != nil {
		return fmt.Errorf("failed to create OTLP exporter: %w", err)
	}

	tracerProvider := sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(traceExporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tracerProvider)
	otel.SetTextMapPropagator(propagation.NewCompositeTextMapPropagator(
		propagation.TraceContext{},
		propagation.Baggage{},
	))

	t.otelTracer = otel.Tracer(config.ServiceName)
	return nil
}

func (t *HybridTracer) StartSpan(ctx context.Context, service, method, traceID string, attempt, maxAttempts int) (context.Context, *Span) {
	span := &Span{
		tracer:     t,
		traceID:    traceID,
		spanID:     utils.NewSpanID(),
		service:    service,
		method:     method,
		attempt:    attempt,
		maxAttempts: maxAttempts,
		startTime:  time.Now(),
		metadata:   make(map[string]string),
	}

	if t.otelEnabled && t.otelTracer != nil {
		var otelSpan trace.Span
		ctx, otelSpan = t.otelTracer.Start(ctx, fmt.Sprintf("%s.%s", service, method),
			trace.WithAttributes(
				attribute.String("trace_id", traceID),
				attribute.Int("attempt", attempt),
				attribute.Int("max_attempts", maxAttempts),
			),
		)
		span.otelSpan = otelSpan
	}

	if t.businessEnabled {
		record := &types.TraceRecord{
			ID:          utils.NewUUID(),
			TraceID:     traceID,
			SpanID:      span.spanID,
			Service:     service,
			Method:      method,
			Status:      "STARTED",
			StartTime:   span.startTime,
			Attempt:     attempt,
			MaxAttempts: maxAttempts,
			Metadata:    make(map[string]string),
		}
		span.record = record
	}

	utils.GetLogger().Info("Span started",
		zap.String("trace_id", traceID),
		zap.String("span_id", span.spanID),
		zap.String("service", service),
		zap.String("method", method),
		zap.Int("attempt", attempt))

	return ctx, span
}

type Span struct {
	tracer      *HybridTracer
	traceID     string
	spanID      string
	parentSpanID string
	service     string
	method      string
	attempt     int
	maxAttempts int
	startTime   time.Time
	otelSpan    trace.Span
	record      *types.TraceRecord
	metadata    map[string]string
	ended       bool
}

func (s *Span) SetAttribute(key, value string) {
	if s.otelSpan != nil {
		s.otelSpan.SetAttributes(attribute.String(key, value))
	}
	if s.metadata != nil {
		s.metadata[key] = value
	}
	if s.record != nil {
		if s.record.Metadata == nil {
			s.record.Metadata = make(map[string]string)
		}
		s.record.Metadata[key] = value
	}
}

func (s *Span) SetError(err error) {
	if s.otelSpan != nil {
		s.otelSpan.RecordError(err)
	}
	if s.record != nil {
		s.record.Error = err.Error()
	}
	utils.GetLogger().Warn("Span error",
		zap.String("trace_id", s.traceID),
		zap.String("span_id", s.spanID),
		zap.Error(err),
		zap.Int("attempt", s.attempt))
}

func (s *Span) End(status string) {
	if s.ended {
		return
	}
	s.ended = true

	endTime := time.Now()
	duration := endTime.Sub(s.startTime).Milliseconds()

	if s.otelSpan != nil {
		s.otelSpan.End()
	}

	if s.record != nil {
		s.record.Status = status
		s.record.EndTime = endTime
		s.record.DurationMS = duration
		s.tracer.bufferRecord(s.record)
	}

	logger := utils.WithTraceID(s.traceID)
	logger.Info("Span ended",
		zap.String("span_id", s.spanID),
		zap.String("service", s.service),
		zap.String("method", s.method),
		zap.String("status", status),
		zap.Int64("duration_ms", duration),
		zap.Int("attempt", s.attempt))
}

func (t *HybridTracer) bufferRecord(record *types.TraceRecord) {
	t.bufferMutex.Lock()
	defer t.bufferMutex.Unlock()

	t.recordBuffer = append(t.recordBuffer, record)

	if len(t.recordBuffer) >= t.bufferSize {
		t.flushBufferLocked()
	}
}

func (t *HybridTracer) flushLoop() {
	ticker := time.NewTicker(t.flushInterval)
	defer ticker.Stop()

	for range ticker.C {
		t.flushBuffer()
	}
}

func (t *HybridTracer) flushBuffer() {
	t.bufferMutex.Lock()
	defer t.bufferMutex.Unlock()
	t.flushBufferLocked()
}

func (t *HybridTracer) flushBufferLocked() {
	if len(t.recordBuffer) == 0 {
		return
	}

	ctx := context.Background()
	for _, record := range t.recordBuffer {
		if err := t.repo.SaveTraceRecord(ctx, record); err != nil {
			utils.GetLogger().Error("Failed to save trace record", zap.Error(err))
		}
	}

	t.recordBuffer = make([]*types.TraceRecord, 0)
}

func (t *HybridTracer) GetTraceRecords(ctx context.Context, traceID string) ([]*types.TraceRecord, error) {
	return t.repo.GetTraceRecords(ctx, traceID)
}

func (t *HybridTracer) Flush() {
	t.flushBuffer()
}
