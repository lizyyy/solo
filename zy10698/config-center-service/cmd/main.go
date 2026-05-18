package main

import (
	"config-center-service/internal/api"
	"config-center-service/internal/dao"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	err := dao.InitDB()
	if err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	r := gin.Default()

	handler := api.NewRollbackHandler()

	apiGroup := r.Group("/api/v1")
	{
		rollback := apiGroup.Group("/rollback")
		{
			rollback.POST("", handler.CreateRollback)
			rollback.POST("/:id/confirm", handler.ConfirmRollback)
			rollback.POST("/:id/execute", handler.ExecuteRollback)
			rollback.GET("/:id", handler.GetRollbackDetail)
			rollback.GET("", handler.ListRollbacks)
			rollback.GET("/:id/mismatched-instances", handler.GetMismatchedInstances)
			rollback.POST("/pull-log", handler.RecordInstancePull)
		}
	}

	log.Println("服务启动成功，监听端口: 8080")
	r.Run(":8080")
}
