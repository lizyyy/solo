package main

import (
	"log"
	"net/http"
	"secure-unpack-api/internal/handler"
	"secure-unpack-api/internal/service"
	"secure-unpack-api/internal/store"

	"github.com/gorilla/mux"
)

func main() {
	storage := store.NewMemoryStore()
	unpackService := service.NewUnpackService(storage)
	handlers := handler.NewHandler(unpackService)

	r := mux.NewRouter()

	r.HandleFunc("/api/v1/unpack/tasks", handlers.CreateTask).Methods("POST")
	r.HandleFunc("/api/v1/unpack/tasks/{task_id}", handlers.GetTask).Methods("GET")
	r.HandleFunc("/api/v1/unpack/tasks/{task_id}/validate", handlers.ValidateTask).Methods("POST")
	r.HandleFunc("/api/v1/unpack/tasks/{task_id}/process", handlers.ProcessTask).Methods("POST")
	r.HandleFunc("/api/v1/unpack/tasks", handlers.ListTasks).Methods("GET")
	r.HandleFunc("/api/v1/unpack/tasks/{task_id}/result", handlers.ExportResult).Methods("GET")
	r.HandleFunc("/api/v1/unpack/tasks/{task_id}/risks", handlers.GetRisks).Methods("GET")

	log.Println("Server starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
