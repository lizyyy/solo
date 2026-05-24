package main

import (
	"log"

	"crew-compensation-api/internal/database"
	"crew-compensation-api/internal/handlers"
	"github.com/gin-gonic/gin"
)

func main() {
	Run()
}

func Run() {
	db, err := database.InitDB("crew_compensation.db")
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer db.Close()

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	h := handlers.NewHandler(db)

	api := r.Group("/api/v1")
	{
		api.GET("/health", h.HealthCheck)
		applications := api.Group("/applications")
		{
			applications.POST("", h.CreateApplication)
			applications.GET("", h.ListApplications)
			applications.GET("/:id", h.GetApplication)
			applications.POST("/:id/leader-approve", h.LeaderApprove)
			applications.POST("/:id/supervisor-approve", h.SupervisorApprove)
			applications.POST("/:id/final-approve", h.FinalApprove)
			applications.POST("/:id/reject", h.Reject)
		}
	}

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
