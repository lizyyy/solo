package main

import (
	"log"
	"net/http"

	"lease-api/handler"
	"lease-api/repository"
	"lease-api/service"
)

func main() {
	db, err := repository.NewSQLiteDB("lease.db")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	if err := db.InitTables(); err != nil {
		log.Fatalf("Failed to create tables: %v", err)
	}

	repo := repository.NewRepository(db)
	timeline := service.NewTimelineService(repo)
	leaseService := service.NewLeaseService(repo, timeline)
	h := handler.NewHandler(leaseService, timeline)

	mux := http.NewServeMux()

	mux.HandleFunc("/tasks", h.CreateTask)
	mux.HandleFunc("/tasks/list", h.ListTasks)
	mux.HandleFunc("/tasks/{id}", h.GetTask)

	mux.HandleFunc("/lease/acquire", h.AcquireLease)
	mux.HandleFunc("/lease/renew", h.RenewLease)
	mux.HandleFunc("/lease/release", h.ReleaseLease)

	mux.HandleFunc("/result/submit", h.SubmitResult)

	mux.HandleFunc("/timeline/{task_id}", h.GetTaskTimeline)
	mux.HandleFunc("/diagnostics/export", h.ExportDiagnostics)

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
