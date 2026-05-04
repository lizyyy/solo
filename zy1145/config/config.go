package config

import (
	"os"
)

type Config struct {
	Port                string
	DatabasePath        string
	ConfirmedBlocks     int
	DustThreshold       int64
	MaxHotWalletBalance int64
	MinColdWalletBalance int64
	FeeRate             int64
	EnableZeroConf      bool
	RbfRiskLimit        float64
}

func Load() *Config {
	return &Config{
		Port:                getEnv("PORT", "8080"),
		DatabasePath:        getEnv("DATABASE_PATH", "./btc_recharge.db"),
		ConfirmedBlocks:     getEnvAsInt("CONFIRMED_BLOCKS", 6),
		DustThreshold:       getEnvAsInt64("DUST_THRESHOLD", 546),
		MaxHotWalletBalance: getEnvAsInt64("MAX_HOT_WALLET_BALANCE", 1000000000),
		MinColdWalletBalance: getEnvAsInt64("MIN_COLD_WALLET_BALANCE", 100000000),
		FeeRate:             getEnvAsInt64("FEE_RATE", 20),
		EnableZeroConf:      getEnvAsBool("ENABLE_ZERO_CONF", false),
		RbfRiskLimit:        getEnvAsFloat64("RBF_RISK_LIMIT", 0.5),
	}
}

func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

func getEnvAsInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		result := 0
		for _, c := range value {
			result = result*10 + int(c-'0')
		}
		return result
	}
	return defaultValue
}

func getEnvAsInt64(key string, defaultValue int64) int64 {
	if value, exists := os.LookupEnv(key); exists {
		result := int64(0)
		for _, c := range value {
			result = result*10 + int64(c-'0')
		}
		return result
	}
	return defaultValue
}

func getEnvAsBool(key string, defaultValue bool) bool {
	if value, exists := os.LookupEnv(key); exists {
		return value == "true" || value == "1"
	}
	return defaultValue
}

func getEnvAsFloat64(key string, defaultValue float64) float64 {
	if value, exists := os.LookupEnv(key); exists {
		result := 0.0
		decimal := false
		divisor := 1.0
		for _, c := range value {
			if c == '.' {
				decimal = true
				continue
			}
			if decimal {
				divisor *= 10
			}
			result = result*10 + float64(c-'0')
		}
		if decimal {
			result /= divisor
		}
		return result
	}
	return defaultValue
}
