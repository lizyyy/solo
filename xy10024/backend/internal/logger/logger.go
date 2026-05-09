package logger

import (
	"device-borrow-system/internal/config"
	"log"
)

func Init(cfg *config.Config) {
	log.SetFlags(log.LstdFlags | log.Lshortfile)
}
