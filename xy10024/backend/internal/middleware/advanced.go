package middleware

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"device-borrow-system/internal/database"
	"device-borrow-system/internal/models"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"gorm.io/gorm"
)

func IdempotencyMiddleware(db *gorm.DB, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		idempotencyKey := c.GetHeader("X-Idempotency-Key")
		if idempotencyKey == "" {
			c.Next()
			return
		}

		requestID := c.GetString("request_id")

		cacheKey := "idempotency:" + idempotencyKey
		if redisClient != nil {
			ctx := context.Background()
			if cached, err := redisClient.Get(ctx, cacheKey).Result(); err == nil {
				var response map[string]interface{}
				if err := json.Unmarshal([]byte(cached), &response); err == nil {
					c.JSON(http.StatusOK, response)
					c.Abort()
					return
				}
			}
		}

		var dedupRecord models.DedupRecord
		if err := db.Where("idempotency_key = ?", idempotencyKey).First(&dedupRecord).Error; err == nil {
			c.JSON(http.StatusOK, dedupRecord.Response)
			c.Abort()
			return
		}

		bodyBytes, _ := io.ReadAll(c.Request.Body)
		c.Request.Body = io.NopCloser(bytes.NewBuffer(bodyBytes))

		c.Set("idempotency_key", idempotencyKey)
		c.Set("body_bytes", bodyBytes)

		blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
		c.Writer = blw

		c.Next()

		if c.Writer.Status() >= 200 && c.Writer.Status() < 300 {
			var response map[string]interface{}
			if err := json.Unmarshal(blw.body.Bytes(), &response); err == nil {
				expiresAt := time.Now().Add(24 * time.Hour)
				record := models.DedupRecord{
					IdempotencyKey: idempotencyKey,
					Response:       response,
					ExpiresAt:      expiresAt,
				}

				if rid, err := uuid.Parse(requestID); err == nil {
					record.RequestID = rid
				}

				db.Create(&record)

				if redisClient != nil {
					ctx := context.Background()
					jsonData, _ := json.Marshal(response)
					redisClient.Set(ctx, cacheKey, jsonData, 24*time.Hour)
				}
			}
		}
	}
}

type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func AuditMiddleware(db *gorm.DB, redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		userID := c.GetString("user_id")
		action := getActionFromRequest(c)
		resourceType := getResourceTypeFromRequest(c)

		c.Next()

		if shouldAudit(c) {
			requestID := c.GetString("request_id")
			auditLog := models.AuditLog{
				Action:       action,
				ResourceType: resourceType,
				IPAddress:    c.ClientIP(),
				UserAgent:    c.GetHeader("User-Agent"),
			}

			if userID != "" {
				if uid, err := uuid.Parse(userID); err == nil {
					auditLog.UserID = &uid
				}
			}

			if requestID != "" {
				if rid, err := uuid.Parse(requestID); err == nil {
					auditLog.RequestID = &rid
				}
			}

			db.Create(&auditLog)

			if redisClient != nil {
				ctx := context.Background()
				cacheKey := "audit:recent"
				jsonData, _ := json.Marshal(auditLog)
				redisClient.LPush(ctx, cacheKey, jsonData)
				redisClient.LTrim(ctx, cacheKey, 0, 99)
			}
		}
	}
}

func getActionFromRequest(c *gin.Context) string {
	method := c.Request.Method
	path := c.Request.URL.Path

	switch method {
	case "POST":
		if strings.Contains(path, "login") {
			return "user_login"
		}
		if strings.Contains(path, "borrow") {
			return "device_borrow"
		}
		if strings.Contains(path, "return") {
			return "device_return"
		}
		return "create"
	case "PUT", "PATCH":
		return "update"
	case "DELETE":
		return "delete"
	default:
		return "read"
	}
}

func getResourceTypeFromRequest(c *gin.Context) string {
	path := c.Request.URL.Path
	if strings.Contains(path, "users") {
		return "user"
	}
	if strings.Contains(path, "devices") {
		return "device"
	}
	if strings.Contains(path, "borrow") {
		return "borrow_record"
	}
	if strings.Contains(path, "events") {
		return "event"
	}
	if strings.Contains(path, "audit") {
		return "audit_log"
	}
	return "unknown"
}

func shouldAudit(c *gin.Context) bool {
	if c.Request.Method == "GET" {
		return false
	}
	return c.Writer.Status() >= 200 && c.Writer.Status() < 300
}

func DistributedLockMiddleware(redisClient *redis.Client) gin.HandlerFunc {
	return func(c *gin.Context) {
		if redisClient == nil {
			c.Next()
			return
		}

		if c.Request.Method == "GET" {
			c.Next()
			return
		}

		resourceID := extractResourceID(c)
		if resourceID == "" {
			c.Next()
			return
		}

		lockKey := "lock:" + resourceID
		ctx := context.Background()
		requestID := c.GetString("request_id")

		locked, err := redisClient.SetNX(ctx, lockKey, requestID, 10*time.Second).Result()
		if err != nil || !locked {
			c.JSON(http.StatusConflict, gin.H{
				"error":      "Resource is being modified by another request",
				"request_id": requestID,
			})
			c.Abort()
			return
		}

		defer func() {
			redisClient.Del(ctx, lockKey)
		}()

		c.Next()
	}
}

func extractResourceID(c *gin.Context) string {
	path := c.Request.URL.Path
	parts := strings.Split(path, "/")
	for i, part := range parts {
		if isUUID(part) && i > 0 {
			return parts[i-1] + ":" + part
		}
	}
	return ""
}

func isUUID(s string) bool {
	_, err := uuid.Parse(s)
	return err == nil
}

func OptimisticLockMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != "PUT" && c.Request.Method != "PATCH" {
			c.Next()
			return
		}

		ifMatch := c.GetHeader("If-Match")
		if ifMatch != "" {
			c.Set("expected_version", ifMatch)
		}

		c.Next()
	}
}

var _ = database.InitDB
