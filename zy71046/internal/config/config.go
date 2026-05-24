package config

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	Storage  StorageConfig
}

type ServerConfig struct {
	Port string
	Mode string
}

type DatabaseConfig struct {
	Path string
}

type StorageConfig struct {
	UploadPath string
	ReportPath string
}

func Load() *Config {
	return &Config{
		Server: ServerConfig{
			Port: "8080",
			Mode: "debug",
		},
		Database: DatabaseConfig{
			Path: "data/exemption.db",
		},
		Storage: StorageConfig{
			UploadPath: "data/uploads",
			ReportPath: "data/reports",
		},
	}
}
