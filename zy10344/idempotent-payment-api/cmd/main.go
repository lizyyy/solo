package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/idempotent-payment-api/internal/handler"
	"github.com/idempotent-payment-api/internal/repository"
	"github.com/idempotent-payment-api/internal/service"
)

func main() {
	db, err := repository.NewDatabase("./data/payment.db")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()
	log.Println("Database initialized successfully")

	if err := os.MkdirAll("./data", 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	paymentService := service.NewPaymentService(db)
	paymentHandler := handler.NewPaymentHandler(paymentService)

	go startStatusPoller(paymentService)

	r := gin.Default()

	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	api := r.Group("/api/v1")
	{
		api.POST("/payments", paymentHandler.CreatePayment)
		api.GET("/payments", paymentHandler.QueryPayment)
		api.POST("/payments/cancel", paymentHandler.CancelPayment)
		api.POST("/payments/callback", paymentHandler.ChannelCallback)
		api.POST("/payments/history", paymentHandler.QueryHistory)
		api.POST("/payments/problem-summary", paymentHandler.GetProblemSummary)
		api.POST("/payments/export-summary", paymentHandler.ExportProblemSummary)
	}

	r.GET("/health", paymentHandler.HealthCheck)

	srv := &http.Server{
		Addr:    ":8080",
		Handler: r,
	}

	go func() {
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Failed to start server: %v", err)
		}
	}()
	log.Println("Server started on :8080")

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Println("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Println("Server exited successfully")
}

func startStatusPoller(paymentService *service.PaymentService) {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	log.Println("Status poller started, interval: 10s")

	for range ticker.C {
		if err := paymentService.PollChannelStatus(); err != nil {
			log.Printf("Poll channel status error: %v", err)
		}
	}
}
