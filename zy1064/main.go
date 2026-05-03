package main

import (
	"coupon-risk-calculator/internal/config"
	"coupon-risk-calculator/internal/database"
	"coupon-risk-calculator/internal/handlers"
	"coupon-risk-calculator/internal/middleware"
	"fmt"
	"log"

	"github.com/gin-gonic/gin"
)

func main() {
	cfg := config.Load()

	db, err := database.InitDB(cfg.DatabasePath)
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}
	defer database.CloseDB(db)

	gin.SetMode(cfg.Mode)
	r := gin.Default()

	r.Use(middleware.ErrorHandler())

	api := r.Group("/api/v1")
	{
		productHandler := handlers.NewProductHandler(db)
		api.POST("/products/import", productHandler.ImportProducts)
		api.GET("/products", productHandler.ListProducts)
		api.GET("/products/:id", productHandler.GetProduct)
		api.DELETE("/products/:id", productHandler.DeleteProduct)

		couponHandler := handlers.NewCouponHandler(db)
		api.POST("/coupons/import", couponHandler.ImportCoupons)
		api.GET("/coupons", couponHandler.ListCoupons)
		api.GET("/coupons/:id", couponHandler.GetCoupon)
		api.DELETE("/coupons/:id", couponHandler.DeleteCoupon)

		memberHandler := handlers.NewMemberHandler(db)
		api.POST("/memberships/import", memberHandler.ImportMemberships)
		api.GET("/memberships", memberHandler.ListMemberships)
		api.GET("/memberships/:id", memberHandler.GetMembership)
		api.DELETE("/memberships/:id", memberHandler.DeleteMembership)

		cartHandler := handlers.NewCartHandler(db)
		api.POST("/carts/import", cartHandler.ImportCarts)
		api.GET("/carts", cartHandler.ListCarts)
		api.GET("/carts/:id", cartHandler.GetCart)
		api.DELETE("/carts/:id", cartHandler.DeleteCart)

		calcHandler := handlers.NewCalculationHandler(db)
		api.POST("/calculate/single", calcHandler.CalculateSingle)
		api.POST("/calculate/batch", calcHandler.CalculateBatch)

		reportHandler := handlers.NewReportHandler(db)
		api.GET("/reports/json", reportHandler.ExportJSON)
		api.GET("/reports/markdown", reportHandler.ExportMarkdown)
	}

	addr := fmt.Sprintf(":%d", cfg.Port)
	log.Printf("Server starting on %s (mode: %s)", addr, cfg.Mode)
	if err := r.Run(addr); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}
