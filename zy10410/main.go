package main

import (
	"fmt"
	"task-recovery-api/database"
	"task-recovery-api/handler"

	"github.com/gin-gonic/gin"
)

func main() {
	if err := database.Init(); err != nil {
		panic("数据库初始化失败: " + err.Error())
	}
	fmt.Println("数据库初始化成功")

	r := gin.Default()
	
	setupRoutes(r)
	
	fmt.Println("定时任务漏跑恢复API服务启动成功，监听端口: 8080")
	r.Run(":8080")
}

func setupRoutes(r *gin.Engine) {
	api := r.Group("/api/v1")
	{
		tasks := api.Group("/tasks")
		{
			tasks.POST("", handler.CreateTask)
			tasks.GET("", handler.QueryTasks)
			tasks.GET("/:id", handler.GetTask)
			tasks.POST("/status", handler.UpdateStatus)
			tasks.POST("/manual-fix", handler.ManualFix)
			tasks.GET("/:id/impact", handler.GetImpactSummary)
			tasks.GET("/:id/report", handler.GetReport)
			tasks.GET("/:id/export", handler.ExportReport)
		}
		
		api.POST("/detect", handler.DetectMissTask)
	}
	
	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{
			"status": "ok",
			"service": "定时任务漏跑恢复API",
		})
	})
}
