package middleware

import (
	"context"
	"net/http"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/internal/config"
	"github.com/zy1232/microservice-framework/internal/model"
	"github.com/zy1232/microservice-framework/pkg/circuitbreaker"
	"github.com/zy1232/microservice-framework/pkg/ratelimit"
	"github.com/zy1232/microservice-framework/pkg/tracing"
)

type Middleware func(http.Handler) http.Handler

type Chain struct {
	middlewares []Middleware
}

func NewChain(middlewares ...Middleware) *Chain {
	return &Chain{
		middlewares: middlewares,
	}
}

func (c *Chain) Then(handler http.Handler) http.Handler {
	for i := len(c.middlewares) - 1; i >= 0; i-- {
		handler = c.middlewares[i](handler)
	}
	return handler
}

func (c *Chain) Append(middlewares ...Middleware) *Chain {
	newMiddlewares := make([]Middleware, len(c.middlewares)+len(middlewares))
	copy(newMiddlewares, c.middlewares)
	copy(newMiddlewares[len(c.middlewares):], middlewares)
	return &Chain{middlewares: newMiddlewares}
}

func TracingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		traceID := tracing.ExtractTraceID(r)
		spanID := tracing.ExtractSpanID(r)

		ctx := r.Context()
		ctx = tracing.WithTraceID(ctx, traceID)
		ctx = tracing.WithSpanID(ctx, spanID)

		w.Header().Set(tracing.TraceIDHeader, traceID)
		w.Header().Set(tracing.SpanIDHeader, spanID)

		log.Debug().
			Str("trace_id", traceID).
			Str("span_id", spanID).
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Msg("Request traced")

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func LoggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		traceID, _ := tracing.FromContext(r.Context())

		log.Info().
			Str("trace_id", traceID).
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Str("remote_addr", r.RemoteAddr).
			Msg("Request started")

		rw := &responseWriter{
			ResponseWriter: w,
			statusCode:     http.StatusOK,
		}

		next.ServeHTTP(rw, r)

		duration := time.Since(start)

		log.Info().
			Str("trace_id", traceID).
			Str("method", r.Method).
			Str("path", r.URL.Path).
			Int("status", rw.statusCode).
			Dur("duration", duration).
			Msg("Request completed")
	})
}

type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

type RateLimitMiddleware struct {
	limiter *ratelimit.ServiceRateLimiter
	config  *config.Manager
}

func NewRateLimitMiddleware(limiter *ratelimit.ServiceRateLimiter, cfg *config.Manager) *RateLimitMiddleware {
	return &RateLimitMiddleware{
		limiter: limiter,
		config:  cfg,
	}
}

func (rlm *RateLimitMiddleware) Middleware(service string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			limit := rlm.config.GetInt("ratelimit.limit")
			if limit == 0 {
				limit = 100
			}

			windowSec := rlm.config.GetInt("ratelimit.window")
			if windowSec == 0 {
				windowSec = 60
			}
			window := time.Duration(windowSec) * time.Second

			if !rlm.limiter.Allow(service, limit, window) {
				traceID, _ := tracing.FromContext(r.Context())
				log.Warn().
					Str("trace_id", traceID).
					Str("service", service).
					Msg("Rate limit exceeded")

				http.Error(w, "Too Many Requests", http.StatusTooManyRequests)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

type CircuitBreakerMiddleware struct {
	breakers *circuitbreaker.ServiceCircuitBreaker
}

func NewCircuitBreakerMiddleware(breakers *circuitbreaker.ServiceCircuitBreaker) *CircuitBreakerMiddleware {
	return &CircuitBreakerMiddleware{
		breakers: breakers,
	}
}

func (cbm *CircuitBreakerMiddleware) Middleware(service string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			breaker := cbm.breakers.Get(service)

			if !breaker.Allow() {
				traceID, _ := tracing.FromContext(r.Context())
				state, failures, _ := breaker.Stats()

				log.Warn().
					Str("trace_id", traceID).
					Str("service", service).
					Str("state", string(state)).
					Int("failures", failures).
					Msg("Circuit breaker open")

				http.Error(w, "Service Unavailable", http.StatusServiceUnavailable)
				return
			}

			rw := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			next.ServeHTTP(rw, r)

			if rw.statusCode >= http.StatusInternalServerError {
				breaker.RecordFailure()
				traceID, _ := tracing.FromContext(r.Context())
				log.Warn().
					Str("trace_id", traceID).
					Str("service", service).
					Int("status", rw.statusCode).
					Msg("Circuit breaker recorded failure")
			} else {
				breaker.RecordSuccess()
			}
		})
	}
}

func RecoveryMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			if rec := recover(); rec != nil {
				traceID, _ := tracing.FromContext(r.Context())

				log.Error().
					Str("trace_id", traceID).
					Interface("panic", rec).
					Msg("Panic recovered")

				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
			}
		}()

		next.ServeHTTP(w, r)
	})
}

func CORSMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Trace-ID, X-Span-ID")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func RequestContextMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 30*time.Second)
		defer cancel()

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
