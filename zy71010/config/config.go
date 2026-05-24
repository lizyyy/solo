package config

import "time"

type Config struct {
	ServerPort        string
	DatabasePath      string
	ColdChainMinTemp  float64
	ColdChainMaxTemp  float64
	MaxOpenHours      time.Duration
	EvidenceChainSize int
}

func Load() *Config {
	return &Config{
		ServerPort:        ":8080",
		DatabasePath:      "./cold_chain.db",
		ColdChainMinTemp:  2.0,
		ColdChainMaxTemp:  8.0,
		MaxOpenHours:      6 * time.Hour,
		EvidenceChainSize: 50,
	}
}
