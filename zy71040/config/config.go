package config

type Config struct {
	Port   string
	DBPath string
}

func Load() *Config {
	return &Config{
		Port:   "8099",
		DBPath: "./warranty.db",
	}
}
