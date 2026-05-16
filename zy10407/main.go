package main

import (
	"log"
	"net/http"
	"sampling-budget-api/handlers"
	"sampling-budget-api/storage"

	"github.com/gorilla/mux"
)

func main() {
	db, err := storage.InitDB("sampling_budget.db")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	router := mux.NewRouter()

	handler := handlers.NewHandler(db)

	router.HandleFunc("/api/v1/services", handler.CreateService).Methods("POST")
	router.HandleFunc("/api/v1/services", handler.ListServices).Methods("GET")
	router.HandleFunc("/api/v1/services/{serviceName}", handler.GetService).Methods("GET")
	router.HandleFunc("/api/v1/services/{serviceName}", handler.UpdateService).Methods("PUT")

	router.HandleFunc("/api/v1/services/{serviceName}/rules", handler.CreateSamplingRule).Methods("POST")
	router.HandleFunc("/api/v1/services/{serviceName}/rules", handler.ListSamplingRules).Methods("GET")
	router.HandleFunc("/api/v1/services/{serviceName}/rules/{ruleID}", handler.GetSamplingRule).Methods("GET")
	router.HandleFunc("/api/v1/services/{serviceName}/rules/{ruleID}", handler.UpdateSamplingRule).Methods("PUT")
	router.HandleFunc("/api/v1/services/{serviceName}/rules/{ruleID}/status", handler.UpdateRuleStatus).Methods("PATCH")

	router.HandleFunc("/api/v1/services/{serviceName}/budget", handler.GetBudget).Methods("GET")
	router.HandleFunc("/api/v1/services/{serviceName}/budget/deduct", handler.DeductBudget).Methods("POST")
	router.HandleFunc("/api/v1/services/{serviceName}/budget/compensate", handler.CompensateBudget).Methods("POST")
	router.HandleFunc("/api/v1/services/{serviceName}/budget/manual-correction", handler.ManualCorrection).Methods("POST")

	router.HandleFunc("/api/v1/services/{serviceName}/adjustments", handler.CreateAdjustment).Methods("POST")
	router.HandleFunc("/api/v1/services/{serviceName}/adjustments", handler.ListAdjustments).Methods("GET")
	router.HandleFunc("/api/v1/services/{serviceName}/adjustments/{adjustmentID}", handler.GetAdjustment).Methods("GET")
	router.HandleFunc("/api/v1/services/{serviceName}/adjustments/{adjustmentID}/approve", handler.ApproveAdjustment).Methods("POST")
	router.HandleFunc("/api/v1/services/{serviceName}/adjustments/{adjustmentID}/reject", handler.RejectAdjustment).Methods("POST")

	router.HandleFunc("/api/v1/services/{serviceName}/reports", handler.GenerateReport).Methods("GET")
	router.HandleFunc("/api/v1/services/{serviceName}/reports/export", handler.ExportReport).Methods("GET")

	router.HandleFunc("/api/v1/exception-logs", handler.ListExceptionLogs).Methods("GET")
	router.HandleFunc("/api/v1/exception-logs/{logID}", handler.GetExceptionLog).Methods("GET")

	router.HandleFunc("/api/v1/sample-data", handler.LoadSampleData).Methods("POST")

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", router))
}
