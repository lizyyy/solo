package main

import (
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/zy1153/pool-diagnostic/internal/api"
	"github.com/zy1153/pool-diagnostic/internal/storage"
)

func main() {
	// 初始化存储
	store, err := storage.NewBoltStore("pool_diagnostic.db")
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	// 设置 Gin 模式
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger(), gin.Recovery())

	// 注册 API 路由
	api.RegisterRoutes(r, store)

	// 获取端口配置，默认 8080
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Pool Diagnostic Service starting on port %s...", port)
	log.Printf("API base URL: http://localhost:%s/api/v1", port)
	
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
