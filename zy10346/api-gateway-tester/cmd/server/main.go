package main

import (
	"log"
	"net/http"

	"api-gateway-tester/internal/config"
	"api-gateway-tester/internal/handler"
	"api-gateway-tester/internal/repository"
	"api-gateway-tester/internal/service"

	"github.com/gorilla/mux"
)

func main() {
	cfg := config.Load()

	db, err := repository.NewDB(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()

	repo := repository.NewRepository(db)
	svc := service.NewService(repo)
	h := handler.NewHandler(svc)

	r := mux.NewRouter()
	h.RegisterRoutes(r)

	log.Printf("Server starting on port %s...", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, r); err != nil {
		log.Fatalf("Server failed to start: %v", err)
	}
}
