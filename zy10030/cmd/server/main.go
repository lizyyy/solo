package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"grayscale-simulator/internal/api"
	"grayscale-simulator/internal/service"
	"grayscale-simulator/pkg/config"
	"grayscale-simulator/pkg/database"
	"grayscale-simulator/pkg/logger"
	"grayscale-simulator/pkg/mq"
	"grayscale-simulator/pkg/tracer"
)

func main() {
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		configPath = "config.yaml"
	}

	cfg, err := config.Load(configPath)
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	if err := logger.Init(cfg.Log.Level, cfg.Log.Format, cfg.Log.Output); err != nil {
		fmt.Printf("Failed to init logger: %v\n", err)
		os.Exit(1)
	}

	if err := database.Init(&cfg.Database); err != nil {
		logger.Fatalf("Failed to init database: %v", err)
	}
	defer database.Close()

	if err := tracer.Init(&cfg.Trace); err != nil {
		logger.Warnf("Failed to init tracer: %v", err)
	}
	defer tracer.Shutdown(context.Background())

	if err := mq.InitProducer(&cfg.Kafka); err != nil {
		logger.Warnf("Failed to init Kafka producer: %v", err)
	}

	if err := mq.InitConsumer(&cfg.Kafka); err != nil {
		logger.Warnf("Failed to init Kafka consumer: %v", err)
	}
	defer mq.Close()

	grayReleaseService := service.NewGrayReleaseService(cfg.GrayRelease.DefaultPercentage)

	rollbackEngine := service.NewRollbackEngine(
		cfg.Rollback.MaxRetryTimes,
		cfg.Rollback.RetryInterval,
		cfg.Rollback.EnableSagaPattern,
	)

	faultInjectionService := service.NewFaultInjectionService(
		cfg.FaultInjection.Enabled,
		cfg.FaultInjection.HighConcurrency.MaxConcurrent,
		cfg.FaultInjection.HighConcurrency.QueueSize,
		cfg.FaultInjection.Timeout.MinTimeout,
		cfg.FaultInjection.Timeout.MaxTimeout,
		cfg.FaultInjection.Timeout.Probability,
		cfg.FaultInjection.Network.FailureProbability,
		cfg.FaultInjection.Network.RetryTimes,
		cfg.FaultInjection.Network.BackoffStrategy,
	)

	traceService := service.NewTraceService(cfg.Server.Name)

	reportService := service.NewReportService("./reports", traceService)

	messageConsumer := service.NewMessageConsumerService(
		cfg.MessageQueue.Consumer.EnableIdempotency,
		cfg.MessageQueue.Consumer.DedupWindow,
		cfg.MessageQueue.Consumer.MaxProcessingTime,
		cfg.MessageQueue.Consumer.EnableManualCommit,
	)

	handler := api.NewHandler(
		grayReleaseService,
		rollbackEngine,
		faultInjectionService,
		messageConsumer,
		traceService,
		reportService,
	)

	router := api.SetupRouter(handler)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	if cfg.MessageQueue.Consumer.EnableIdempotency {
		if err := messageConsumer.Start(ctx); err != nil {
			logger.Warnf("Failed to start message consumer: %v", err)
		}
	}

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", cfg.Server.Port),
		Handler: router,
	}

	go func() {
		logger.Infof("Server starting on port %d...", cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("Shutting down server...")

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer shutdownCancel()

	messageConsumer.Stop()

	if err := server.Shutdown(shutdownCtx); err != nil {
		logger.Errorf("Server forced to shutdown: %v", err)
	}

	logger.Info("Server shutdown complete")
}
