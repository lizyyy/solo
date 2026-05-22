package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"
	"used-car-retry-queue/config"
	"used-car-retry-queue/database"
	"used-car-retry-queue/handlers"
	"used-car-retry-queue/routes"
	"used-car-retry-queue/services"
)

func main() {
	cfg := config.Load()

	if err := database.Init(&cfg.Database); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	receiptService := services.NewReceiptService(&cfg.Queue)
	importService := services.NewImportService(receiptService)
	queueService := services.NewQueueService(&cfg.Queue, receiptService)

	handler := handlers.NewReceiptHandler(receiptService, importService, queueService)

	if err := queueService.RecoverUnfinishedTasks(); err != nil {
		log.Printf("Warning: Failed to recover tasks: %v", err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := queueService.Start(ctx); err != nil {
			log.Printf("Queue service error: %v", err)
		}
	}()

	r := routes.SetupRouter(handler)

	go func() {
		log.Printf("Server starting on port %s...", cfg.Server.Port)
		if err := r.Run(":" + cfg.Server.Port); err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
	<-sigChan

	log.Println("Shutting down gracefully...")
	cancel()
	log.Println("Server stopped")
}
