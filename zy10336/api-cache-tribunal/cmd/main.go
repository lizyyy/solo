package main

import (
	"api-cache-tribunal/handlers"
	"api-cache-tribunal/service"
	"api-cache-tribunal/storage"
	"fmt"
	"log"
	"net/http"
)

func main() {
	store := storage.NewMemoryStorage()
	svc := service.NewTribunalService(store)
	handler := handlers.NewAPIHandler(svc)
	mux := http.NewServeMux()
	mux.HandleFunc("/strategies", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			handler.CreateStrategy(w, r)
		} else {
			handler.ListStrategies(w, r)
		}
	})
	mux.HandleFunc("/cache/check", handler.CheckCache)
	mux.HandleFunc("/cache/records", func(w http.ResponseWriter, r *http.Request) {
		if r.Method == http.MethodPost {
			handler.CreateRecord(w, r)
		} else {
			handler.ListRecords(w, r)
		}
	})
	mux.HandleFunc("/cache/records/status", handler.UpdateRecordStatus)
	mux.HandleFunc("/cache/invalidate", handler.InvalidateCache)
	mux.HandleFunc("/cache/bypass", handler.CreateBypass)
	mux.HandleFunc("/cache/history", handler.GetRecordHistory)
	mux.HandleFunc("/cache/export", handler.ExportRecords)
	mux.HandleFunc("/audit/logs", handler.GetAuditLogs)
	fmt.Println("API 响应缓存审判台启动于 :8080")
	log.Fatal(http.ListenAndServe(":8080", mux))
}
