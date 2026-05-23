package config

import (
	"database/sql"
	"os"
	"path/filepath"

	_ "github.com/mattn/go-sqlite3"
)

type Config struct {
	DBPath     string
	ServerPort string
	JWTSecret  string
	DataDir    string
}

var AppConfig *Config
var DB *sql.DB

func Init() error {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}
	
	dataDir := filepath.Join(homeDir, ".visitor-pass")
	if err := os.MkdirAll(dataDir, 0755); err != nil {
		return err
	}

	AppConfig = &Config{
		DBPath:     filepath.Join(dataDir, "visitor.db"),
		ServerPort: getEnv("SERVER_PORT", "8080"),
		JWTSecret:  getEnv("JWT_SECRET", "visitor-pass-secret-key-change-in-production"),
		DataDir:    dataDir,
	}

	DB, err = sql.Open("sqlite3", AppConfig.DBPath+"?_foreign_keys=1&_journal_mode=WAL")
	if err != nil {
		return err
	}

	return DB.Ping()
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
