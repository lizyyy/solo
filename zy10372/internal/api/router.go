package api

import (
	"net/http"

	"github.com/gorilla/mux"
)

func NewRouter(h *Handler) *mux.Router {
	r := mux.NewRouter()

	r.HandleFunc("/health", h.HealthCheck).Methods("GET")

	api := r.PathPrefix("/api/v1").Subrouter()

	api.HandleFunc("/topics", h.CreateTopic).Methods("POST")
	api.HandleFunc("/topics", h.ListTopics).Methods("GET")
	api.HandleFunc("/topics/status", h.GetTopicStatus).Methods("GET")
	
	api.HandleFunc("/rules", h.CreateRule).Methods("POST")
	
	api.HandleFunc("/backlog/check", h.CheckBacklog).Methods("POST")
	
	api.HandleFunc("/messages/submit", h.SubmitMessage).Methods("POST")
	
	api.HandleFunc("/status/advance", h.AdvanceStatus).Methods("POST")
	api.HandleFunc("/status/recovery", h.CheckRecovery).Methods("POST")
	
	api.HandleFunc("/history", h.QueryHistory).Methods("POST")
	api.HandleFunc("/history", h.QueryHistory).Methods("GET")
	
	api.HandleFunc("/report/export", h.ExportReport).Methods("POST")
	api.HandleFunc("/report/export", h.ExportReport).Methods("GET")

	return r
}

func CORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}
