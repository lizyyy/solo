package main

import (
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"

	"saga-demo/internal/database"
	"saga-demo/internal/handlers"
	"saga-demo/internal/services"
	"saga-demo/internal/worker"
)

func main() {
	log.Println("Starting Saga Demo Service...")

	dbConfig := database.DefaultConfig()
	if err := database.Init(dbConfig); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	seedService := services.NewSeedService()
	if err := seedService.Initialize(); err != nil {
		log.Fatalf("Failed to initialize seed data: %v", err)
	}
	log.Println("Seed data initialized successfully")

	failureService := services.NewFailureService()
	orderService := services.NewOrderService(failureService)
	inventoryService := services.NewInventoryService(failureService)
	balanceService := services.NewBalanceService(failureService)
	couponService := services.NewCouponService(failureService)
	outboxService := services.NewOutboxService()
	manualService := services.NewManualHandlingService()
	compensationService := services.NewCompensationService(
		orderService,
		inventoryService,
		balanceService,
		couponService,
		manualService,
	)
	sagaService := services.NewSagaService(
		orderService,
		inventoryService,
		balanceService,
		couponService,
		outboxService,
		compensationService,
	)
	reportService := services.NewReportService(
		orderService,
		inventoryService,
		balanceService,
		couponService,
		sagaService,
		manualService,
	)

	taskWorker := worker.NewTaskWorker(
		compensationService,
		outboxService,
	)
	taskWorker.Start()
	defer taskWorker.Stop()

	router := mux.NewRouter()

	handlers.SetupRoutes(
		router,
		orderService,
		inventoryService,
		balanceService,
		couponService,
		sagaService,
		outboxService,
		compensationService,
		manualService,
		failureService,
		reportService,
		seedService,
	)

	router.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","timestamp":"` + time.Now().Format(time.RFC3339) + `"}`))
	})

	port := "8080"
	if envPort := os.Getenv("PORT"); envPort != "" {
		port = envPort
	}

	server := &http.Server{
		Addr:    ":" + port,
		Handler: router,
	}

	go func() {
		log.Printf("Server starting on port %s...", port)
		log.Printf("API endpoints:")
		log.Printf("  GET  /health                    - Health check")
		log.Printf("  POST /api/orders                - Create order")
		log.Printf("  GET  /api/orders/{id}           - Get order")
		log.Printf("  GET  /api/sagas/{id}            - Get saga status")
		log.Printf("  GET  /api/reports/consistency   - Get consistency report")
		log.Printf("  GET  /api/failures              - List active failures")
		log.Printf("  POST /api/failures              - Register failure")
		log.Printf("  DELETE /api/failures/{service}/{operation} - Disable failure")
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	log.Println("Shutting down server...")
	taskWorker.Stop()
	log.Println("Server stopped")
}
