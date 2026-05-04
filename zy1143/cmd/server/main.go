package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"localmq/internal/api"
	"localmq/internal/service"
	"localmq/internal/storage"
)

var (
	dbPath  = flag.String("db", "./data/localmq.db", "SQLite database path")
	port    = flag.Int("port", 8080, "HTTP server port")
	cleanup = flag.Bool("cleanup", true, "Enable background cleanup of expired messages")
)

func main() {
	flag.Parse()

	log.Printf("Starting LocalMQ server...")
	log.Printf("Database path: %s", *dbPath)
	log.Printf("Port: %d", *port)

	store, err := storage.NewSQLiteStore(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	svc := service.NewMessageService(store)
	handler := api.NewHandler(svc)

	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/v1/queues", handler.CreateQueue)
	mux.HandleFunc("GET /api/v1/queues", handler.GetQueue)
	mux.HandleFunc("POST /api/v1/messages/enqueue", handler.Enqueue)
	mux.HandleFunc("POST /api/v1/messages/reserve", handler.Reserve)
	mux.HandleFunc("POST /api/v1/messages/ack", handler.Ack)
	mux.HandleFunc("POST /api/v1/messages/nack", handler.Nack)
	mux.HandleFunc("POST /api/v1/messages/extend-lease", handler.ExtendLease)
	mux.HandleFunc("GET /api/v1/queues/stats", handler.Stats)
	mux.HandleFunc("GET /api/v1/messages/peek", handler.Peek)
	mux.HandleFunc("GET /api/v1/messages", handler.GetMessage)
	mux.HandleFunc("GET /api/v1/messages/audit", handler.GetAuditLogs)
	mux.HandleFunc("POST /api/v1/messages/replay-dead", handler.ReplayDeadLetter)
	mux.HandleFunc("GET /api/v1/queues/export", handler.Export)
	mux.HandleFunc("GET /health", handler.Health)

	if *cleanup {
		go startBackgroundCleanup(svc)
	}

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", *port),
		Handler: mux,
	}

	go func() {
		log.Printf("Server listening on port %d", *port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server error: %v", err)
		}
	}()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	<-sigChan
	log.Println("Shutting down server...")
	store.Close()
	log.Println("Server stopped")
}

func startBackgroundCleanup(svc *service.MessageService) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		if err := svc.UpdateExpiredMessages(); err != nil {
			log.Printf("Warning: Failed to update expired messages: %v", err)
		}
		if err := svc.UpdatePendingMessages(); err != nil {
			log.Printf("Warning: Failed to update pending messages: %v", err)
		}
	}
}
