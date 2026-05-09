package main

import (
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"

	"chaos-simulator/internal/config"
	"chaos-simulator/internal/engine"
	"chaos-simulator/internal/scenarios"
	"chaos-simulator/web"
)

func main() {
	configPath := flag.String("config", "", "Path to config file")
	flag.Parse()

	cfg := config.Get()
	if *configPath != "" {
		if err := cfg.LoadFromFile(*configPath); err != nil {
			log.Printf("Warning: Failed to load config: %v", err)
		}
	}

	e := engine.New()
	if err := e.Init(); err != nil {
		log.Printf("Warning: Engine init error (will continue without DB/Redis): %v", err)
	}
	defer e.Close()

	registerScenarios(e)

	server := web.NewServer(e)

	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := server.Start(); err != nil {
			log.Printf("Server error: %v", err)
		}
	}()

	log.Println("Chaos Simulator started. Press Ctrl+C to stop.")
	<-sigCh
	log.Println("Shutting down...")
}

func registerScenarios(e *engine.Engine) {
	e.RegisterScenario(scenarios.NewConnectionPoolScenario(e.DB()))
	e.RegisterScenario(scenarios.NewMessageQueueScenario())
	e.RegisterScenario(scenarios.NewGoroutineLeakScenario())
	e.RegisterScenario(scenarios.NewDBLockWaitScenario(e.DB()))
	e.RegisterScenario(scenarios.NewCacheDirtyScenario(e.DB(), e.Redis()))
	e.RegisterScenario(scenarios.NewConfigDriftScenario(e.DB()))

	log.Println("Registered scenarios:")
	for _, name := range e.ListScenarios() {
		log.Printf("  - %s", name)
	}
}
