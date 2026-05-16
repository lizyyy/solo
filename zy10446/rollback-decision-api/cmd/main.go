package main

import (
	"log"
	"net/http"
	"rollback-decision-api/handler"
	"rollback-decision-api/storage"

	"github.com/gorilla/mux"
)

func main() {
	if err := storage.InitDB(); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	r := mux.NewRouter()

	r.HandleFunc("/api/batches", handler.ListBatches).Methods("GET")
	r.HandleFunc("/api/batches", handler.CreateBatch).Methods("POST")
	r.HandleFunc("/api/batches/{id}", handler.GetBatch).Methods("GET")

	r.HandleFunc("/api/batches/{id}/metrics", handler.AddMetrics).Methods("POST")
	r.HandleFunc("/api/batches/{id}/metrics", handler.GetMetrics).Methods("GET")
	r.HandleFunc("/api/batches/{id}/metrics/aggregated", handler.GetAggregatedMetrics).Methods("GET")

	r.HandleFunc("/api/batches/{id}/rules", handler.AddRules).Methods("POST")
	r.HandleFunc("/api/batches/{id}/rules", handler.GetRules).Methods("GET")

	r.HandleFunc("/api/batches/{id}/evaluate", handler.EvaluateBatch).Methods("POST")
	r.HandleFunc("/api/batches/{id}/decisions", handler.GetDecisions).Methods("GET")

	r.HandleFunc("/api/batches/{id}/override", handler.ManualOverride).Methods("POST")

	r.HandleFunc("/api/batches/{id}/summary", handler.ExportSummary).Methods("GET")

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
