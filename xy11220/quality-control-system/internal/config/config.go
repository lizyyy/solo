package config

import (
	"os"

	"gopkg.in/yaml.v3"
)

type Config struct {
	Server   ServerConfig   `yaml:"server"`
	Database DatabaseConfig `yaml:"database"`
	Security SecurityConfig `yaml:"security"`
	Rules    RulesConfig    `yaml:"rules"`
	Export   ExportConfig   `yaml:"export"`
	Logging  LoggingConfig  `yaml:"logging"`
}

type ServerConfig struct {
	Port int    `yaml:"port"`
	Mode string `yaml:"mode"`
}

type DatabaseConfig struct {
	Driver string `yaml:"driver"`
	DSN    string `yaml:"dsn"`
}

type SecurityConfig struct {
	MaskPhone      bool     `yaml:"mask_phone"`
	MaskIDCard     bool     `yaml:"mask_id_card"`
	SensitiveFields []string `yaml:"sensitive_fields"`
}

type RulesConfig struct {
	SampleRetentionHours         int  `yaml:"sample_retention_hours"`
	MinTemperature               float64 `yaml:"min_temperature"`
	MaxTemperature               float64 `yaml:"max_temperature"`
	TemperatureCheckIntervalMinutes int `yaml:"temperature_check_interval_minutes"`
	AutoDestroyEnabled           bool `yaml:"auto_destroy_enabled"`
}

type ExportConfig struct {
	Enabled   bool   `yaml:"enabled"`
	Format    string `yaml:"format"`
	OutputDir string `yaml:"output_dir"`
}

type LoggingConfig struct {
	Level         string `yaml:"level"`
	Format        string `yaml:"format"`
	MaskSensitive bool   `yaml:"mask_sensitive"`
}

func Load(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, err
	}

	return &cfg, nil
}
