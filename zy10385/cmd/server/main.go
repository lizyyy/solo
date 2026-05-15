package main

import (
	"log"
	"os"
	"os/signal"
	"syscall"

	"api-admission-check/internal/api"
	"api-admission-check/internal/service"
	"api-admission-check/internal/store"
)

func main() {
	s, err := store.NewSQLiteStore()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer s.Close()

	svc := service.NewAdmissionService(s)
	handler := api.NewHandler(svc)
	r := api.SetupRouter(handler)

	log.Println("=== API Dependency Admission Check Service ===")
	log.Println("Database: SQLite (./data/admission.db)")
	log.Println("Server starting on :8080")
	log.Println("")
	log.Println("API Endpoints:")
	log.Println("  POST   /api/v1/applications                - Create application")
	log.Println("  GET    /api/v1/applications                - List applications")
	log.Println("  GET    /api/v1/applications/:id            - Get application")
	log.Println("  POST   /api/v1/applications/:id/submit     - Submit for review")
	log.Println("  POST   /api/v1/applications/:id/start-checking - Start checking")
	log.Println("  POST   /api/v1/applications/:id/register-dependency - Register dependency")
	log.Println("  POST   /api/v1/applications/:id/check-permissions - Check permissions")
	log.Println("  POST   /api/v1/applications/:id/check-quota - Check quota")
	log.Println("  POST   /api/v1/applications/:id/check-alerts - Check alerts")
	log.Println("  POST   /api/v1/applications/:id/approve    - Approve application")
	log.Println("  POST   /api/v1/applications/:id/reject     - Reject application")
	log.Println("  POST   /api/v1/applications/:id/cancel     - Cancel application")
	log.Println("  GET    /api/v1/applications/:id/history    - Get history")

	go func() {
		if err := r.Run(":8080"); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("Shutting down server...")
}
