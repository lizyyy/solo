package handler

import (
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"gorm.io/gorm"
)

// SetupRoutes 配置所有路由
func SetupRoutes(r *gin.Engine, db *gorm.DB) {
	// 配置 CORS
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
	}))

	// API v1 路由组
	v1 := r.Group("/api/v1")
	{
		// 实验管理
		exp := v1.Group("/experiments")
		{
			exp.GET("", GetExperiments(db))
			exp.GET("/:id", GetExperiment(db))
			exp.POST("", CreateExperiment(db))
			exp.PUT("/:id", UpdateExperiment(db))
			exp.DELETE("/:id", DeleteExperiment(db))
			
			// 实验操作
			exp.POST("/:id/start", StartExperiment(db))
			exp.POST("/:id/pause", PauseExperiment(db))
			exp.POST("/:id/stop", StopExperiment(db))
			
			// 实验数据
			exp.GET("/:id/timeline", GetTimeline(db))
			exp.GET("/:id/events", GetEvents(db))
			exp.GET("/:id/snapshots", GetSnapshots(db))
			exp.GET("/:id/statistics", GetStatistics(db))
		}

		// 事件查询
		events := v1.Group("/events")
		{
			events.GET("", GetAllEvents(db))
			events.GET("/:id", GetEventByID(db))
		}

		// 队列快照
		snapshots := v1.Group("/snapshots")
		{
			snapshots.GET("", GetAllSnapshots(db))
			snapshots.GET("/:id", GetSnapshotByID(db))
		}

		// Trace 导入
		traces := v1.Group("/traces")
		{
			traces.POST("/import", ImportTrace(db))
			traces.GET("", GetTraceImports(db))
			traces.GET("/:id", GetTraceImport(db))
		}

		// 报告导出
		reports := v1.Group("/reports")
		{
			reports.POST("/export/markdown", ExportMarkdownReport(db))
			reports.POST("/export/json", ExportJSONReport(db))
			reports.GET("", GetReports(db))
			reports.GET("/:id", GetReport(db))
		}

		// 系统信息
		v1.GET("/health", HealthCheck())
		v1.GET("/info", SystemInfo())
	}
}
