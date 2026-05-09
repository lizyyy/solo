package tracing

import (
	"context"
	"fmt"
	"time"

	"github.com/api-guardian/api-guardian/internal/config"
	"github.com/api-guardian/api-guardian/internal/database"
	"github.com/api-guardian/api-guardian/internal/models"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/jaeger"
	"go.opentelemetry.io/otel/exporters/stdout/stdouttrace"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.21.0"
	"go.opentelemetry.io/otel/trace"
	"gorm.io/gorm"
)

var tracer trace.Tracer
var tp *sdktrace.TracerProvider

func Init(cfg config.TracingConfig) error {
	if !cfg.Enabled {
		tracer = otel.Tracer("noop")
		return nil
	}

	exp, err := createExporter(cfg)
	if err != nil {
		return fmt.Errorf("failed to create exporter: %w", err)
	}

	res, err := resource.New(context.Background(),
		resource.WithAttributes(
			semconv.ServiceName(cfg.ServiceName),
			semconv.ServiceVersion("1.0.0"),
		),
	)
	if err != nil {
		return fmt.Errorf("failed to create resource: %w", err)
	}

	tp = sdktrace.NewTracerProvider(
		sdktrace.WithBatcher(exp),
		sdktrace.WithResource(res),
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
	)

	otel.SetTracerProvider(tp)
	tracer = tp.Tracer(cfg.ServiceName)

	return nil
}

func createExporter(cfg config.TracingConfig) (sdktrace.SpanExporter, error) {
	if cfg.JaegerEndpoint != "" {
		return jaeger.New(jaeger.WithCollectorEndpoint(jaeger.WithEndpoint(cfg.JaegerEndpoint)))
	}
	return stdouttrace.New(stdouttrace.WithPrettyPrint())
}

func GetTracer() trace.Tracer {
	if tracer == nil {
		tracer = otel.Tracer("noop")
	}
	return tracer
}

func Start(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	return GetTracer().Start(ctx, name, opts...)
}

func Shutdown(ctx context.Context) error {
	if tp != nil {
		return tp.Shutdown(ctx)
	}
	return nil
}

type TraceService struct {
	db *gorm.DB
}

func NewTraceService() *TraceService {
	return &TraceService{db: database.GetDB()}
}

func (s *TraceService) RecordSpan(
	ctx context.Context,
	serviceName, operationName string,
	attrs map[string]interface{},
	duration time.Duration,
	hasError bool,
	errorMsg string,
) error {
	spanCtx := trace.SpanContextFromContext(ctx)
	traceID := spanCtx.TraceID().String()
	spanID := spanCtx.SpanID().String()

	record := &models.TraceRecord{
		TraceID:       traceID,
		SpanID:        spanID,
		ServiceName:   serviceName,
		OperationName: operationName,
		StartTime:     time.Now().Add(-duration),
		EndTime:       time.Now(),
		DurationMs:    duration.Milliseconds(),
		Attributes:    attrs,
		HasError:      hasError,
		ErrorMessage:  errorMsg,
	}

	if hasError {
		record.StatusCode = "ERROR"
	} else {
		record.StatusCode = "OK"
	}

	return s.db.Create(record).Error
}

func (s *TraceService) GetTraceByID(traceID string) ([]models.TraceRecord, error) {
	var records []models.TraceRecord
	err := s.db.Where("trace_id = ?", traceID).Order("start_time ASC").Find(&records).Error
	return records, err
}

func (s *TraceService) GetErrorTraces(limit int) ([]models.TraceRecord, error) {
	var records []models.TraceRecord
	err := s.db.Where("has_error = ?", true).
		Order("start_time DESC").
		Limit(limit).
		Find(&records).Error
	return records, err
}

func (s *TraceService) SearchTraces(serviceName, operationName string, startTime, endTime time.Time, limit int) ([]models.TraceRecord, error) {
	query := s.db.Model(&models.TraceRecord{})

	if serviceName != "" {
		query = query.Where("service_name = ?", serviceName)
	}
	if operationName != "" {
		query = query.Where("operation_name LIKE ?", "%"+operationName+"%")
	}
	if !startTime.IsZero() {
		query = query.Where("start_time >= ?", startTime)
	}
	if !endTime.IsZero() {
		query = query.Where("end_time <= ?", endTime)
	}

	var records []models.TraceRecord
	err := query.Order("start_time DESC").Limit(limit).Find(&records).Error
	return records, err
}

func AddAttribute(span trace.Span, key string, value interface{}) {
	var attr attribute.KeyValue
	switch v := value.(type) {
	case string:
		attr = attribute.String(key, v)
	case int:
		attr = attribute.Int(key, v)
	case int64:
		attr = attribute.Int64(key, v)
	case bool:
		attr = attribute.Bool(key, v)
	case float64:
		attr = attribute.Float64(key, v)
	default:
		attr = attribute.String(key, fmt.Sprintf("%v", v))
	}
	span.SetAttributes(attr)
}
