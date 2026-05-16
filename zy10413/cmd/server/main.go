package main

import (
	"log"
	"net/http"
	"os"
	"push-token-lifecycle/internal/handler"
	"push-token-lifecycle/internal/service"
	"push-token-lifecycle/internal/storage"

	"github.com/gorilla/mux"
)

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "push_token_lifecycle.db"
	}

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	store, err := storage.NewSQLiteStorage(dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize storage: %v", err)
	}
	defer store.Close()

	svc := service.NewLifecycleService(store)
	h := handler.NewHTTPHandler(svc)

	r := mux.NewRouter()

	r.HandleFunc("/health", h.HealthCheck).Methods("GET")

	api := r.PathPrefix("/api/v1").Subrouter()
	api.HandleFunc("/tokens/bind", h.BindToken).Methods("POST")
	api.HandleFunc("/tokens/lookup", h.GetTokenByToken).Methods("GET")
	api.HandleFunc("/tokens", h.ListTokensByUser).Methods("GET")
	api.HandleFunc("/tokens/{tokenID}", h.GetToken).Methods("GET")
	api.HandleFunc("/tokens/{tokenID}/details", h.GetTokenLifecycleDetails).Methods("GET")
	api.HandleFunc("/tokens/{tokenID}/report", h.GenerateLifecycleReport).Methods("POST")
	api.HandleFunc("/tokens/{tokenID}/unsubscribe", h.Unsubscribe).Methods("POST")
	api.HandleFunc("/tokens/correction", h.ManualCorrection).Methods("POST")
	api.HandleFunc("/push-receipts", h.RecordPushReceipt).Methods("POST")
	api.HandleFunc("/reports", h.GetReports).Methods("GET")
	api.HandleFunc("/reports/export", h.ExportReportsCSV).Methods("GET")

	log.Printf("Server starting on port %s...", port)
	log.Printf("Database path: %s", dbPath)
	log.Fatal(http.ListenAndServe(":"+port, r))
}
