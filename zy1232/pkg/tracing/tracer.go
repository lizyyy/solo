package tracing

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"sync"
)

type key int

const (
	TraceIDKey key = iota
	SpanIDKey
)

const (
	TraceIDHeader = "X-Trace-ID"
	SpanIDHeader  = "X-Span-ID"
)

var (
	traceIDCounter uint64
	spanIDCounter  uint64
	mu             sync.Mutex
)

func GenerateTraceID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err == nil {
		return hex.EncodeToString(b)
	}

	mu.Lock()
	defer mu.Unlock()
	traceIDCounter++
	return hex.EncodeToString([]byte{
		byte(traceIDCounter >> 56),
		byte(traceIDCounter >> 48),
		byte(traceIDCounter >> 40),
		byte(traceIDCounter >> 32),
		byte(traceIDCounter >> 24),
		byte(traceIDCounter >> 16),
		byte(traceIDCounter >> 8),
		byte(traceIDCounter),
	})
}

func GenerateSpanID() string {
	b := make([]byte, 8)
	if _, err := rand.Read(b); err == nil {
		return hex.EncodeToString(b)
	}

	mu.Lock()
	defer mu.Unlock()
	spanIDCounter++
	return hex.EncodeToString([]byte{
		byte(spanIDCounter >> 56),
		byte(spanIDCounter >> 48),
		byte(spanIDCounter >> 40),
		byte(spanIDCounter >> 32),
		byte(spanIDCounter >> 24),
		byte(spanIDCounter >> 16),
		byte(spanIDCounter >> 8),
		byte(spanIDCounter),
	})
}

func WithTraceID(ctx context.Context, traceID string) context.Context {
	return context.WithValue(ctx, TraceIDKey, traceID)
}

func WithSpanID(ctx context.Context, spanID string) context.Context {
	return context.WithValue(ctx, SpanIDKey, spanID)
}

func FromContext(ctx context.Context) (traceID, spanID string) {
	if v := ctx.Value(TraceIDKey); v != nil {
		traceID = v.(string)
	}
	if v := ctx.Value(SpanIDKey); v != nil {
		spanID = v.(string)
	}
	return
}

func ExtractTraceID(r *http.Request) string {
	if traceID := r.Header.Get(TraceIDHeader); traceID != "" {
		return traceID
	}
	if traceID := r.URL.Query().Get("trace_id"); traceID != "" {
		return traceID
	}
	return GenerateTraceID()
}

func ExtractSpanID(r *http.Request) string {
	if spanID := r.Header.Get(SpanIDHeader); spanID != "" {
		return spanID
	}
	return GenerateSpanID()
}

func InjectTraceID(ctx context.Context, req *http.Request) {
	traceID, spanID := FromContext(ctx)
	if traceID != "" {
		req.Header.Set(TraceIDHeader, traceID)
	}
	if spanID != "" {
		req.Header.Set(SpanIDHeader, spanID)
	}
}

func InjectTraceIDToHeader(headers http.Header, ctx context.Context) {
	traceID, spanID := FromContext(ctx)
	if traceID != "" {
		headers.Set(TraceIDHeader, traceID)
	}
	if spanID != "" {
		headers.Set(SpanIDHeader, spanID)
	}
}
