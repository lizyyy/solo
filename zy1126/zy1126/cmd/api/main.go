package main

import (
	"context"
	"flag"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"performance-tracker/internal/config"
	"performance-tracker/internal/handlers"
	"performance-tracker/internal/middleware"
	"performance-tracker/internal/repository"
	"performance-tracker/internal/services"
	"performance-tracker/pkg/logger"

	"github.com/gorilla/mux"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	// 解析命令行参数
	configPath := flag.String("config", "", "Path to configuration file")
	flag.Parse()

	// 加载配置
	cfg, err := config.LoadConfig(*configPath)
	if err != nil {
		panic("Failed to load config: " + err.Error())
	}

	// 初始化日志
	logger.InitLogger(cfg.Logging.Level, cfg.Logging.Format)

	// 连接数据库
	db, err := gorm.Open(sqlite.Open(cfg.Database.Path), &gorm.Config{})
	if err != nil {
		logger.Fatalf("Failed to connect to database: %v", err)
	}

	// 自动迁移数据库
	repo := repository.NewRepository(db)
	if err := repo.AutoMigrate(); err != nil {
		logger.Fatalf("Failed to migrate database: %v", err)
	}

	// 初始化服务
	projectService := services.NewProjectService(repo)
	routeService := services.NewRouteService(repo)
	importService := services.NewImportService(repo)
	runService := services.NewRunService(repo)
	comparisonService := services.NewComparisonService(repo)
	attributionService := services.NewAttributionService(repo)
	reportService := services.NewReportService(repo, comparisonService, attributionService)

	// 初始化处理器
	projectHandler := handlers.NewProjectHandler(projectService)
	routeHandler := handlers.NewRouteHandler(routeService, projectService)
	importHandler := handlers.NewImportHandler(importService)
	runHandler := handlers.NewRunHandler(runService, projectService)
	analysisHandler := handlers.NewAnalysisHandler(comparisonService, attributionService)
	reportHandler := handlers.NewReportHandler(reportService)

	// 创建路由器
	router := mux.NewRouter()

	// 注册路由
	projectHandler.RegisterRoutes(router)
	routeHandler.RegisterRoutes(router)
	importHandler.RegisterRoutes(router)
	runHandler.RegisterRoutes(router)
	analysisHandler.RegisterRoutes(router)
	reportHandler.RegisterRoutes(router)

	// 添加健康检查路由
	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","timestamp":"` + time.Now().Format(time.RFC3339) + `"}`))
	})

	// 应用中间件
	handler := middleware.Chain(
		router,
		middleware.Recovery(),
		middleware.Logging(),
		middleware.CORS(
			[]string{"*"},
			[]string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
			[]string{"Content-Type", "Authorization"},
		),
	)

	// 创建服务器
	server := &http.Server{
		Addr:         cfg.Server.Host + ":" + cfg.Server.Port,
		Handler:      handler,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// 启动服务器
	go func() {
		logger.Infof("Starting server on %s:%s", cfg.Server.Host, cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Fatalf("Failed to start server: %v", err)
		}
	}()

	// 优雅关闭
	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)
	<-stop

	logger.Info("Shutting down server...")

	// 等待当前请求完成
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := server.Shutdown(ctx); err != nil {
		logger.Fatalf("Server forced to shutdown: %v", err)
	}

	logger.Info("Server stopped gracefully")
}
