package config

import "fmt"

type Config struct {
	Port   int
	DBPath string
}

func Load() *Config {
	return &Config{
		Port:   8080,
		DBPath: "crl.db",
	}
}

func (c *Config) GetAddr() string {
	return fmt.Sprintf(":%d", c.Port)
}
