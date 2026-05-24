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

		bases := api.Group("/bases")
		{
			bases.GET("", h.ListBases)
			bases.POST("", h.CreateBase)
		}

		crew := api.Group("/crew")
		{
			crew.GET("", h.ListCrew)
			crew.POST("", h.CreateCrew)
		}

		flightSegments := api.Group("/flight-segments")
		{
			flightSegments.GET("", h.ListFlightSegments)
			flightSegments.POST("", h.CreateFlightSegment)
		}

		applications := api.Group("/applications")
		{
			applications.POST("", h.CreateApplication)
			applications.GET("", h.ListApplications)
			applications.GET("/:id", h.GetApplication)
			applications.GET("/:id/trace", h.GetApplicationTrace)
			applications.POST("/:id/generate-compensation", h.GenerateCompensation)
			applications.POST("/:id/leader-approve", h.LeaderApprove)
			applications.POST("/:id/supervisor-approve", h.SupervisorApprove)
			applications.POST("/:id/final-approve", h.FinalApprove)
			applications.POST("/:id/reject", h.Reject)
			applications.GET("/export/csv", h.ExportApplicationsCSV)
		}

		compensations := api.Group("/compensations")
		{
			compensations.GET("", h.ListCompensations)
			compensations.GET("/summary", h.GetCompensationSummary)
		}
	}

	log.Println("Server starting on :8080")
	if err := r.Run(":8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
