package main

import (
	"elderly-meal-api/internal/handlers"
	"elderly-meal-api/pkg/database"
	"log"
	"os"

	"github.com/gin-gonic/gin"
)

func main() {
	dbPath := "./data/elderly_meal.db"
	if err := os.MkdirAll("./data", 0755); err != nil {
		log.Fatalf("Failed to create data directory: %v", err)
	}

	if err := database.Init(dbPath); err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.Close()

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

	h := handlers.NewHandler()

	api := r.Group("/api/v1")
	{
		elderly := api.Group("/elderly")
		{
			elderly.POST("", h.CreateElderly)
			elderly.GET("", h.ListElderly)
			elderly.GET("/:id", h.GetElderly)
		}

		volunteers := api.Group("/volunteers")
		{
			volunteers.POST("", h.CreateVolunteer)
			volunteers.GET("", h.ListVolunteers)
			volunteers.GET("/:id", h.GetVolunteer)
		}

		suspensions := api.Group("/suspensions")
		{
			suspensions.POST("", h.CreateSuspension)
			suspensions.GET("/:id", h.GetSuspension)
			suspensions.POST("/:id/approve", h.ApproveSuspension)
			suspensions.POST("/:id/reject", h.RejectSuspension)
			suspensions.GET("/elderly/:elderly_id", h.ListSuspensionsByElderly)
		}

		routes := api.Group("/routes")
		{
			routes.POST("", h.CreateRoute)
			routes.GET("", h.ListRoutesByDate)
			routes.GET("/:id", h.GetRoute)
			routes.GET("/request/:request_id", h.GetRouteByRequestID)
			routes.POST("/:id/assign", h.AssignRoute)
			routes.POST("/:id/start", h.StartDelivery)
			routes.POST("/:id/complete", h.CompleteDelivery)
			routes.POST("/:id/exception", h.MarkException)
			routes.GET("/volunteer/:volunteer_id", h.ListRoutesByVolunteerAndDate)
		}

		visits := api.Group("/visits")
		{
			visits.POST("", h.CreateVisit)
			visits.GET("/pending-followups", h.ListPendingFollowUps)
			visits.GET("/:id", h.GetVisit)
			visits.GET("/route/:route_id", h.GetVisitByRouteID)
			visits.POST("/:id/evidence", h.AddEvidence)
			visits.POST("/:id/followup-complete", h.MarkFollowUpComplete)
		}

		reports := api.Group("/reports")
		{
			reports.GET("/:date", h.GetReport)
			reports.POST("/:date/generate", h.GenerateReport)
			reports.GET("/:date/export", h.ExportReport)
		}
	}

	r.GET("/health", func(c *gin.Context) {
		c.JSON(200, gin.H{"status": "ok"})
	})

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
