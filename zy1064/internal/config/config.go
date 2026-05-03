package config

import (
	"os"
	"strconv"
)

type Config struct {
	Port         int
	Mode         string
	DatabasePath string
	HighRiskMargin   float64
	MediumRiskMargin float64
}

func Load() *Config {
	return &Config{
		Port:         getEnvAsInt("PORT", 8080),
		Mode:         getEnvAsString("GIN_MODE", "debug"),
		DatabasePath: getEnvAsString("DB_PATH", "./coupon_calc.db"),
		HighRiskMargin:   getEnvAsFloat("HIGH_RISK_MARGIN", 0.05),
		MediumRiskMargin: getEnvAsFloat("MEDIUM_RISK_MARGIN", 0.15),
	}
}

func getEnvAsString(key string, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvAsFloat(key string, defaultValue float64) float64 {
	if value, exists := os.LookupEnv(key); exists {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}
