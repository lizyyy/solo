package middleware

import (
	"bytes"
	"encoding/json"
	"io"
	"time"

	"cache-risk-analyzer/internal/db"
	"cache-risk-analyzer/internal/model"

	"github.com/gin-gonic/gin"
)

type responseBodyWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w responseBodyWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func AuditMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		var requestBody []byte
		if c.Request.Body != nil {
			requestBody, _ = io.ReadAll(c.Request.Body)
			c.Request.Body = io.NopCloser(bytes.NewBuffer(requestBody))
		}

		blw := &responseBodyWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		c.Next()

		duration := time.Since(start)
		statusCode := c.Writer.Status()

		operation := "unknown"
		resource := "unknown"

		path := c.Request.URL.Path
		method := c.Request.Method

		switch {
		case path == "/api/v1/import/cache-events":
			operation = "import_cache_events"
			resource = "cache_events"
		case path == "/api/v1/import/keys":
			operation = "import_keys"
			resource = "cache_keys"
		case path == "/api/v1/import/backend-metrics":
			operation = "import_backend_metrics"
			resource = "backend_metrics"
		case path == "/api/v1/import/traffic-plan":
			operation = "import_traffic_plan"
			resource = "traffic_plans"
		case path == "/api/v1/import/strategy":
			operation = "import_strategy"
			resource = "strategies"
		case path == "/api/v1/analysis/risks":
			operation = "analyze_risks"
			resource = "risk_events"
		case path == "/api/v1/simulation/run":
			operation = "run_simulation"
			resource = "simulation_results"
		case path == "/api/v1/simulation/compare":
			operation = "compare_strategies"
			resource = "simulation_results"
		case path == "/api/v1/report/json" || path == "/api/v1/report/csv" || path == "/api/v1/report/markdown":
			operation = "export_report"
			resource = "reports"
		default:
			operation = method + "_" + path
			resource = "api"
		}

		detailMap := make(map[string]interface{})
		if len(requestBody) > 0 {
			var bodyJSON map[string]interface{}
			if json.Unmarshal(requestBody, &bodyJSON) == nil {
				if _, ok := bodyJSON["sensitive"]; ok {
					bodyJSON["sensitive"] = "***"
				}
				detailMap["request_body"] = bodyJSON
			} else {
				previewLen := min(100, len(requestBody))
				detailMap["request_body_preview"] = string(requestBody[:previewLen])
			}
		}

		detailBytes, _ := json.Marshal(detailMap)

		auditLog := model.AuditLog{
			Operation:  operation,
			Resource:   resource,
			Method:     method,
			Path:       path,
			UserAgent:  c.GetHeader("User-Agent"),
			IPAddress:  c.ClientIP(),
			StatusCode: statusCode,
			RequestID:  c.GetHeader("X-Request-ID"),
			DurationMS: duration.Milliseconds(),
			Detail:     string(detailBytes),
			CreatedAt:  time.Now(),
		}

		database := db.GetDB()
		_, err := database.Exec(`
			INSERT INTO audit_logs (
				operation, resource, method, path, user_agent, ip_address,
				status_code, request_id, duration_ms, detail_json, created_at
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		`,
			auditLog.Operation,
			auditLog.Resource,
			auditLog.Method,
			auditLog.Path,
			auditLog.UserAgent,
			auditLog.IPAddress,
			auditLog.StatusCode,
			auditLog.RequestID,
			auditLog.DurationMS,
			auditLog.Detail,
			auditLog.CreatedAt,
		)

		if err != nil {
			c.Error(err)
		}
	}
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
