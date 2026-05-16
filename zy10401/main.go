package main

import (
	"contract-drift-api/handlers"
	"contract-drift-api/store"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	db, err := store.InitDB()
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	r := mux.NewRouter()

	contractHandler := handlers.NewContractHandler(db)
	sampleHandler := handlers.NewSampleHandler(db)
	driftHandler := handlers.NewDriftHandler(db)
	consumerHandler := handlers.NewConsumerHandler(db)
	reportHandler := handlers.NewReportHandler(db)
	exceptionHandler := handlers.NewExceptionHandler(db)

	api := r.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/contracts", contractHandler.CreateContract).Methods("POST")
	api.HandleFunc("/contracts", contractHandler.ListContracts).Methods("GET")
	api.HandleFunc("/contracts/{id}", contractHandler.GetContract).Methods("GET")

	api.HandleFunc("/samples", sampleHandler.ImportSample).Methods("POST")
	api.HandleFunc("/samples", sampleHandler.ListSamples).Methods("GET")
	api.HandleFunc("/samples/{id}", sampleHandler.GetSample).Methods("GET")
	api.HandleFunc("/samples/{id}/analyze", sampleHandler.AnalyzeSample).Methods("POST")

	api.HandleFunc("/drifts", driftHandler.ListDrifts).Methods("GET")
	api.HandleFunc("/drifts/{id}", driftHandler.GetDrift).Methods("GET")
	api.HandleFunc("/drifts/{id}/confirm", driftHandler.ConfirmDrift).Methods("POST")
	api.HandleFunc("/drifts/{id}/resolve", driftHandler.ResolveDrift).Methods("POST")

	api.HandleFunc("/consumers", consumerHandler.RegisterConsumer).Methods("POST")
	api.HandleFunc("/consumers", consumerHandler.ListConsumers).Methods("GET")
	api.HandleFunc("/consumers/{id}/confirm", consumerHandler.ConfirmSample).Methods("POST")

	api.HandleFunc("/reports/drift/{contract_id}", reportHandler.ExportDriftReport).Methods("GET")
	api.HandleFunc("/reports/full/{contract_id}", reportHandler.ExportFullReport).Methods("GET")

	api.HandleFunc("/exceptions", exceptionHandler.ListExceptions).Methods("GET")
	api.HandleFunc("/exceptions/{id}", exceptionHandler.GetException).Methods("GET")
	api.HandleFunc("/exceptions/{id}/fix", exceptionHandler.FixException).Methods("POST")

	log.Println("Server starting on :8080...")
	log.Fatal(http.ListenAndServe(":8080", r))
}
