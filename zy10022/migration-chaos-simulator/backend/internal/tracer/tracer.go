package tracer

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"sync"
	"time"

	"go.uber.org/zap"

	"migration-chaos-simulator/internal/config"
	"migration-chaos-simulator/internal/logger"
)

type SpanStatus string

const (
	SpanStatusOk       SpanStatus = "ok"
	SpanStatusError    SpanStatus = "error"
	SpanStatusCancelled SpanStatus = "cancelled"
)

type EventLevel string

const (
	EventLevelInfo    EventLevel = "info"
	EventLevelWarn    EventLevel = "warn"
	EventLevelError   EventLevel = "error"
	EventLevelCritical EventLevel = "critical"
)

type Trace struct {
	ID        string
	StartTime time.Time
	EndTime   time.Time
	Spans     []*Span
	Status    SpanStatus
	Metadata  map[string]interface{}
	mu        sync.RWMutex
}

type Span struct {
	ID           string
	TraceID      string
	ParentID     string
	Name         string
	StartTime    time.Time
	EndTime      time.Time
	Status       SpanStatus
	Error        string
	Events       []*Event
	Attributes   map[string]interface{}
	Children     []*Span
}

type Event struct {
	Timestamp  time.Time
	Level      EventLevel
	Message    string
	Attributes map[string]interface{}
}

type Tracer struct {
	cfg           config.TracerConfig
	activeTraces  sync.Map
	buffer        chan *Span
	flushTicker   *time.Ticker
	onSpanFinish  func(span *Span)
}

var (
	globalTracer *Tracer
	tracerOnce   sync.Once
)

type traceKey struct{}

func GetTracer(cfg config.TracerConfig) *Tracer {
	tracerOnce.Do(func() {
		globalTracer = newTracer(cfg)
	})
	return globalTracer
}

func newTracer(cfg config.TracerConfig) *Tracer {
	t := &Tracer{
		cfg:         cfg,
		buffer:      make(chan *Span, cfg.BufferSize),
		flushTicker: time.NewTicker(cfg.FlushInterval),
	}

	if cfg.Enabled {
		go t.flushLoop()
	}

	return t
}

func (t *Tracer) SetSpanFinishCallback(fn func(span *Span)) {
	t.onSpanFinish = fn
}

func (t *Tracer) flushLoop() {
	for range t.flushTicker.C {
		t.flushBuffer()
	}
}

func (t *Tracer) flushBuffer() {
	for {
		select {
		case span := <-t.buffer:
			if t.onSpanFinish != nil {
				t.onSpanFinish(span)
			}
		default:
			return
		}
	}
}

func (t *Tracer) Close() {
	t.flushTicker.Stop()
	t.flushBuffer()
}

func GenerateTraceID() string {
	buf := make([]byte, 16)
	rand.Read(buf)
	return hex.EncodeToString(buf)
}

func GenerateSpanID() string {
	buf := make([]byte, 8)
	rand.Read(buf)
	return hex.EncodeToString(buf)
}

func ContextWithTrace(ctx context.Context, trace *Trace) context.Context {
	return context.WithValue(ctx, traceKey{}, trace)
}

func TraceFromContext(ctx context.Context) (*Trace, bool) {
	trace, ok := ctx.Value(traceKey{}).(*Trace)
	return trace, ok
}

func (t *Tracer) StartTrace(name string, metadata map[string]interface{}) (*Trace, context.Context) {
	trace := &Trace{
		ID:        GenerateTraceID(),
		StartTime: time.Now(),
		Spans:     make([]*Span, 0),
		Status:    SpanStatusOk,
		Metadata:  metadata,
	}

	if t.cfg.Enabled {
		t.activeTraces.Store(trace.ID, trace)
	}

	ctx := context.WithValue(context.Background(), traceKey{}, trace)

	logger.Info("Trace started",
		zap.String("trace_id", trace.ID),
		zap.String("name", name),
	)

	return trace, ctx
}

func (t *Tracer) GetTrace(traceID string) (*Trace, bool) {
	if !t.cfg.Enabled {
		return nil, false
	}
	v, ok := t.activeTraces.Load(traceID)
	if !ok {
		return nil, false
	}
	return v.(*Trace), true
}

func (t *Tracer) EndTrace(traceID string, status SpanStatus) {
	if !t.cfg.Enabled {
		return
	}

	v, ok := t.activeTraces.Load(traceID)
	if !ok {
		return
	}

	trace := v.(*Trace)
	trace.mu.Lock()
	trace.EndTime = time.Now()
	trace.Status = status
	trace.mu.Unlock()

	t.activeTraces.Delete(traceID)

	logger.Info("Trace ended",
		zap.String("trace_id", traceID),
		zap.String("status", string(status)),
		zap.Duration("duration", trace.EndTime.Sub(trace.StartTime)),
	)
}

func (t *Tracer) StartSpan(ctx context.Context, name string, parentSpanID string, attrs map[string]interface{}) (*Span, context.Context) {
	trace, ok := TraceFromContext(ctx)
	if !ok {
		return nil, ctx
	}

	span := &Span{
		ID:         GenerateSpanID(),
		TraceID:    trace.ID,
		ParentID:   parentSpanID,
		Name:       name,
		StartTime:  time.Now(),
		Status:     SpanStatusOk,
		Events:     make([]*Event, 0),
		Attributes: attrs,
	}

	trace.mu.Lock()
	trace.Spans = append(trace.Spans, span)
	trace.mu.Unlock()

	logger.Debug("Span started",
		zap.String("trace_id", trace.ID),
		zap.String("span_id", span.ID),
		zap.String("parent_id", parentSpanID),
		zap.String("name", name),
	)

	return span, ctx
}

func (t *Tracer) EndSpan(span *Span, status SpanStatus, errMsg string) {
	if span == nil || !t.cfg.Enabled {
		return
	}

	span.EndTime = time.Now()
	span.Status = status
	span.Error = errMsg

	select {
	case t.buffer <- span:
	default:
		logger.Warn("Tracer buffer full, dropping span",
			zap.String("trace_id", span.TraceID),
			zap.String("span_id", span.ID),
		)
	}

	logger.Debug("Span ended",
		zap.String("trace_id", span.TraceID),
		zap.String("span_id", span.ID),
		zap.String("status", string(status)),
		zap.Duration("duration", span.EndTime.Sub(span.StartTime)),
	)
}

func (t *Tracer) AddEvent(ctx context.Context, level EventLevel, message string, attrs map[string]interface{}) {
	if !t.cfg.Enabled {
		return
	}

	trace, ok := TraceFromContext(ctx)
	if !ok {
		return
	}

	event := &Event{
		Timestamp:  time.Now(),
		Level:      level,
		Message:    message,
		Attributes: attrs,
	}

	trace.mu.Lock()
	if len(trace.Spans) > 0 {
		lastSpan := trace.Spans[len(trace.Spans)-1]
		lastSpan.Events = append(lastSpan.Events, event)
	}
	trace.mu.Unlock()

	logEvent := logger.WithTraceID(trace.ID)
	switch level {
	case EventLevelInfo:
		logEvent.Info(message, zap.Any("attrs", attrs))
	case EventLevelWarn:
		logEvent.Warn(message, zap.Any("attrs", attrs))
	case EventLevelError, EventLevelCritical:
		logEvent.Error(message, zap.Any("attrs", attrs))
	}
}

func (t *Tracer) ListActiveTraces() []*Trace {
	traces := make([]*Trace, 0)
	t.activeTraces.Range(func(key, value interface{}) bool {
		traces = append(traces, value.(*Trace))
		return true
	})
	return traces
}

func (s *Span) Duration() time.Duration {
	if s.EndTime.IsZero() {
		return time.Since(s.StartTime)
	}
	return s.EndTime.Sub(s.StartTime)
}

func (t *Trace) Duration() time.Duration {
	if t.EndTime.IsZero() {
		return time.Since(t.StartTime)
	}
	return t.EndTime.Sub(t.StartTime)
}

func (t *Trace) MarshalJSON() ([]byte, error) {
	type Alias Trace
	return json.Marshal(&struct {
		Duration string `json:"duration"`
		*Alias
	}{
		Duration: fmt.Sprintf("%v", t.Duration()),
		Alias:    (*Alias)(t),
	})
}

func (s *Span) MarshalJSON() ([]byte, error) {
	type Alias Span
	return json.Marshal(&struct {
		Duration string `json:"duration"`
		*Alias
	}{
		Duration: fmt.Sprintf("%v", s.Duration()),
		Alias:    (*Alias)(s),
	})
}
