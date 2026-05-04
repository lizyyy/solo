package main

import (
	"log"
	"os"

	"btc-recharge-service/config"
	"btc-recharge-service/database"
	"btc-recharge-service/models"
	"btc-recharge-service/routes"

	"github.com/joho/godotenv"
)

func main() {
	if err := godotenv.Load(); err != nil {
		log.Println("警告: 未找到 .env 文件，使用默认配置")
	}

	cfg := config.Load()

	db, err := database.Init(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	if os.Getenv("SEED_DATA") == "true" {
		if err := models.SeedDatabase(db); err != nil {
			log.Fatalf("种子数据初始化失败: %v", err)
		}
		log.Println("种子数据初始化完成")
	}

	r := routes.SetupRouter(db, cfg)

	log.Printf("服务启动在端口 %s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
