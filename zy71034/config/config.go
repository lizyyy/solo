package config

import (
	"os"
	"strconv"
)

type Config struct {
	ServerPort        string
	DBPath            string
	DefaultValidityHours int
}

func Load() *Config {
	return &Config{
		ServerPort:        getEnv("SERVER_PORT", "8080"),
		DBPath:            getEnv("DB_PATH", "prescription.db"),
		DefaultValidityHours: getEnvInt("DEFAULT_VALIDITY_HOURS", 48),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
