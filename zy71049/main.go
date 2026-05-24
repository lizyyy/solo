package main

import (
	"fmt"
	"log"
	"os"

	"gopkg.in/yaml.v3"
	"print-proof-api/internal/database"
	"print-proof-api/internal/router"
)

type Config struct {
	Server struct {
		Port int    `yaml:"port"`
		Mode string `yaml:"mode"`
	} `yaml:"server"`
	Database struct {
		Path string `yaml:"path"`
	} `yaml:"database"`
	Export struct {
		OutputDir string `yaml:"output_dir"`
	} `yaml:"export"`
}

func loadConfig() (*Config, error) {
	data, err := os.ReadFile("config.yaml")
	if err != nil {
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	return &config, nil
}

func main() {
	config, err := loadConfig()
	if err != nil {
		log.Printf("Warning: failed to load config, using defaults: %v", err)
		config = &Config{}
		config.Server.Port = 8080
		config.Database.Path = "./data/print_proof.db"
	}

	if err := database.InitDB(config.Database.Path); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.CloseDB()
	log.Println("Database initialized successfully")

	r := router.SetupRouter()

	addr := fmt.Sprintf(":%d", config.Server.Port)
	log.Printf("Server starting on %s", addr)
	log.Printf("API base URL: http://localhost%s/api/v1", addr)

	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
