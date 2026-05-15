package main

import (
	"customer-probe-api/internal/handler"
	"customer-probe-api/pkg/database"
	"log"
	"net/http"
	"strings"
)

func main() {
	if err := database.InitDB(); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	log.Println("Database initialized successfully")

	envHandler := handler.NewEnvironmentHandler()
	taskHandler := handler.NewTaskHandler()
	exportHandler := handler.NewExportHandler()

	mux := http.NewServeMux()

	mux.HandleFunc("/api/environments", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			envHandler.CreateEnvironment(w, r)
		case http.MethodGet:
			envHandler.ListEnvironments(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/environments/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		if strings.HasSuffix(path, "/proxies") {
			switch r.Method {
			case http.MethodPost:
				envHandler.AddProxySetting(w, r)
			case http.MethodGet:
				envHandler.GetProxySettings(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
			return
		}

		switch r.Method {
		case http.MethodGet:
			envHandler.GetEnvironment(w, r)
		case http.MethodPut:
			envHandler.UpdateEnvironment(w, r)
		case http.MethodDelete:
			envHandler.DeleteEnvironment(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/proxies/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodDelete {
			envHandler.DeleteProxySetting(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/tasks", func(w http.ResponseWriter, r *http.Request) {
		switch r.Method {
		case http.MethodPost:
			taskHandler.CreateTask(w, r)
		case http.MethodGet:
			taskHandler.ListTasks(w, r)
		default:
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/tasks/idempotency", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			taskHandler.GetTaskByIdempotencyKey(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/tasks/", func(w http.ResponseWriter, r *http.Request) {
		path := r.URL.Path
		switch {
		case strings.HasSuffix(path, "/assign"):
			if r.Method == http.MethodPost {
				taskHandler.AssignTask(w, r)
			} else {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
		case strings.HasSuffix(path, "/start"):
			if r.Method == http.MethodPost {
				taskHandler.StartTask(w, r)
			} else {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
		case strings.HasSuffix(path, "/complete"):
			if r.Method == http.MethodPost {
				taskHandler.CompleteTask(w, r)
			} else {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
		case strings.HasSuffix(path, "/fail"):
			if r.Method == http.MethodPost {
				taskHandler.FailTask(w, r)
			} else {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
		case strings.HasSuffix(path, "/timeout"):
			if r.Method == http.MethodPost {
				taskHandler.TimeoutTask(w, r)
			} else {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
		case strings.HasSuffix(path, "/full"):
			if r.Method == http.MethodGet {
				taskHandler.GetTaskFullData(w, r)
			} else {
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
		default:
			switch r.Method {
			case http.MethodGet:
				taskHandler.GetTask(w, r)
			default:
				http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			}
		}
	})

	mux.HandleFunc("/api/export/tasks/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			exportHandler.ExportTaskEvidence(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/api/export/environments/", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodGet {
			exportHandler.ExportHistory(w, r)
		} else {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		}
	})

	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte(`{"status":"ok","service":"customer-probe-api"}`))
	})

	log.Println("Server starting on :8080")
	log.Println("API Endpoints:")
	log.Println("  GET  /health")
	log.Println("  POST /api/environments")
	log.Println("  GET  /api/environments")
	log.Println("  GET  /api/environments/{id}")
	log.Println("  PUT  /api/environments/{id}")
	log.Println("  DELETE /api/environments/{id}")
	log.Println("  POST /api/environments/{id}/proxies")
	log.Println("  GET  /api/environments/{id}/proxies")
	log.Println("  DELETE /api/proxies/{id}")
	log.Println("  POST /api/tasks")
	log.Println("  GET  /api/tasks")
	log.Println("  GET  /api/tasks/{id}")
	log.Println("  GET  /api/tasks/{id}/full")
	log.Println("  POST /api/tasks/{id}/assign")
	log.Println("  POST /api/tasks/{id}/start")
	log.Println("  POST /api/tasks/{id}/complete")
	log.Println("  POST /api/tasks/{id}/fail")
	log.Println("  POST /api/tasks/{id}/timeout")
	log.Println("  GET  /api/tasks/idempotency?key={key}")
	log.Println("  GET  /api/export/tasks/{id}/evidence")
	log.Println("  GET  /api/export/environments/{id}/history")

	log.Fatal(http.ListenAndServe(":8080", mux))
}
