package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"

	"chaos-payment/internal/api"
	"chaos-payment/internal/cache"
	"chaos-payment/internal/config"
	"chaos-payment/internal/database"
	"chaos-payment/internal/eventbus"
	"chaos-payment/internal/service"
)

func main() {
	cfg := config.Get()

	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	db, err := database.InitDB(&cfg.Database)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	bus := eventbus.GetGlobalBus(db)

	redisCache, err := cache.InitCache(&cfg.Redis, bus)
	if err != nil {
		log.Printf("Warning: Failed to initialize cache (continuing without cache): %v", err)
		redisCache = nil
	}

	chaosEngine := service.NewChaosEngine(db, redisCache, bus)
	chaosEngine.Start()

	orderService := service.NewOrderService(db, redisCache, bus, chaosEngine)
	recoveryService := service.NewRecoveryService(db, redisCache, bus, orderService.GetStateManager())

	handler := api.NewHandler(orderService, chaosEngine, recoveryService, bus)

	r := gin.Default()
	handler.RegisterRoutes(r)

	serverAddr := fmt.Sprintf(":%d", cfg.Server.Port)

	go func() {
		log.Printf("🚀 Chaos Payment Platform starting on %s", serverAddr)
		log.Printf("📊 Web UI: http://localhost:%d", cfg.Server.Port)
		log.Printf("📋 API Base: http://localhost:%d/api", cfg.Server.Port)
		if err := r.Run(serverAddr); err != nil {
			log.Printf("Server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("🛑 Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	chaosEngine.Stop()
	bus.Stop()

	_ = ctx

	log.Println("✅ Server gracefully stopped")
}
