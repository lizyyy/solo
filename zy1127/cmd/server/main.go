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

	"concurrency-detector/internal/api"
	"concurrency-detector/internal/store"
)

var (
	port     = flag.Int("port", 8080, "HTTP server port")
	dbPath   = flag.String("db", "./detector.db", "SQLite database path")
	addr     = flag.String("addr", "localhost", "HTTP server address")
)

func main() {
	flag.Parse()

	log.Printf("Starting Concurrency Detector...")
	log.Printf("Database: %s", *dbPath)
	log.Printf("Address: %s:%d", *addr, *port)

	s, err := store.NewStore(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}
	defer s.Close()

	server := api.NewServer(s)

	mux := http.NewServeMux()
	server.RegisterRoutes(mux)

	httpServer := &http.Server{
		Addr:         fmt.Sprintf("%s:%d", *addr, *port),
		Handler:      mux,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Printf("Server listening on http://%s:%d", *addr, *port)
		log.Printf("Health check: http://%s:%d/health", *addr, *port)
		if err := httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	<-stop
	log.Println("Shutting down server...")

	if err := httpServer.Close(); err != nil {
		log.Printf("Server close error: %v", err)
	}

	log.Println("Server stopped")
}
