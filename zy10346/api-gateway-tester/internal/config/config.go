package config

type Config struct {
	Port         string
	DatabasePath string
}

func Load() *Config {
	return &Config{
		Port:         "8080",
		DatabasePath: "api_gateway_tester.db",
	}
}
