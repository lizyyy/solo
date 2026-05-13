package main

import (
	"log"

	"crl-service/api"
	"crl-service/config"
	"crl-service/database"
)

func main() {
	cfg := config.Load()
	db := database.Init(cfg.DBPath)

	r := api.SetupRouter(db)

	log.Printf("服务器启动在 :%d", cfg.Port)
	if err := r.Run(cfg.GetAddr()); err != nil {
		log.Fatalf("服务器启动失败: %v", err)
	}
}
