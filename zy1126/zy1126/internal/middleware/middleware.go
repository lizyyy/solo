package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"runtime/debug"
	"strings"
	"time"

	"performance-tracker/pkg/logger"
)

type Middleware func(http.Handler) http.Handler

func Chain(handler http.Handler, middlewares ...Middleware) http.Handler {
	for i := len(middlewares) - 1; i >= 0; i-- {
		handler = middlewares[i](handler)
	}
	return handler
}

func Logging() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			path := r.URL.Path
			method := r.Method

			// 使用自定义 ResponseWriter 来捕获状态码
			rw := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			// 处理请求
			next.ServeHTTP(rw, r)

			// 记录日志
			duration := time.Since(start)
			statusCode := rw.statusCode

			logger.Infof("%s %s %d %s", method, path, statusCode, duration)
		})
	}
}

func Recovery() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if err := recover(); err != nil {
					logger.Errorf("Panic recovered: %v\nStack: %s", err, debug.Stack())

					// 返回 500 错误
					w.Header().Set("Content-Type", "application/json")
					w.WriteHeader(http.StatusInternalServerError)

					response := map[string]interface{}{
						"success": false,
						"error":   "Internal server error",
					}
					json.NewEncoder(w).Encode(response)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

func Timeout(timeout time.Duration) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 创建带超时的上下文
			ctx, cancel := context.WithTimeout(r.Context(), timeout)
			defer cancel()

			// 创建带取消的请求
			r = r.WithContext(ctx)

			// 使用自定义 ResponseWriter
			rw := &responseWriter{
				ResponseWriter: w,
				statusCode:     http.StatusOK,
			}

			// 处理请求
			done := make(chan struct{})
			go func() {
				defer close(done)
				next.ServeHTTP(rw, r)
			}()

			// 等待完成或超时
			select {
			case <-done:
				// 请求正常完成
			case <-ctx.Done():
				// 请求超时
				logger.Warnf("Request timeout: %s %s", r.Method, r.URL.Path)

				w.Header().Set("Content-Type", "application/json")
				w.WriteHeader(http.StatusRequestTimeout)

				response := map[string]interface{}{
					"success": false,
					"error":   "Request timeout",
				}
				json.NewEncoder(w).Encode(response)
			}
		})
	}
}

func CORS(allowedOrigins []string, allowedMethods []string, allowedHeaders []string) Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 设置 CORS 头
			origin := r.Header.Get("Origin")

			// 检查是否允许的来源
			allowed := false
			for _, ao := range allowedOrigins {
				if ao == "*" || ao == origin {
					allowed = true
					break
				}
			}

			if allowed {
				w.Header().Set("Access-Control-Allow-Origin", origin)
			}

			// 处理预检请求
			if r.Method == "OPTIONS" {
				w.Header().Set("Access-Control-Allow-Methods", strings.Join(allowedMethods, ", "))
				w.Header().Set("Access-Control-Allow-Headers", strings.Join(allowedHeaders, ", "))
				w.Header().Set("Access-Control-Max-Age", "86400")
				w.WriteHeader(http.StatusOK)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func ContentTypeJSON() Middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// 为响应设置默认 Content-Type
			w.Header().Set("Content-Type", "application/json")
			next.ServeHTTP(w, r)
		})
	}
}

// responseWriter 是一个自定义的 ResponseWriter，用于捕获状态码
type responseWriter struct {
	http.ResponseWriter
	statusCode int
}

func (rw *responseWriter) WriteHeader(code int) {
	rw.statusCode = code
	rw.ResponseWriter.WriteHeader(code)
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	// 如果状态码还没设置，设置为 200
	if rw.statusCode == 0 {
		rw.statusCode = http.StatusOK
	}
	return rw.ResponseWriter.Write(b)
}
