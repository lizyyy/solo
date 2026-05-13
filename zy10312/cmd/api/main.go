package main

import (
	"log"
	"net/http"

	"multi-cloud-storage-router/internal/handler"
	"multi-cloud-storage-router/internal/service"
)

func main() {
	store := service.NewStore()
	router := service.NewRouterService(store)
	h := handler.NewHandler(store, router)

	mux := http.NewServeMux()

	mux.HandleFunc("POST /api/buckets", h.CreateBucket)
	mux.HandleFunc("GET /api/buckets", h.ListBuckets)
	mux.HandleFunc("POST /api/strategies", h.CreateStrategy)
	mux.HandleFunc("POST /api/uploads", h.CreateUploadRequest)
	mux.HandleFunc("POST /api/uploads/{id}/route", h.RouteUpload)
	mux.HandleFunc("POST /api/uploads/{id}/failover", h.HandleFailover)
	mux.HandleFunc("POST /api/uploads/{id}/checksum", h.VerifyChecksum)
	mux.HandleFunc("POST /api/uploads/{id}/link", h.GenerateLink)
	mux.HandleFunc("POST /api/uploads/{id}/complete", h.CompleteUpload)
	mux.HandleFunc("GET /api/uploads/{id}/history", h.GetUploadHistory)
	mux.HandleFunc("GET /api/uploads/{id}", h.GetUploadRequest)
	mux.HandleFunc("GET /api/history", h.ListAllHistory)

	log.Println("Multi-Cloud Storage Router API starting on :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
