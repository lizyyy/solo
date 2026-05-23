package main

import (
	"car-wash-queue-api/config"
	"car-wash-queue-api/database"
	"car-wash-queue-api/handlers"
	"car-wash-queue-api/models"
	"car-wash-queue-api/services"
	"encoding/json"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.GetConfig()

	if err := database.InitDB(cfg.DatabasePath); err != nil {
		panic("Failed to initialize database: " + err.Error())
	}
	defer database.CloseDB()

	if err := database.CreateTables(); err != nil {
		panic("Failed to create tables: " + err.Error())
	}

	r := gin.Default()

	r.Use(corsMiddleware())
	r.Use(exceptionLoggerMiddleware())

	r.GET("/api/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Message: "洗车会员排队API服务运行正常",
			Data:    gin.H{"timestamp": gin.H{}},
		})
	})

	r.GET("/api/config", func(c *gin.Context) {
		c.JSON(http.StatusOK, models.APIResponse{
			Success: true,
			Data: gin.H{
				"service_types":        cfg.ServiceTypes,
				"queue_statuses":       cfg.QueueStatuses,
				"appointment_statuses": cfg.AppointmentStatuses,
				"station_statuses":     cfg.StationStatuses,
			},
		})
	})

	api := r.Group("/api")
	{
		members := api.Group("/members")
		{
			members.POST("", handlers.CreateMember)
			members.GET("", handlers.GetMemberList)
			members.GET("/phone/:phone", handlers.GetMemberByPhone)
			members.GET("/:id", handlers.GetMemberByID)
			members.PUT("/:id", handlers.UpdateMember)
		}

		stations := api.Group("/stations")
		{
			stations.POST("", handlers.CreateStation)
			stations.GET("", handlers.GetStationList)
			stations.GET("/:id", handlers.GetStationByID)
			stations.PUT("/:id", handlers.UpdateStation)
		}

		queue := api.Group("/queue")
		{
			queue.POST("", handlers.CreateQueueNumber)
			queue.GET("", handlers.GetQueueList)
			queue.POST("/call-next", handlers.CallNextQueue)
			queue.GET("/:id", handlers.GetQueueByID)
			queue.POST("/:id/complete", handlers.CompleteQueue)
			queue.POST("/:id/overnumber", handlers.MarkOvernumber)
			queue.POST("/:id/requeue", handlers.RequeueOvernumber)
			queue.POST("/:id/cancel", handlers.CancelQueue)
			queue.PUT("/:id/manual", handlers.ManualUpdateQueue)
		}

		appointments := api.Group("/appointments")
		{
			appointments.POST("", handlers.CreateAppointment)
			appointments.GET("", handlers.GetAppointmentList)
			appointments.GET("/:id", handlers.GetAppointmentByID)
			appointments.POST("/:id/lock", handlers.LockAppointment)
			appointments.POST("/:id/cancel", handlers.CancelAppointment)
		}

		reports := api.Group("/reports")
		{
			reports.POST("/generate", handlers.GenerateReport)
			reports.GET("", handlers.GetReportList)
			reports.GET("/export", handlers.ExportReport)
			reports.GET("/overnumber", handlers.GetOvernumberRecords)
			reports.GET("/exceptions", handlers.GetExceptionLogs)
		}
	}

	r.NoRoute(func(c *gin.Context) {
		c.JSON(http.StatusNotFound, models.ErrorResponse{
			Success:    false,
			Message:    "接口不存在",
			Conclusion: "请求路径错误",
		})
	})

	println("\n========================================")
	println("🚗 洗车会员排队API服务已启动")
	println("📍 服务地址: http://localhost:" + cfg.Port)
	println("🔍 健康检查: http://localhost:" + cfg.Port + "/api/health")
	println("========================================\n")

	r.Run(":" + cfg.Port)
}

func corsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

func exceptionLoggerMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Next()

		if len(c.Errors) > 0 {
			for _, err := range c.Errors {
				var rawInput string
				if c.Request.Body != nil {
					body, _ := c.GetRawData()
					rawInput = string(body)
				}
				input := map[string]interface{}{
					"body":   rawInput,
					"query":  c.Request.URL.Query(),
					"params": c.Params,
				}
				inputJSON, _ := json.Marshal(input)

				conclusion := "返回错误响应"
				services.LogException(
					c.Request.URL.Path,
					c.Request.Method,
					string(inputJSON),
					err.Error(),
					conclusion,
				)
			}
		}
	}
}

func GetConfig() *config.Config {
	return config.GetConfig()
}

func init() {
	if _, err := os.Stat("data"); os.IsNotExist(err) {
		os.MkdirAll("data", 0755)
	}
}
