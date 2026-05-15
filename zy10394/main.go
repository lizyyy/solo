package main

import (
	"api-status-aggregator/api"
	"api-status-aggregator/service"
	"api-status-aggregator/storage"
	"context"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/robfig/cron/v3"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func main() {
	logger := initLogger()
	defer logger.Sync()

	storage, err := storage.NewStorage("./data/api_status.db")
	if err != nil {
		logger.Fatal("failed to init storage", zap.Error(err))
	}

	svc := service.NewService(storage, logger)

	r := gin.Default()
	handler := api.NewHandler(svc, logger)
	handler.SetupRoutes(r)

	c := cron.New()
	c.AddFunc("@every 5s", func() {
		if err := svc.ProcessDeliveries(); err != nil {
			logger.Error("process deliveries failed", zap.Error(err))
		}
	})
	c.Start()
	defer c.Stop()

	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	go func() {
		logger.Info("server starting on :8080")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatal("failed to start server", zap.Error(err))
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	logger.Info("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Fatal("server forced to shutdown", zap.Error(err))
	}

	logger.Info("server exited gracefully")
}

func initLogger() *zap.Logger {
	config := zap.Config{
		Level:            zap.NewAtomicLevelAt(zap.InfoLevel),
		Development:      false,
		Sampling:         &zap.SamplingConfig{Initial: 100, Thereafter: 100},
		Encoding:         "json",
		EncoderConfig:    zap.NewProductionEncoderConfig(),
		OutputPaths:      []string{"stdout", "./data/app.log"},
		ErrorOutputPaths: []string{"stderr"},
	}
	config.EncoderConfig.TimeKey = "timestamp"
	config.EncoderConfig.EncodeTime = zapcore.ISO8601TimeEncoder

	if err := os.MkdirAll("./data", 0755); err != nil {
		panic(err)
	}

	logger, err := config.Build()
	if err != nil {
		panic(err)
	}
	return logger
}
