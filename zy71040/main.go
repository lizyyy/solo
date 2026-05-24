package main

import (
	"log"
	"net/http"

	"pv-inverter-warranty/api"
	"pv-inverter-warranty/config"
	"pv-inverter-warranty/service"
	"pv-inverter-warranty/store"

	"github.com/gorilla/mux"
)

func main() {
	cfg := config.Load()

	db, err := store.NewSQLiteDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Migrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	warrantyService := service.NewWarrantyService(db)
	handler := api.NewHandler(warrantyService)

	router := mux.NewRouter()

	router.HandleFunc("/health", handler.HealthCheck).Methods("GET")
	router.HandleFunc("/self-check", handler.SelfCheck).Methods("GET")

	apiV1 := router.PathPrefix("/api/v1").Subrouter()

	apiV1.HandleFunc("/inverters", handler.RegisterInverter).Methods("POST")
	apiV1.HandleFunc("/inverters/{sn}", handler.GetInverter).Methods("GET")
	apiV1.HandleFunc("/inverters", handler.ListInverters).Methods("GET")

	apiV1.HandleFunc("/fault-codes", handler.RegisterFaultCode).Methods("POST")
	apiV1.HandleFunc("/fault-codes", handler.ListFaultCodes).Methods("GET")

	apiV1.HandleFunc("/spare-parts", handler.RegisterSparePart).Methods("POST")
	apiV1.HandleFunc("/spare-parts/{sn}", handler.GetSparePart).Methods("GET")
	apiV1.HandleFunc("/spare-parts", handler.ListSpareParts).Methods("GET")

	apiV1.HandleFunc("/factory-orders", handler.RegisterFactoryOrder).Methods("POST")
	apiV1.HandleFunc("/factory-orders/{id}", handler.GetFactoryOrder).Methods("GET")
	apiV1.HandleFunc("/factory-orders", handler.ListFactoryOrders).Methods("GET")

	apiV1.HandleFunc("/replacements", handler.CreateReplacement).Methods("POST")
	apiV1.HandleFunc("/replacements/{id}", handler.GetReplacement).Methods("GET")
	apiV1.HandleFunc("/replacements", handler.ListReplacements).Methods("GET")
	apiV1.HandleFunc("/replacements/{id}/verify", handler.VerifyReplacement).Methods("POST")
	apiV1.HandleFunc("/replacements/{id}/review", handler.ReviewReplacement).Methods("POST")
	apiV1.HandleFunc("/replacements/{id}/accept", handler.AcceptReplacement).Methods("POST")
	apiV1.HandleFunc("/replacements/{id}/reject", handler.RejectReplacement).Methods("POST")
	apiV1.HandleFunc("/replacements/{id}/evidence", handler.UpdateEvidence).Methods("PUT")

	apiV1.HandleFunc("/warranty-reports/summary", handler.GetSummaryReport).Methods("GET")
	apiV1.HandleFunc("/warranty-reports/{id}/export", handler.ExportWarrantyReport).Methods("GET")
	apiV1.HandleFunc("/warranty-reports/{id}", handler.GetWarrantyReport).Methods("GET")
	apiV1.HandleFunc("/warranty-reports", handler.ListWarrantyReports).Methods("GET")

	apiV1.HandleFunc("/trace/{id}", handler.TraceRecord).Methods("GET")

	log.Printf("Server starting on port %s...", cfg.Port)
	log.Printf("API documentation: GET /api/v1/ (visit for endpoint list)")
	log.Fatal(http.ListenAndServe(":"+cfg.Port, router))
}
