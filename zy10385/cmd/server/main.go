package main

import (
	"log"

	"api-admission-check/internal/api"
	"api-admission-check/internal/service"
	"api-admission-check/internal/store"
)

func main() {
	s := store.NewMemoryStore()
	svc := service.NewAdmissionService(s)
	handler := api.NewHandler(svc)
	r := api.SetupRouter(handler)

	log.Println("Server starting on :8080")
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

	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
