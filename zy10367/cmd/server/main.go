package main

import (
	"cert-renewal/internal/config"
	"cert-renewal/internal/handler"
	"cert-renewal/internal/repository"
	"cert-renewal/internal/router"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

func main() {
	logger := initLogger()
	defer logger.Sync()

	cfg := config.DefaultConfig()

	if err := repository.Init(cfg.Database.DSN, logger); err != nil {
		logger.Fatal("failed to initialize database", zap.Error(err))
	}

	h := handler.NewHandler(logger)
	r := router.SetupRouter(h)

	logger.Info("server starting", zap.String("port", cfg.Server.Port))
	if err := r.Run(":" + cfg.Server.Port); err != nil {
		logger.Fatal("failed to start server", zap.Error(err))
	}
}

func initLogger() *zap.Logger {
	encoderConfig := zapcore.EncoderConfig{
		TimeKey:        "time",
		LevelKey:       "level",
		NameKey:        "logger",
		CallerKey:      "caller",
		MessageKey:     "msg",
		StacktraceKey:  "stacktrace",
		LineEnding:     zapcore.DefaultLineEnding,
		EncodeLevel:    zapcore.LowercaseLevelEncoder,
		EncodeTime:     zapcore.ISO8601TimeEncoder,
		EncodeDuration: zapcore.SecondsDurationEncoder,
		EncodeCaller:   zapcore.ShortCallerEncoder,
	}

	core := zapcore.NewCore(
		zapcore.NewJSONEncoder(encoderConfig),
		zapcore.AddSync(os.Stdout),
		zap.InfoLevel,
	)

	return zap.New(core, zap.AddCaller())
}
