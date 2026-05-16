package main

import (
	"config-rollback-api/api"
	"config-rollback-api/service"
	"config-rollback-api/store"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"
)

func main() {
	for _, arg := range os.Args {
		if arg == "--test" || arg == "-test" {
			RunSelfTests()
			return
		}
	}

	memStore := store.NewMemoryStore()
	rollbackService := service.NewRollbackService(memStore)
	handler := api.NewHandler(rollbackService)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	workDir, _ := os.Getwd()
	staticDir := filepath.Join(workDir, "static")
	if _, err := os.Stat(staticDir); err == nil {
		fs := http.FileServer(http.Dir(staticDir))
		mux.Handle("/", fs)
	}

	fmt.Println("异常配置回滚判定 API 服务启动中...")
	fmt.Println("监听端口: 8080")
	fmt.Println("管理控制台: http://localhost:8080/")
	fmt.Println("健康检查: http://localhost:8080/health")
	fmt.Println("API 文档:")
	fmt.Println("  POST /api/releases          - 创建配置发布")
	fmt.Println("  GET  /api/releases          - 列出所有发布")
	fmt.Println("  GET  /api/releases/{id}     - 获取发布详情")
	fmt.Println("  POST /api/releases/{id}/start   - 启动发布")
	fmt.Println("  POST /api/releases/{id}/baseline - 设置基线")
	fmt.Println("  POST /api/releases/{id}/threshold - 设置异常阈值")
	fmt.Println("  POST /api/releases/{id}/observe/start - 开始观察")
	fmt.Println("  POST /api/releases/{id}/observe - 观察指标")
	fmt.Println("  POST /api/releases/{id}/success - 确认成功")
	fmt.Println("  POST /api/releases/{id}/rollback - 手动回滚")
	fmt.Println("  GET  /api/releases/{id}/decisions - 获取判定历史")
	fmt.Println("  GET  /api/decisions        - 获取所有判定记录")
	fmt.Println("")
	fmt.Println("运行自测: ./test.sh 或 go run . --test")

	log.Fatal(http.ListenAndServe(":8080", mux))
}
