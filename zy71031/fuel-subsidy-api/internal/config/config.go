package config

import "os"

type Config struct {
	ServerPort   string
	DatabasePath string
	SubsidyRate  float64
}

func Load() *Config {
	return &Config{
		ServerPort:   getEnv("SERVER_PORT", "8080"),
		DatabasePath: getEnv("DATABASE_PATH", "fuel_subsidy.db"),
		SubsidyRate:  0.8,
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}
