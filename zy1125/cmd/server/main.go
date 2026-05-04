package main

import (
	"context"
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gorilla/mux"

	"config-manager/internal/api"
	"config-manager/internal/service"
	"config-manager/internal/store"
)

func main() {
	var (
		port   int
		dbPath string
		seed   bool
	)

	flag.IntVar(&port, "port", 8080, "HTTP server port")
	flag.StringVar(&dbPath, "db", "./config_manager.db", "SQLite database path")
	flag.BoolVar(&seed, "seed", false, "Seed test data on startup")
	flag.Parse()

	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("Starting config manager service...")
	log.Printf("  Port: %d", port)
	log.Printf("  Database: %s", dbPath)

	st, err := store.NewStore(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize store: %v", err)
	}
	defer st.Close()

	if seed {
		log.Printf("Seeding test data...")
		if err := st.SeedTestData(); err != nil {
			log.Printf("Warning: seed failed (may already exist): %v", err)
		} else {
			log.Printf("Test data seeded successfully")
		}
	}

	cfgService := service.NewConfigService(st)
	handler := api.NewHandler(cfgService)

	r := mux.NewRouter()

	r.HandleFunc("/health", handler.HealthCheck).Methods("GET")

	r.HandleFunc("/api/v1/tenants", handler.CreateTenant).Methods("POST")

	r.HandleFunc("/api/v1/configs/{config_id}/versions", handler.CreateConfigVersion).Methods("POST")
	r.HandleFunc("/api/v1/configs/{config_id}/validate", handler.ValidateConfigVersion).Methods("POST")

	r.HandleFunc("/api/v1/versions/{old_version_id}/diff/{new_version_id}", handler.DiffVersions).Methods("GET")

	r.HandleFunc("/api/v1/releases", handler.CreateRelease).Methods("POST")
	r.HandleFunc("/api/v1/releases/{release_id}/start", handler.StartRelease).Methods("POST")
	r.HandleFunc("/api/v1/releases/{release_id}/pause", handler.PauseRelease).Methods("POST")
	r.HandleFunc("/api/v1/releases/{release_id}/resume", handler.ResumeRelease).Methods("POST")
	r.HandleFunc("/api/v1/releases/{release_id}/complete", handler.CompleteRelease).Methods("POST")
	r.HandleFunc("/api/v1/releases/{release_id}/rollback", handler.RollbackRelease).Methods("POST")
	r.HandleFunc("/api/v1/releases/{release_id}/report", handler.GetReleaseReport).Methods("GET")

	r.HandleFunc("/api/v1/clients/{tenant_id}/{service_id}/{client_id}/configs", handler.GetClientConfig).Methods("GET")

	r.Use(loggingMiddleware)

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%d", port),
		Handler:      r,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 15 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	go func() {
		log.Printf("Server listening on :%d", port)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	log.Printf("Shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("Server forced to shutdown: %v", err)
	}

	log.Printf("Server exited gracefully")
}

func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("REQUEST: %s %s", r.Method, r.URL.Path)
		next.ServeHTTP(w, r)
		log.Printf("RESPONSE: %s %s - %v", r.Method, r.URL.Path, time.Since(start))
	})
}
