package main

import (
	"fmt"
	"log"
	"net/http"
	"webhook-migration/handler"
	"webhook-migration/repository"

	"github.com/gorilla/mux"
)

func main() {
	if err := repository.InitDB(); err != nil {
		log.Fatalf("数据库初始化失败: %v", err)
	}

	r := mux.NewRouter()

	h := handler.NewMigrationHandler()

	api := r.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/migrations", h.CreateMigration).Methods("POST")
	api.HandleFunc("/migrations", h.ListMigrations).Methods("GET")
	api.HandleFunc("/migrations/{id}", h.GetMigration).Methods("GET")
	api.HandleFunc("/migrations/{id}/dual-send", h.StartDualSend).Methods("POST")
	api.HandleFunc("/migrations/{id}/reconciliation", h.StartReconciliation).Methods("POST")
	api.HandleFunc("/migrations/{id}/reconcile", h.ReconcileEvents).Methods("POST")
	api.HandleFunc("/migrations/{id}/confirm", h.ConfirmSwitch).Methods("POST")
	api.HandleFunc("/migrations/{id}/rollback", h.Rollback).Methods("POST")
	api.HandleFunc("/migrations/{id}/fix", h.ManualFix).Methods("POST")
	api.HandleFunc("/migrations/{id}/transitions", h.GetTransitions).Methods("GET")
	api.HandleFunc("/migrations/{id}/events", h.GetEvents).Methods("GET")
	api.HandleFunc("/migrations/{id}/export", h.ExportMigration).Methods("GET")

	api.HandleFunc("/events", h.RecordEvent).Methods("POST")
	api.HandleFunc("/migrations/export", h.ExportAll).Methods("GET")

	fmt.Println("Webhook 迁移管理服务启动在 :8080")
	fmt.Println("API 文档:")
	fmt.Println("  POST /api/v1/migrations - 创建迁移任务")
	fmt.Println("  GET  /api/v1/migrations - 查询迁移列表")
	fmt.Println("  GET  /api/v1/migrations/{id} - 查询迁移详情")
	fmt.Println("  POST /api/v1/migrations/{id}/dual-send - 开始双投")
	fmt.Println("  POST /api/v1/migrations/{id}/reconciliation - 开始对账")
	fmt.Println("  POST /api/v1/migrations/{id}/reconcile - 执行对账")
	fmt.Println("  POST /api/v1/migrations/{id}/confirm - 确认切换")
	fmt.Println("  POST /api/v1/migrations/{id}/rollback - 回滚")
	fmt.Println("  POST /api/v1/migrations/{id}/fix - 人工修正")
	fmt.Println("  GET  /api/v1/migrations/{id}/transitions - 状态流转历史")
	fmt.Println("  GET  /api/v1/migrations/{id}/events - 事件列表")
	fmt.Println("  GET  /api/v1/migrations/{id}/export - 导出单条迁移CSV")
	fmt.Println("  GET  /api/v1/migrations/export - 导出全部迁移CSV")
	fmt.Println("  POST /api/v1/events - 记录事件")

	log.Fatal(http.ListenAndServe(":8080", r))
}
