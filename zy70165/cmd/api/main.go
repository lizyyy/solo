package main

import (
	"log"
	"net/http"

	"certificate-renewal-api/internal/api"
	"certificate-renewal-api/internal/config"
	"certificate-renewal-api/internal/repository"
	"certificate-renewal-api/internal/service"
)

func main() {
	cfg := config.DefaultConfig()
	
	store := repository.NewInMemoryStore()
	
	certService := service.NewCertificateService(store, cfg)
	taskService := service.NewTaskService(store, certService, cfg)
	reportService := service.NewReportService(store, cfg)
	
	handlers := api.NewHandlers(certService, taskService, reportService)
	
	mux := http.NewServeMux()
	handlers.RegisterRoutes(mux)
	
	server := &http.Server{
		Addr:         ":" + cfg.Server.Port,
		Handler:      mux,
		ReadTimeout:  cfg.Server.ReadTimeout,
		WriteTimeout: cfg.Server.WriteTimeout,
	}
	
	log.Printf("Server starting on port %s...", cfg.Server.Port)
	if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("Server failed: %v", err)
	}
}
