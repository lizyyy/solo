package config

import (
	"os"
	"strconv"
)

// Config 应用配置
type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
}

// ServerConfig 服务器配置
type ServerConfig struct {
	Address string
	Mode    string
}

// DatabaseConfig 数据库配置
type DatabaseConfig struct {
	Path string
}

// Load 从环境变量加载配置
func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Address: getEnv("SERVER_ADDRESS", ":8080"),
			Mode:    getEnv("GIN_MODE", "debug"),
		},
		Database: DatabaseConfig{
			Path: getEnv("DB_PATH", "./gmp_simulator.db"),
		},
	}
}

// getEnv 获取环境变量，提供默认值
func getEnv(key, defaultValue string) string {
	if value, exists := os.LookupEnv(key); exists {
		return value
	}
	return defaultValue
}

// getEnvInt 获取整数环境变量
func getEnvInt(key string, defaultValue int) int {
	if value, exists := os.LookupEnv(key); exists {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}
