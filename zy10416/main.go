package main

import (
	"browser-compat-exemption-api/handler"
	"browser-compat-exemption-api/storage"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
)

var (
	port      = flag.String("port", "8080", "HTTP server port")
	dbPath    = flag.String("db", "./exemptions.db", "SQLite database path")
	initSample = flag.Bool("init-sample", true, "Initialize sample data")
)

func main() {
	flag.Parse()

	if err := storage.InitDB(*dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	log.Println("Database initialized successfully")

	if *initSample {
		if err := storage.InitSampleData(); err != nil {
			log.Fatalf("Failed to initialize sample data: %v", err)
		}
		log.Println("Sample data initialized successfully")
	}

	mux := handler.SetupRoutes()
	server := &http.Server{
		Addr:    ":" + *port,
		Handler: mux,
	}

	go func() {
		log.Printf("Server starting on port %s...", *port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
	log.Println("Server stopped")

	fmt.Println(`
========================================
  浏览器兼容豁免 API 已启动
========================================
  健康检查: http://localhost:` + *port + `/health
  API文档:
    POST   /api/exemptions      - 创建豁免申请
    GET    /api/exemptions      - 查询豁免列表
    GET    /api/exemptions/:id  - 获取单个豁免
    PUT    /api/exemptions/:id/status - 更新状态
    PUT    /api/exemptions/:id/correct - 人工修正
    POST   /api/exemptions/:id/exception - 异常记录
    GET    /api/export          - 导出所有豁免
========================================
`)
}
