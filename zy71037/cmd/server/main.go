package main

import (
	"log"
	"net/http"

	"github.com/gorilla/mux"
	"night-market-api/internal/database"
	"night-market-api/internal/handlers"
)

func main() {
	if err := database.InitDB("night_market.db"); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.CloseDB()

	if err := database.SeedTestData(); err != nil {
		log.Fatalf("Failed to seed test data: %v", err)
	}

	h := handlers.NewHandler()

	r := mux.NewRouter()

	api := r.PathPrefix("/api/v1").Subrouter()

	stalls := api.PathPrefix("/stalls").Subrouter()
	stalls.HandleFunc("", h.CreateStall).Methods("POST")
	stalls.HandleFunc("", h.ListStalls).Methods("GET")

	vendors := api.PathPrefix("/vendors").Subrouter()
	vendors.HandleFunc("", h.CreateVendor).Methods("POST")
	vendors.HandleFunc("", h.ListVendors).Methods("GET")

	cycles := api.PathPrefix("/cycles").Subrouter()
	cycles.HandleFunc("", h.CreateCycle).Methods("POST")
	cycles.HandleFunc("", h.ListCycles).Methods("GET")
	cycles.HandleFunc("/{cycleId}/assignments", h.CreateAssignment).Methods("POST")
	cycles.HandleFunc("/{cycleId}/assignments", h.GetCycleAssignments).Methods("GET")
	cycles.HandleFunc("/assignments/{id}", h.RemoveAssignment).Methods("DELETE")
	cycles.HandleFunc("/{cycleId}/validate", h.ValidateCycle).Methods("POST")
	cycles.HandleFunc("/{cycleId}/finalize", h.FinalizeCycle).Methods("POST")
	cycles.HandleFunc("/{cycleId}/reopen", h.ReopenCycle).Methods("POST")
	cycles.HandleFunc("/{cycleId}/suggest", h.SuggestAssignments).Methods("GET")
	cycles.HandleFunc("/{cycleId}/report", h.GenerateReport).Methods("GET")
	cycles.HandleFunc("/{cycleId}/export", h.ExportReportCSV).Methods("GET")
	cycles.HandleFunc("/{cycleId}/swaps", h.CreateSwapRequest).Methods("POST")
	cycles.HandleFunc("/{cycleId}/swaps", h.GetCycleSwaps).Methods("GET")

	validation := api.PathPrefix("/validation").Subrouter()
	validation.HandleFunc("/assignment", h.ValidateAssignment).Methods("POST")

	complaints := api.PathPrefix("/complaints").Subrouter()
	complaints.HandleFunc("", h.CreateComplaint).Methods("POST")
	complaints.HandleFunc("/pending", h.GetPendingComplaints).Methods("GET")
	complaints.HandleFunc("/{id}/resolve", h.ResolveComplaint).Methods("POST")
	complaints.HandleFunc("/{id}/reject", h.RejectComplaint).Methods("POST")

	swaps := api.PathPrefix("/swaps").Subrouter()
	swaps.HandleFunc("/{id}/approve", h.ApproveSwap).Methods("POST")
	swaps.HandleFunc("/{id}/reject", h.RejectSwap).Methods("POST")
	swaps.HandleFunc("/{id}/complete", h.CompleteSwap).Methods("POST")
	swaps.HandleFunc("/{id}/cancel", h.CancelSwap).Methods("POST")

	audit := api.PathPrefix("/audit").Subrouter()
	audit.HandleFunc("/logs", h.GetAuditLogs).Methods("GET")

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
