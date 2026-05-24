package config

type Config struct {
	ServerPort     string
	DatabasePath   string
	ThawWindowHours int
}

func Load() *Config {
	return &Config{
		ServerPort:      ":8080",
		DatabasePath:    "./reagent.db",
		ThawWindowHours: 24,
	}
}
