package logger

import (
	"os"

	"github.com/sirupsen/logrus"
)

var log *logrus.Logger

func InitLogger(level, format string) {
	log = logrus.New()
	log.SetOutput(os.Stdout)

	// 设置日志级别
	switch level {
	case "debug":
		log.SetLevel(logrus.DebugLevel)
	case "info":
		log.SetLevel(logrus.InfoLevel)
	case "warn":
		log.SetLevel(logrus.WarnLevel)
	case "error":
		log.SetLevel(logrus.ErrorLevel)
	default:
		log.SetLevel(logrus.InfoLevel)
	}

	// 设置日志格式
	if format == "json" {
		log.SetFormatter(&logrus.JSONFormatter{})
	} else {
		log.SetFormatter(&logrus.TextFormatter{
			FullTimestamp: true,
		})
	}
}

func Debug(args ...interface{}) {
	if log != nil {
		log.Debug(args...)
	}
}

func Debugf(format string, args ...interface{}) {
	if log != nil {
		log.Debugf(format, args...)
	}
}

func Info(args ...interface{}) {
	if log != nil {
		log.Info(args...)
	}
}

func Infof(format string, args ...interface{}) {
	if log != nil {
		log.Infof(format, args...)
	}
}

func Warn(args ...interface{}) {
	if log != nil {
		log.Warn(args...)
	}
}

func Warnf(format string, args ...interface{}) {
	if log != nil {
		log.Warnf(format, args...)
	}
}

func Error(args ...interface{}) {
	if log != nil {
		log.Error(args...)
	}
}

func Errorf(format string, args ...interface{}) {
	if log != nil {
		log.Errorf(format, args...)
	}
}

func Fatal(args ...interface{}) {
	if log != nil {
		log.Fatal(args...)
	}
}

func Fatalf(format string, args ...interface{}) {
	if log != nil {
		log.Fatalf(format, args...)
	}
}
