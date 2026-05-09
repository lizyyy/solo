package logger

import (
	"os"

	"github.com/api-guardian/api-guardian/internal/config"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var globalLogger *zap.Logger

func Init(cfg config.LoggingConfig) error {
	var config zap.Config

	if cfg.Format == "json" {
		config = zap.NewProductionConfig()
	} else {
		config = zap.NewDevelopmentConfig()
		config.EncoderConfig.EncodeLevel = zapcore.CapitalColorLevelEncoder
	}

	level, err := zapcore.ParseLevel(cfg.Level)
	if err != nil {
		level = zapcore.InfoLevel
	}
	config.Level = zap.NewAtomicLevelAt(level)

	logger, err := config.Build()
	if err != nil {
		return err
	}

	globalLogger = logger
	return nil
}

func Get() *zap.Logger {
	if globalLogger == nil {
		return zap.NewNop()
	}
	return globalLogger
}

func Sugar() *zap.SugaredLogger {
	return Get().Sugar()
}

func Sync() {
	if globalLogger != nil {
		_ = globalLogger.Sync()
	}
}

func With(fields ...zap.Field) *zap.Logger {
	return Get().With(fields...)
}

func Named(name string) *zap.Logger {
	return Get().Named(name)
}

func Fatal(msg string, fields ...zap.Field) {
	Get().Fatal(msg, fields...)
	os.Exit(1)
}

func Error(msg string, fields ...zap.Field) {
	Get().Error(msg, fields...)
}

func Warn(msg string, fields ...zap.Field) {
	Get().Warn(msg, fields...)
}

func Info(msg string, fields ...zap.Field) {
	Get().Info(msg, fields...)
}

func Debug(msg string, fields ...zap.Field) {
	Get().Debug(msg, fields...)
}
