package api

import (
	"export-quota-api/service"
	"export-quota-api/storage"

	"github.com/gin-gonic/gin"
)

func SetupRouter(storage *storage.SQLiteStorage, quotaManager *service.QuotaManager) *gin.Engine {
	r := gin.Default()
	handler := NewHandler(storage, quotaManager)

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}

		c.Next()
	})

	api := r.Group("/api/v1")
	{
		api.GET("/health", handler.HealthCheck)
		api.POST("/seed", handler.SeedSampleData)

		tenants := api.Group("/tenants")
		{
			tenants.POST("", handler.CreateTenant)
			tenants.GET("", handler.GetAllTenants)
			tenants.GET("/:id", handler.GetTenant)
			tenants.PUT("/:id", handler.UpdateTenant)
			tenants.GET("/:tenant_id/status", handler.GetTenantStatus)
			tenants.POST("/:tenant_id/adjust-quota", handler.AdjustQuota)
			tenants.POST("/:tenant_id/process-tasks", handler.ProcessNextTasks)
			tenants.GET("/:tenant_id/tasks", handler.GetTenantTasks)
			tenants.GET("/:tenant_id/export-csv", handler.ExportTasksCSV)
		}

		tasks := api.Group("/tasks")
		{
			tasks.POST("", handler.CreateTask)
			tasks.GET("/:id", handler.GetTask)
			tasks.POST("/:id/complete", handler.CompleteTask)
			tasks.POST("/:id/fail", handler.FailTask)
			tasks.POST("/:id/retry", handler.ManualRetry)
		}
	}

	return r
}
