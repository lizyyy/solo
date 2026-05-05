package main

import (
	"log"

	"github.com/gin-gonic/gin"
	"github.com/gmp-simulator/backend/internal/config"
	"github.com/gmp-simulator/backend/internal/database"
	"github.com/gmp-simulator/backend/internal/handler"
)

func main() {
	// 加载配置
	cfg := config.Load()

	// 初始化数据库
	db, err := database.Init(cfg.Database.Path)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// 设置 Gin 模式
	if cfg.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	// 创建 Gin 引擎
	r := gin.Default()

	// 设置路由
	handler.SetupRoutes(r, db)

	// 启动服务器
	log.Printf("GMP Simulator Server starting on %s", cfg.Server.Address)
	if err := r.Run(cfg.Server.Address); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
