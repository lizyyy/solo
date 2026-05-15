package main

import (
	"context"
	"log"
	"longpoll-session-api/internal/handler"
	"longpoll-session-api/internal/service"
	"longpoll-session-api/internal/store"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	store := store.NewMemoryStore()
	svc := service.NewService(store)
	h := handler.NewHandler(svc)

	addr := ":8080"
	if len(os.Args) > 1 {
		addr = os.Args[1]
	}

	srv := &http.Server{
		Addr:    addr,
		Handler: h,
	}

	go func() {
		log.Printf("starting server on %s", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatalf("server error: %v", err)
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	log.Println("shutting down server...")

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		log.Fatalf("server forced to shutdown: %v", err)
	}

	log.Println("server exiting")
}
