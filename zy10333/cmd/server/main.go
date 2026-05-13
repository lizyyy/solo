package main

import (
	"env-switch-guard/internal/api"
	"env-switch-guard/internal/service"
	"env-switch-guard/internal/store"
	"log"
	"net/http"

	"github.com/gorilla/mux"
)

func main() {
	s := store.NewMemoryStore()
	svc := service.NewSwitchService(s)
	handler := api.NewHandler(svc)

	r := mux.NewRouter()

	r.HandleFunc("/api/v1/switch", handler.CreateSwitchItem).Methods("POST")
	r.HandleFunc("/api/v1/ticket", handler.CreateTicket).Methods("POST")
	r.HandleFunc("/api/v1/ticket/validate", handler.ValidateTicket).Methods("POST")
	r.HandleFunc("/api/v1/ticket/approve", handler.ApproveTicket).Methods("POST")
	r.HandleFunc("/api/v1/ticket/execute", handler.ExecuteTicket).Methods("POST")
	r.HandleFunc("/api/v1/ticket", handler.GetTicket).Methods("GET")
	r.HandleFunc("/api/v1/tickets", handler.ListTickets).Methods("GET")
	r.HandleFunc("/api/v1/result", handler.GetResult).Methods("GET")
	r.HandleFunc("/api/v1/export", handler.ExportTickets).Methods("GET")

	log.Println("环境开关防误触服务启动于 :8080")
	log.Fatal(http.ListenAndServe(":8080", r))
}
