package main

import (
	"fmt"
	"log"
	"net/http"
	"os"

	"queue-backoff-api/internal/api"
	"queue-backoff-api/internal/service"
	"queue-backoff-api/internal/storage"
)

func main() {
	store := storage.NewMemoryStorage()
	throttleSvc := service.NewThrottleService(store)
	reportSvc := service.NewReportService(store)

	handler := api.NewHandler(throttleSvc, reportSvc)
	router := api.NewRouter(handler)

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	fmt.Printf("Queue Backoff API Server starting on port %s...\n", port)
	fmt.Println("API Endpoints:")
	fmt.Println("  GET  /health - Health check")
	fmt.Println("  POST /api/v1/topics - Create topic")
	fmt.Println("  GET  /api/v1/topics - List topics")
	fmt.Println("  GET  /api/v1/topics/status - Get topic status")
	fmt.Println("  POST /api/v1/rules - Create throttle rule")
	fmt.Println("  POST /api/v1/backlog/check - Check backlog")
	fmt.Println("  POST /api/v1/messages/submit - Submit message")
	fmt.Println("  POST /api/v1/status/advance - Advance status")
	fmt.Println("  POST /api/v1/status/recovery - Check recovery")
	fmt.Println("  GET/POST /api/v1/history - Query history")
	fmt.Println("  GET/POST /api/v1/report/export - Export report")

	log.Fatal(http.ListenAndServe(":"+port, api.CORS(router)))
}
