package service

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"go.opentelemetry.io/otel/trace"

	"grayscale-simulator/internal/model"
	"grayscale-simulator/pkg/database"
	"grayscale-simulator/pkg/logger"
	"grayscale-simulator/pkg/tracer"
)

type TraceService struct {
	serviceName string
}

func NewTraceService(serviceName string) *TraceService {
	return &TraceService{
		serviceName: serviceName,
	}
}

func (s *TraceService) RecordSpan(ctx context.Context, operationName string, start, end time.Time, status string, attrs map[string]interface{}) error {
	ctx, span := tracer.StartSpan(ctx, "trace_service.RecordSpan")
	defer span.End()

	traceID := tracer.TraceIDFromContext(ctx)
	var spanID string
	var parentSpanID string

	if spanCtx := trace.SpanContextFromContext(ctx); spanCtx.IsValid() {
		spanID = spanCtx.SpanID().String()
	}

	spanCtx := trace.SpanContextFromContext(ctx)
	if spanCtx.IsValid() && len(spanCtx.TraceID().String()) > 0 {
		traceID = spanCtx.TraceID().String()
	}

	attributesJSON, _ := json.Marshal(attrs)
	eventsJSON, _ := json.Marshal([]interface{}{})

	var durationMs int64
	if !end.IsZero() {
		durationMs = end.Sub(start).Milliseconds()
	}

	traceSpan := &model.TraceSpan{
		TraceID:       traceID,
		SpanID:        spanID,
		ParentSpanID:  parentSpanID,
		ServiceName:   s.serviceName,
		OperationName: operationName,
		StartTime:     start,
		EndTime:       &end,
		DurationMs:    durationMs,
		Status:        status,
		Attributes:    attributesJSON,
		Events:        eventsJSON,
		CreatedAt:     time.Now(),
	}

	if httpMethod, ok := attrs["http.method"].(string); ok {
		traceSpan.HTTPMethod = httpMethod
	}
	if httpURL, ok := attrs["http.url"].(string); ok {
		traceSpan.HTTPURL = httpURL
	}
	if httpStatusCode, ok := attrs["http.status_code"].(int); ok {
		traceSpan.HTTPStatusCode = httpStatusCode
	}
	if dbStatement, ok := attrs["db.statement"].(string); ok {
		traceSpan.DBStatement = dbStatement
	}
	if dbTable, ok := attrs["db.table"].(string); ok {
		traceSpan.DBTable = dbTable
	}
	if messageTopic, ok := attrs["message.topic"].(string); ok {
		traceSpan.MessageTopic = messageTopic
	}
	if messagePartition, ok := attrs["message.partition"].(int); ok {
		traceSpan.MessagePartition = messagePartition
	}
	if messageOffset, ok := attrs["message.offset"].(int64); ok {
		traceSpan.MessageOffset = messageOffset
	}

	query := `
		INSERT INTO trace_spans (
			trace_id, span_id, parent_span_id, service_name, operation_name,
			start_time, end_time, duration_ms, status, http_method, http_url,
			http_status_code, db_statement, db_table, message_topic,
			message_partition, message_offset, attributes, events, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
	`

	_, err := database.Exec(query,
		traceSpan.TraceID, traceSpan.SpanID, traceSpan.ParentSpanID, traceSpan.ServiceName, traceSpan.OperationName,
		traceSpan.StartTime, traceSpan.EndTime, traceSpan.DurationMs, traceSpan.Status, traceSpan.HTTPMethod, traceSpan.HTTPURL,
		traceSpan.HTTPStatusCode, traceSpan.DBStatement, traceSpan.DBTable, traceSpan.MessageTopic,
		traceSpan.MessagePartition, traceSpan.MessageOffset, traceSpan.Attributes, traceSpan.Events, traceSpan.CreatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to record span: %w", err)
	}

	return nil
}

func (s *TraceService) GetTraceByID(ctx context.Context, traceID string) ([]*model.TraceSpan, error) {
	ctx, span := tracer.StartSpan(ctx, "trace_service.GetTraceByID")
	defer span.End()

	var spans []*model.TraceSpan
	query := `
		SELECT * FROM trace_spans 
		WHERE trace_id = $1 
		ORDER BY start_time ASC
	`

	if err := database.Select(&spans, query, traceID); err != nil {
		return nil, fmt.Errorf("failed to get trace: %w", err)
	}

	return spans, nil
}

func (s *TraceService) SearchTraces(ctx context.Context, serviceName, operationName string, startTime, endTime time.Time, limit, offset int) ([]*model.TraceSpan, error) {
	ctx, span := tracer.StartSpan(ctx, "trace_service.SearchTraces")
	defer span.End()

	query := `SELECT * FROM trace_spans WHERE 1=1`
	args := []interface{}{}
	argIndex := 1

	if serviceName != "" {
		query += fmt.Sprintf(` AND service_name = $%d`, argIndex)
		args = append(args, serviceName)
		argIndex++
	}

	if operationName != "" {
		query += fmt.Sprintf(` AND operation_name = $%d`, argIndex)
		args = append(args, operationName)
		argIndex++
	}

	if !startTime.IsZero() {
		query += fmt.Sprintf(` AND start_time >= $%d`, argIndex)
		args = append(args, startTime)
		argIndex++
	}

	if !endTime.IsZero() {
		query += fmt.Sprintf(` AND start_time <= $%d`, argIndex)
		args = append(args, endTime)
		argIndex++
	}

	query += ` ORDER BY start_time DESC`

	if limit > 0 {
		query += fmt.Sprintf(` LIMIT $%d`, argIndex)
		args = append(args, limit)
		argIndex++
	}

	if offset > 0 {
		query += fmt.Sprintf(` OFFSET $%d`, argIndex)
		args = append(args, offset)
	}

	var spans []*model.TraceSpan
	if err := database.Select(&spans, query, args...); err != nil {
		return nil, fmt.Errorf("failed to search traces: %w", err)
	}

	return spans, nil
}

func (s *TraceService) GetTraceTree(ctx context.Context, traceID string) (map[string][]*model.TraceSpan, error) {
	ctx, span := tracer.StartSpan(ctx, "trace_service.GetTraceTree")
	defer span.End()

	spans, err := s.GetTraceByID(ctx, traceID)
	if err != nil {
		return nil, err
	}

	tree := make(map[string][]*model.TraceSpan)
	for _, spanItem := range spans {
		parentID := spanItem.ParentSpanID
		if parentID == "" {
			parentID = "root"
		}
		tree[parentID] = append(tree[parentID], spanItem)
	}

	return tree, nil
}

func (s *TraceService) GetSlowTraces(ctx context.Context, thresholdMs int64, limit int) ([]*model.TraceSpan, error) {
	ctx, span := tracer.StartSpan(ctx, "trace_service.GetSlowTraces")
	defer span.End()

	var spans []*model.TraceSpan
	query := `
		SELECT * FROM trace_spans 
		WHERE duration_ms >= $1 AND end_time IS NOT NULL
		ORDER BY duration_ms DESC
		LIMIT $2
	`

	if err := database.Select(&spans, query, thresholdMs, limit); err != nil {
		return nil, fmt.Errorf("failed to get slow traces: %w", err)
	}

	return spans, nil
}

func (s *TraceService) GetErrorTraces(ctx context.Context, limit int) ([]*model.TraceSpan, error) {
	ctx, span := tracer.StartSpan(ctx, "trace_service.GetErrorTraces")
	defer span.End()

	var spans []*model.TraceSpan
	query := `
		SELECT * FROM trace_spans 
		WHERE status = 'error' OR (http_status_code >= 400 AND http_status_code != 0)
		ORDER BY start_time DESC
		LIMIT $1
	`

	if err := database.Select(&spans, query, limit); err != nil {
		return nil, fmt.Errorf("failed to get error traces: %w", err)
	}

	return spans, nil
}

func (s *TraceService) CleanupOldTraces(ctx context.Context, retentionDays int) error {
	cutoff := time.Now().AddDate(0, 0, -retentionDays)
	
	result, err := database.Exec(`
		DELETE FROM trace_spans 
		WHERE created_at < $1
	`, cutoff)

	if err != nil {
		return err
	}

	rowsAffected, _ := result.RowsAffected()
	logger.WithFields(map[string]interface{}{
		"deleted_count": rowsAffected,
		"retention_days": retentionDays,
	}).Info("Cleaned up old trace spans")
	
	return nil
}

func (s *TraceService) AnalyzeTrace(ctx context.Context, traceID string) (map[string]interface{}, error) {
	ctx, span := tracer.StartSpan(ctx, "trace_service.AnalyzeTrace")
	defer span.End()

	spans, err := s.GetTraceByID(ctx, traceID)
	if err != nil {
		return nil, err
	}

	if len(spans) == 0 {
		return nil, fmt.Errorf("no spans found for trace: %s", traceID)
	}

	analysis := map[string]interface{}{
		"trace_id":        traceID,
		"total_spans":     len(spans),
		"has_errors":      false,
		"total_duration":  int64(0),
		"slow_operations": []string{},
		"error_count":     0,
	}

	var totalDuration int64
	errorCount := 0
	slowOperations := []string{}
	serviceMap := make(map[string]int)

	for _, spanItem := range spans {
		if spanItem.DurationMs > totalDuration {
			totalDuration = spanItem.DurationMs
		}

		if spanItem.DurationMs > 1000 {
			slowOperations = append(slowOperations, spanItem.OperationName)
		}

		if spanItem.Status == "error" || (spanItem.HTTPStatusCode >= 400 && spanItem.HTTPStatusCode != 0) {
			errorCount++
			analysis["has_errors"] = true
		}

		serviceMap[spanItem.ServiceName]++
	}

	analysis["total_duration_ms"] = totalDuration
	analysis["error_count"] = errorCount
	analysis["slow_operations"] = slowOperations
	analysis["services_involved"] = serviceMap

	return analysis, nil
}

