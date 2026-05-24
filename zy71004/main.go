package main

import (
	"log"
	"museum-exhibit-condition-api/database"
	"museum-exhibit-condition-api/handlers"
	"net/http"
)

func main() {
	if err := database.InitDB("exhibit_condition.db"); err != nil {
		log.Fatalf("Failed to init database: %v", err)
	}
	defer database.CloseDB()

	h := handlers.NewHandler()

	http.HandleFunc("/api/health", h.Health)
	http.HandleFunc("/api/records", h.RecordsHandler)
	http.HandleFunc("/api/records/", h.RecordDetailHandler)
	http.HandleFunc("/api/records/{id}/validate", h.ValidateHandler)
	http.HandleFunc("/api/records/{id}/process", h.ProcessHandler)
	http.HandleFunc("/api/records/{id}/dispute", h.DisputeHandler)
	http.HandleFunc("/api/records/{id}/reject", h.RejectHandler)
	http.HandleFunc("/api/records/{id}/close", h.CloseHandler)
	http.HandleFunc("/api/records/{id}/revoke", h.RevokeHandler)
	http.HandleFunc("/api/records/{id}/versions", h.VersionsHandler)
	http.HandleFunc("/api/records/{id}/diffs", h.DiffsHandler)
	http.HandleFunc("/api/records/{id}/logs", h.LogsHandler)
	http.HandleFunc("/api/records/{id}/confirm-liability", h.ConfirmLiabilityHandler)
	http.HandleFunc("/api/records/{id}/export/json", h.ExportJSONHandler)
	http.HandleFunc("/api/records/{id}/export/csv", h.ExportCSVHandler)
	http.HandleFunc("/api/versions/{versionId}/photos", h.PhotosHandler)
	http.HandleFunc("/api/conclusions/{id}/review", h.ReviewHandler)
	http.HandleFunc("/api/statistics", h.StatisticsHandler)

	log.Println("Museum Exhibit Condition API starting on :8080")
	log.Println("Endpoints:")
	log.Println("  GET  /api/health - Health check")
	log.Println("  POST /api/records - Import record")
	log.Println("  GET  /api/records - List records")
	log.Println("  GET  /api/records/{id} - Get record")
	log.Println("  POST /api/records/{id}/validate - Validate")
	log.Println("  POST /api/records/{id}/process - Process")
	log.Println("  POST /api/records/{id}/dispute - Dispute")
	log.Println("  POST /api/records/{id}/reject - Reject")
	log.Println("  POST /api/records/{id}/close - Close")
	log.Println("  POST /api/records/{id}/revoke - Revoke")
	log.Println("  POST /api/records/{id}/versions - New version")
	log.Println("  GET  /api/records/{id}/diffs - Version diffs")
	log.Println("  GET  /api/records/{id}/logs - Operation logs")
	log.Println("  POST /api/records/{id}/confirm-liability - Confirm liability")
	log.Println("  GET  /api/records/{id}/export/json - Export JSON")
	log.Println("  GET  /api/records/{id}/export/csv - Export CSV")
	log.Println("  GET  /api/versions/{versionId}/photos - Get photos")
	log.Println("  POST /api/conclusions/{id}/review - Review conclusion")
	log.Println("  GET  /api/statistics - Statistics")

	http.ListenAndServe(":8080", nil)
}
