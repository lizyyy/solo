package main

import (
	"log"
	"os"
	"path/filepath"

	"go-quality-scanner/internal/config"
	"go-quality-scanner/internal/database"
	"go-quality-scanner/internal/handler"

	"github.com/gin-gonic/gin"
)

func main() {
	// 设置 Gin 模式
	gin.SetMode(gin.ReleaseMode)

	// 加载配置
	configPath := os.Getenv("CONFIG_PATH")
	if configPath == "" {
		// 默认配置路径
		exePath, err := os.Executable()
		if err != nil {
			log.Fatalf("Failed to get executable path: %v", err)
		}
		configPath = filepath.Join(filepath.Dir(exePath), "config", "rules.yaml")
		
		// 如果不存在，尝试相对路径
		if _, err := os.Stat(configPath); os.IsNotExist(err) {
			configPath = "./config/rules.yaml"
		}
	}

	log.Printf("Loading config from: %s", configPath)
	rulesConfig, err := config.LoadConfig(configPath)
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}
	log.Println("Config loaded successfully")

	// 初始化数据库
	if err := database.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.CloseDB()

	// 创建处理器
	h := handler.NewHandler(rulesConfig)

	// 创建 Gin 路由
	r := gin.Default()

	// 健康检查
	r.GET("/health", h.HealthCheck)

	// API v1 路由组
	v1 := r.Group("/api/v1")
	{
		// 扫描相关
		v1.POST("/scans", h.SubmitScan)
		v1.GET("/scans", h.GetAllScans)
		v1.GET("/scans/:id", h.GetScanResult)
		v1.GET("/scans/:id/status", h.GetScanStatus)
		v1.GET("/scans/:id/export", h.ExportReport)

		// 问题相关
		v1.POST("/issues/:issue_id/false-positive", h.MarkFalsePositive)
		v1.POST("/issues/:issue_id/resolve", h.ResolveIssue)
	}

	// 获取端口
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("Server starting on port %s...", port)
	log.Printf("API endpoints:")
	log.Printf("  GET  /health                    - Health check")
	log.Printf("  POST /api/v1/scans              - Submit new scan")
	log.Printf("  GET  /api/v1/scans              - List all scans")
	log.Printf("  GET  /api/v1/scans/:id          - Get scan result")
	log.Printf("  GET  /api/v1/scans/:id/status   - Get scan status")
	log.Printf("  GET  /api/v1/scans/:id/export   - Export report (json/markdown)")
	log.Printf("  POST /api/v1/issues/:id/false-positive - Mark as false positive")
	log.Printf("  POST /api/v1/issues/:id/resolve - Mark as resolved")

	// 启动服务
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
