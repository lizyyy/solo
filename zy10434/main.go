package main

import (
	"log"

	"export-quota-api/api"
	"export-quota-api/service"
	"export-quota-api/storage"
)

func main() {
	store, err := storage.NewSQLiteStorage("./export_quota.db")
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	quotaManager := service.NewQuotaManager(store)
	router := api.SetupRouter(store, quotaManager)

	log.Println("Starting Export Quota API server on :8080")
	log.Println("API Endpoints:")
	log.Println("  GET  /api/v1/health - Health check")
	log.Println("  POST /api/v1/seed - Seed sample data")
	log.Println("  POST /api/v1/tenants - Create tenant")
	log.Println("  GET  /api/v1/tenants - List all tenants")
	log.Println("  GET  /api/v1/tenants/:id - Get tenant details")
	log.Println("  PUT  /api/v1/tenants/:id - Update tenant")
	log.Println("  GET  /api/v1/tenants/:tenant_id/status - Get tenant quota status")
	log.Println("  POST /api/v1/tenants/:tenant_id/adjust-quota - Manually adjust quota")
	log.Println("  POST /api/v1/tenants/:tenant_id/process-tasks - Process next queued tasks")
	log.Println("  GET  /api/v1/tenants/:tenant_id/tasks - List tenant tasks")
	log.Println("  GET  /api/v1/tenants/:tenant_id/export-csv - Export tasks to CSV")
	log.Println("  POST /api/v1/tasks - Create export task")
	log.Println("  GET  /api/v1/tasks/:id - Get task details with history")
	log.Println("  POST /api/v1/tasks/:id/complete - Mark task as completed")
	log.Println("  POST /api/v1/tasks/:id/fail - Mark task as failed")
	log.Println("  POST /api/v1/tasks/:id/retry - Manually retry task")

	if err := router.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
