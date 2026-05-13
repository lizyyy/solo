package main

import (
	"fmt"
	"log"
	"time"

	"traffic-mirror-controller/internal/handler"
	"traffic-mirror-controller/internal/repository"
	"traffic-mirror-controller/internal/service"

	"github.com/gin-gonic/gin"
)

func main() {
	db, err := repository.NewDatabase("traffic_mirror.db")
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	mirrorService := service.NewMirrorService(db)
	httpHandler := handler.NewHTTPHandler(mirrorService)

	go startWorker(mirrorService)

	r := gin.Default()
	httpHandler.RegisterRoutes(r)

	fmt.Println("Traffic Mirror Controller starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

func startWorker(s *service.MirrorService) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for range ticker.C {
		s.ProcessPendingRequests(10)
	}
}
