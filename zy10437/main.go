package main

import (
	"log"

	"config-drift-exemption/handlers"
	"config-drift-exemption/store"

	"github.com/gin-gonic/gin"
)

func main() {
	s, err := store.NewDriftStore("./drift_exemption.db")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer s.Close()

	log.Println("Database initialized successfully")

	r := gin.Default()

	handlers.SetupRoutes(r, s)

	log.Println("Starting server on :8080")
	log.Println("API Endpoints:")
	log.Println("  POST   /api/v1/drifts                  - 创建配置漂移豁免")
	log.Println("  GET    /api/v1/drifts                  - 查询配置漂移列表")
	log.Println("  GET    /api/v1/drifts/export           - 导出配置漂移")
	log.Println("  GET    /api/v1/drifts/:id              - 获取单条记录详情")
	log.Println("  POST   /api/v1/drifts/:id/review       - 复核配置漂移")
	log.Println("  POST   /api/v1/drifts/:id/fix          - 人工修正配置")
	log.Println("  GET    /api/v1/drifts/:id/history      - 获取操作历史")
	log.Println("  POST   /api/v1/maintenance/check-expired  - 检查并标记过期豁免")
	log.Println("  GET    /api/v1/health                  - 健康检查")

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
