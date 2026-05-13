package main

import (
	"tenant-migration-api/internal/handler"
	"tenant-migration-api/internal/repository"
	"tenant-migration-api/internal/service"
	"tenant-migration-api/pkg/logger"
	"tenant-migration-api/pkg/middleware"

	"github.com/gin-gonic/gin"
)

func main() {
	logger.Init()
	logger.Info("Starting Tenant Migration API Service...")

	db, err := repository.NewDatabase("tenant_migration.db")
	if err != nil {
		logger.Fatalf("Failed to initialize database: %v", err)
	}

	migrationRepo := repository.NewMigrationRepository(db.DB)
	migrationService := service.NewMigrationService(migrationRepo)
	migrationHandler := handler.NewMigrationHandler(migrationService)

	migrationService.InitSampleData()

	r := gin.Default()
	r.Use(middleware.CORS())
	r.Use(middleware.RequestLogger())

	api := r.Group("/api/v1")
	{
		api.GET("/health", migrationHandler.HealthCheck)

		migration := api.Group("/migrations")
		{
			migration.POST("", migrationHandler.CreateMigration)
			migration.POST("/validate", migrationHandler.ValidateMigration)
			migration.POST("/advance", migrationHandler.AdvanceStatus)
			migration.POST("/rollback", migrationHandler.RollbackMigration)
			migration.GET("", migrationHandler.ListMigrationTasks)
			migration.GET("/:id", migrationHandler.GetMigrationTask)
			migration.GET("/:id/history", migrationHandler.GetMigrationHistory)
			migration.GET("/:id/report", migrationHandler.GetValidationReport)
		}
	}

	logger.Info("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		logger.Fatalf("Failed to start server: %v", err)
	}
}
