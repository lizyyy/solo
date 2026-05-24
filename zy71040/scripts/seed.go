package main

import (
	"log"

	"pv-inverter-warranty/config"
	"pv-inverter-warranty/service"
	"pv-inverter-warranty/store"
)

func main() {
	cfg := config.Load()

	db, err := store.NewSQLiteDB(cfg.DBPath)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer db.Close()

	if err := db.Migrate(); err != nil {
		log.Fatalf("Failed to migrate database: %v", err)
	}

	svc := service.NewWarrantyService(db)

	if err := svc.SeedData(); err != nil {
		log.Fatalf("Failed to seed data: %v", err)
	}

	log.Println("Data seeded successfully!")

	reps, _ := svc.ListReplacements()
	log.Printf("Current replacements count: %d", len(reps))

	selfCheck, _ := svc.SelfCheck()
	log.Printf("Self check result: %+v", selfCheck)
}
