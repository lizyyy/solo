package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"go.uber.org/zap"

	"migration-chaos-simulator/internal/api"
	"migration-chaos-simulator/internal/chaos"
	"migration-chaos-simulator/internal/config"
	"migration-chaos-simulator/internal/logger"
	"migration-chaos-simulator/internal/migration"
	"migration-chaos-simulator/internal/queue"
	"migration-chaos-simulator/internal/reporter"
	"migration-chaos-simulator/internal/storage"
	"migration-chaos-simulator/internal/tracer"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	if err := logger.Init(cfg.Logging.Level, cfg.Logging.Format); err != nil {
		fmt.Printf("Failed to init logger: %v\n", err)
		os.Exit(1)
	}

	logger.Info("Starting Migration Chaos Simulator...",
		zap.Int("port", cfg.Server.Port),
		zap.String("mode", cfg.Server.Mode),
	)

	tr := tracer.GetTracer(cfg.Tracer)

	dbPool, err := storage.GetPool(cfg.Database)
	if err != nil {
		logger.Fatal("Failed to connect to database", zap.Error(err))
	}
	defer dbPool.Close()

	mqClient, err := queue.GetClient(cfg.RabbitMQ)
	if err != nil {
		logger.Warn("Failed to connect to RabbitMQ, continuing without", zap.Error(err))
	}
	if mqClient != nil {
		defer mqClient.Close()
	}

	migConfig := migration.MigrationConfig{
		EnableChecksum:     true,
		EnableDataSnapshot: true,
		EnableDryRun:       false,
		TransactionPerStep: true,
		MaxRetryPerStep:    2,
		RetryDelay:         1 * time.Second,
	}
	migExecutor := migration.NewExecutor(dbPool, tr, migConfig)

	chaosEngine := chaos.NewEngine(cfg.Chaos, chaos.EngineOptions{
		Tracer:   tr,
		DBPool:   dbPool,
		MQClient: mqClient,
	})

	reporter, err := reporter.NewReporter("./reports")
	if err != nil {
		logger.Fatal("Failed to create reporter", zap.Error(err))
	}

	apiServer := api.NewAPIServer(chaosEngine, migExecutor, tr, reporter)

	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	apiServer.SetupRoutes(r)

	srv := &struct {
		*gin.Engine
	}{r}

	go func() {
		addr := fmt.Sprintf(":%d", cfg.Server.Port)
		logger.Info("Server starting", zap.String("addr", addr))
		if err := r.Run(addr); err != nil {
			logger.Error("Server error", zap.Error(err))
		}
	}()

	_ = srv

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)

	<-quit
	logger.Info("Shutting down...")

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_ = ctx
	tr.Close()

	logger.Info("Server stopped gracefully")
}
