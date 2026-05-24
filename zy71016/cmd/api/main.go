package main

import (
	"city-salt-api/internal/database"
	"city-salt-api/internal/handler"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := database.Init(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}
	log.Println("数据库初始化成功")

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, X-Operator")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	h := handler.NewHandler()

	api := r.Group("/api/v1")
	{
		api.POST("/dispatch/batches", h.CreateDispatchBatch)
		api.GET("/dispatch/batches", h.GetBatches)
		api.GET("/dispatch/batches/:id", h.GetBatch)
		api.GET("/dispatch/batches/:id/trajectory", h.GetBatchTrajectory)
		api.GET("/dispatch/batches/:id/export", h.ExportBatchCSV)
		api.POST("/dispatch/batches/:id/report", h.GenerateReport)

		api.GET("/dispatch/items/:id", h.GetDispatchItem)
		api.POST("/dispatch/items/:id/start", h.StartDispatch)
		api.POST("/dispatch/items/:id/status", h.UpdateRouteStatus)
		api.POST("/dispatch/items/:id/receipt", h.ConfirmReceipt)
		api.GET("/dispatch/items/:id/trajectory", h.GetItemTrajectory)

		api.GET("/anomalies", h.GetAnomalies)
		api.POST("/anomalies/:id/resolve", h.ResolveAnomaly)

		api.POST("/road-closures", h.CreateRoadClosure)
		api.GET("/road-closures", h.GetRoadClosures)
		api.POST("/road-closures/:id/close", h.CloseRoadClosure)

		api.GET("/road-sections", h.GetRoadSections)
		api.GET("/salt-depots", h.GetSaltDepots)
		api.GET("/salt-depots/low-stock", h.GetLowStockDepots)
		api.POST("/salt-depots/:id/add-stock", h.AddStock)
		api.GET("/vehicles", h.GetVehicles)
		api.GET("/weather-levels", h.GetWeatherLevels)

		api.PUT("/materials/:type/:id", h.UpdateMaterial)

		api.GET("/stats", h.GetStats)
		api.GET("/stats/export", h.ExportStatsCSV)

		api.GET("/logs/stock", h.GetStockLogs)
		api.GET("/logs/operation", h.GetOperationLogs)
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status":  "ok",
			"service": "城市除雪盐库 API",
		})
	})

	log.Println("城市除雪盐库 API 服务启动于 :8080")
	log.Println("API 文档:")
	log.Println("  GET  /health - 健康检查")
	log.Println("  POST /api/v1/dispatch/batches - 创建调拨批次")
	log.Println("  GET  /api/v1/dispatch/batches - 获取批次列表")
	log.Println("  GET  /api/v1/dispatch/batches/:id - 获取批次详情")
	log.Println("  POST /api/v1/dispatch/items/:id/start - 发车")
	log.Println("  POST /api/v1/dispatch/items/:id/status - 更新路线状态")
	log.Println("  POST /api/v1/dispatch/items/:id/receipt - 签收")
	log.Println("  GET  /api/v1/anomalies - 获取异常列表")
	log.Println("  POST /api/v1/anomalies/:id/resolve - 处理异常")
	log.Println("  GET  /api/v1/stats - 获取统计数据")
	log.Println("  GET  /api/v1/stats/export - 导出统计CSV")

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("服务启动失败: %v", err)
	}
}
