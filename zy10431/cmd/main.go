package main

import (
	"consumer-ownership-api/internal/handler"
	"consumer-ownership-api/pkg/database"
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	mode := os.Getenv("GIN_MODE")
	if mode == "" {
		mode = gin.ReleaseMode
	}
	gin.SetMode(mode)

	if err := database.Init(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	r := gin.Default()

	handler.NewConsumerHandler().RegisterRoutes(r)

	log.Printf("服务启动成功，监听端口: %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
