package service

import (
	"log"
	"time"
)

func StartCleanupJob() {
	ticker := time.NewTicker(1 * time.Hour)
	go func() {
		for {
			select {
			case <-ticker.C:
				linkService := NewLinkService()
				count, err := linkService.CleanupExpired()
				if err != nil {
					log.Printf("Cleanup error: %v", err)
				} else {
					log.Printf("Cleaned up %d expired links", count)
				}
			}
		}
	}()
	log.Println("Cleanup job started, running every hour")
}
