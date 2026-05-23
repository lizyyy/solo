package api

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"visitor-pass/internal/auth"
	"visitor-pass/internal/model"
	"visitor-pass/internal/repository"
)

type contextKey string

const UserClaimsKey contextKey = "user_claims"

func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "未提供认证令牌"})
			c.Abort()
			return
		}

		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "认证格式错误"})
			c.Abort()
			return
		}

		claims, err := auth.ParseToken(parts[1])
		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "无效的认证令牌"})
			c.Abort()
			return
		}

		c.Set("user_id", claims.UserID)
		c.Set("username", claims.Username)
		c.Set("user_role", claims.Role)
		c.Next()
	}
}

func PermissionMiddleware(resource, action string) gin.HandlerFunc {
	return func(c *gin.Context) {
		role, exists := c.Get("user_role")
		if !exists {
			c.JSON(http.StatusUnauthorized, gin.H{"error": "用户未认证"})
			c.Abort()
			return
		}

		if !auth.HasPermission(role, resource, action) {
			c.JSON(http.StatusForbidden, gin.H{"error": "无权限执行此操作"})
			c.Abort()
			return
		}

		c.Next()
	}
}

func AuditMiddleware(action, resourceType string) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		userID, _ := c.Get("user_id")
		username, _ := c.Get("username")
		role, _ := c.Get("user_role")

		resourceID := c.Param("id")
		ip := c.ClientIP()
		ua := c.GetHeader("User-Agent")

		if userID != nil {
			go func() {
				roleStr, _ := role.(model.Role)
				LogAudit(
					userID.(string),
					username.(string),
					string(roleStr),
					action,
					resourceType,
					resourceID,
					"",
					"",
					ip,
					ua,
				)
			}()
		}
	}
}

func LogAudit(userID, username, role, action, resourceType, resourceID, oldValue, newValue, ip, userAgent string) {
	repository.LogAudit(userID, username, role, action, resourceType, resourceID, oldValue, newValue, ip, userAgent)
}
