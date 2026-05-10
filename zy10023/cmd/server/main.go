package main

import (
	"context"
	"flag"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/api-guardian/api-guardian/internal/api"
	"github.com/api-guardian/api-guardian/internal/config"
	"github.com/api-guardian/api-guardian/internal/database"
	"github.com/api-guardian/api-guardian/internal/logger"
	"github.com/api-guardian/api-guardian/internal/services"
	"github.com/api-guardian/api-guardian/internal/tracing"
	"go.uber.org/zap"
)

func main() {
	configPath := flag.String("config", "", "Path to config file")
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		panic(fmt.Sprintf("Failed to load config: %v", err))
	}

	if err := logger.Init(cfg.Logging); err != nil {
		panic(fmt.Sprintf("Failed to initialize logger: %v", err))
	}
	defer logger.Sync()

	logger.Info("Starting API Guardian server...",
		zap.String("version", "1.0.0"),
		zap.Int("grpc_port", cfg.Server.GRPCPort),
		zap.Int("http_port", cfg.Server.HTTPPort),
		zap.Int("mock_port", cfg.Server.MockPort),
	)

	if err := database.Init(cfg.Database); err != nil {
		logger.Fatal("Failed to initialize database", zap.Error(err))
	}
	defer database.Close()

	if err := database.AutoMigrate(); err != nil {
		logger.Fatal("Failed to run migrations", zap.Error(err))
	}

	if err := tracing.Init(cfg.Tracing); err != nil {
		logger.Error("Failed to initialize tracing", zap.Error(err))
	}
	defer func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		tracing.Shutdown(ctx)
	}()

	mockService := services.NewMockService(cfg.Mock)
	if err := mockService.LoadMappings(context.Background()); err != nil {
		logger.Warn("Failed to load mock mappings", zap.Error(err))
	}

	if err := mockService.Start(cfg.Server.MockPort); err != nil {
		logger.Fatal("Failed to start mock service", zap.Error(err))
	}

	server := api.NewServer(cfg, mockService)
	if err := server.Start(); err != nil {
		logger.Fatal("Failed to start API server", zap.Error(err))
	}

	logger.Info("API Guardian is ready to serve requests")

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	logger.Info("Received shutdown signal, gracefully stopping...")

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if err := server.Stop(ctx); err != nil {
		logger.Error("Error stopping API server", zap.Error(err))
	}

	if err := mockService.Stop(ctx); err != nil {
		logger.Error("Error stopping mock service", zap.Error(err))
	}

	logger.Info("API Guardian stopped successfully")
}
