package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"path/filepath"

	"middleware-diagnostic/internal/database"
	"middleware-diagnostic/internal/handler"
	"middleware-diagnostic/internal/service"
)

func main() {
	port := flag.Int("port", 8080, "HTTP server port")
	dbPath := flag.String("db", "./data/middleware-diagnostic.db", "SQLite database path")
	flag.Parse()

	log.Println("Initializing middleware diagnostic service...")

	dbDir := filepath.Dir(*dbPath)
	if err := os.MkdirAll(dbDir, 0755); err != nil {
		log.Fatalf("Failed to create database directory: %v", err)
	}

	db, err := database.InitDB(*dbPath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	svc := service.NewService(db)
	if err := svc.Initialize(); err != nil {
		log.Fatalf("Failed to initialize service: %v", err)
	}

	h := handler.NewHandler(svc)

	mux := http.NewServeMux()

	mux.HandleFunc("/health", h.HealthCheck)

	mux.HandleFunc("/import", h.ImportData)

	mux.HandleFunc("/routes", h.ListRoutes)
	mux.HandleFunc("/routes/", h.GetRouteChain)

	mux.HandleFunc("/diagnostics/run", h.RunDiagnostics)
	mux.HandleFunc("/risks", h.ListRisks)
	mux.HandleFunc("/risks/", h.UpdateRiskStatus)

	mux.HandleFunc("/replay", h.ReplayRequests)

	mux.HandleFunc("/export", h.ExportReport)

	mux.HandleFunc("/traces/", h.GetRequestTrace)

	mux.HandleFunc("/rules/reload", h.ReloadRules)

	addr := fmt.Sprintf(":%d", *port)
	log.Printf("Server starting on %s...", addr)
	log.Printf("Database: %s", *dbPath)
	log.Println("Available endpoints:")
	log.Println("  GET  /health                      - Health check")
	log.Println("  POST /import?type=<type>&file=<path> - Import data")
	log.Println("       types: routes, middlewares, request-traces, context-events, policies")
	log.Println("  GET  /routes                      - List all routes")
	log.Println("  GET  /routes/<id>                 - Get route with middlewares")
	log.Println("  GET  /routes/<id>/chain           - Get route chain analysis")
	log.Println("  GET  /routes/<id>?suggestion=true - Get middleware order suggestion")
	log.Println("  POST /diagnostics/run             - Run all diagnostics")
	log.Println("  GET  /risks                       - List all risks")
	log.Println("  GET  /risks?status=<status>       - Filter risks by status")
	log.Println("       status: new, confirmed, false_positive, resolved")
	log.Println("  PATCH /risks/<id>/status          - Update risk status")
	log.Println("  POST /replay                      - Replay requests")
	log.Println("  GET  /export?format=<format>      - Export report")
	log.Println("       formats: json, markdown, csv")
	log.Println("  GET  /traces/<id>                 - Get request trace")
	log.Println("  GET  /traces/<id>?events=true     - Get trace with context events")
	log.Println("  POST /rules/reload                - Reload diagnostic rules")

	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
