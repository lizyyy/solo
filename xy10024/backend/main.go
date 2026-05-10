package main

import (
	"device-borrow-system/internal/api"
	"device-borrow-system/internal/config"
	"device-borrow-system/internal/database"
	"device-borrow-system/internal/eventstore"
	"device-borrow-system/internal/logger"
	"device-borrow-system/internal/middleware"
	"device-borrow-system/internal/repository"
	"device-borrow-system/internal/service"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()
	
	logger.Init(cfg)
	
	db, err := database.InitDB(cfg)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	
	redisClient, err := database.InitRedis(cfg)
	if err != nil {
		log.Printf("Warning: Redis connection failed: %v", err)
	}
	
	if err := database.AutoMigrate(db); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}
	
	eventStore := eventstore.NewEventStore(db, redisClient)
	
	userRepo := repository.NewUserRepository(db)
	deviceRepo := repository.NewDeviceRepository(db)
	borrowRepo := repository.NewBorrowRepository(db)
	auditRepo := repository.NewAuditRepository(db)
	
	userService := service.NewUserService(userRepo, eventStore, redisClient, cfg.JWT.Secret)
	deviceService := service.NewDeviceService(deviceRepo, eventStore, redisClient)
	borrowService := service.NewBorrowService(borrowRepo, deviceRepo, eventStore, redisClient)
	auditService := service.NewAuditService(auditRepo, eventStore)
	exportService := service.NewExportService(borrowRepo, deviceRepo, userRepo)
	
	router := gin.Default()
	router.Use(middleware.CORSMiddleware())
	router.Use(middleware.RequestIDMiddleware())
	router.Use(middleware.LoggerMiddleware())
	router.Use(middleware.RecoveryMiddleware())
	
	api.RegisterRoutes(router, userService, deviceService, borrowService, auditService, exportService, cfg)
	
	log.Printf("Server starting on :%d", cfg.Server.Port)
	if err := router.Run(fmt.Sprintf(":%d", cfg.Server.Port)); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
