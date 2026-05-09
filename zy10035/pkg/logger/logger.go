package logger

import (
	"fmt"
	"io"
	"log"
	"os"
	"time"
)

type LogLevel int

const (
	LevelDebug LogLevel = iota
	LevelInfo
	LevelWarn
	LevelError
	LevelFatal
)

var (
	level   LogLevel
	writer  io.Writer
	tag     string
)

func init() {
	level = LevelInfo
	writer = os.Stdout
	tag = "MQ-REVIEW"
}

func Init(logLevel string, logPath string) error {
	switch logLevel {
	case "debug":
		level = LevelDebug
	case "info":
		level = LevelInfo
	case "warn":
		level = LevelWarn
	case "error":
		level = LevelError
	case "fatal":
		level = LevelFatal
	default:
		level = LevelInfo
	}

	if logPath != "" && logPath != "./logs" {
		if err := os.MkdirAll(logPath, 0755); err != nil {
			return err
		}
		logFile := fmt.Sprintf("%s/app_%s.log", logPath, time.Now().Format("20060102"))
		file, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
		if err != nil {
			return err
		}
		writer = io.MultiWriter(os.Stdout, file)
	}

	return nil
}

func formatMessage(levelStr string, format string, args ...interface{}) string {
	timestamp := time.Now().Format("2006-01-02 15:04:05.000")
	message := fmt.Sprintf(format, args...)
	return fmt.Sprintf("[%s] [%s] [%s] %s", timestamp, tag, levelStr, message)
}

func Debug(format string, args ...interface{}) {
	if level <= LevelDebug {
		log.Output(2, formatMessage("DEBUG", format, args...))
	}
}

func Info(format string, args ...interface{}) {
	if level <= LevelInfo {
		log.Output(2, formatMessage("INFO", format, args...))
	}
}

func Warn(format string, args ...interface{}) {
	if level <= LevelWarn {
		log.Output(2, formatMessage("WARN", format, args...))
	}
}

func Error(format string, args ...interface{}) {
	if level <= LevelError {
		log.Output(2, formatMessage("ERROR", format, args...))
	}
}

func Fatal(format string, args ...interface{}) {
	if level <= LevelFatal {
		log.Output(2, formatMessage("FATAL", format, args...))
		os.Exit(1)
	}
}

func WithFields(fields map[string]interface{}) *FieldLogger {
	return &FieldLogger{fields: fields}
}

type FieldLogger struct {
	fields map[string]interface{}
}

func (f *FieldLogger) Debug(format string, args ...interface{}) {
	if level <= LevelDebug {
		message := fmt.Sprintf(format, args...)
		fieldStr := f.formatFields()
		log.Output(2, formatMessage("DEBUG", "%s %s", message, fieldStr))
	}
}

func (f *FieldLogger) Info(format string, args ...interface{}) {
	if level <= LevelInfo {
		message := fmt.Sprintf(format, args...)
		fieldStr := f.formatFields()
		log.Output(2, formatMessage("INFO", "%s %s", message, fieldStr))
	}
}

func (f *FieldLogger) Warn(format string, args ...interface{}) {
	if level <= LevelWarn {
		message := fmt.Sprintf(format, args...)
		fieldStr := f.formatFields()
		log.Output(2, formatMessage("WARN", "%s %s", message, fieldStr))
	}
}

func (f *FieldLogger) Error(format string, args ...interface{}) {
	if level <= LevelError {
		message := fmt.Sprintf(format, args...)
		fieldStr := f.formatFields()
		log.Output(2, formatMessage("ERROR", "%s %s", message, fieldStr))
	}
}

func (f *FieldLogger) formatFields() string {
	if len(f.fields) == 0 {
		return ""
	}
	fieldsStr := ""
	for k, v := range f.fields {
		fieldsStr += fmt.Sprintf(" %s=%v", k, v)
	}
	return fieldsStr
}
