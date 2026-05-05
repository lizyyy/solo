package main

import (
	"flag"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/internal/config"
	"github.com/zy1232/microservice-framework/internal/gateway"
	"github.com/zy1232/microservice-framework/internal/persistence"
	"github.com/zy1232/microservice-framework/internal/registry"
)

func main() {
	port := flag.Int("port", 8080, "Gateway port")
	configPath := flag.String("config", "./configs/config.yaml", "Path to config file")
	dataDir := flag.String("data", "./data", "Data directory for persistence")
	flag.Parse()

	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	cfgManager := config.NewManager(*configPath)
	if err := cfgManager.Load(); err != nil {
		log.Warn().Err(err).Msg("Failed to load config, using defaults")
	}

	if err := cfgManager.Watch(); err != nil {
		log.Warn().Err(err).Msg("Failed to start config watch")
	}

	store, err := persistence.NewStore(*dataDir)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create persistence store")
	}

	reg := registry.NewRegistry()

	if savedRegistry, err := store.LoadRegistry(); err == nil && len(savedRegistry) > 0 {
		for name, svc := range savedRegistry {
			for _, inst := range svc.Instances {
				_ = reg.Register(&inst)
			}
		}
		log.Info().Int("services", len(savedRegistry)).Msg("Loaded registry from persistence")
	}

	gw := gateway.NewGateway(gateway.Config{
		Registry: reg,
		Config:   cfgManager,
		Store:    store,
		Port:     *port,
	})

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := gw.Run(); err != nil {
			log.Fatal().Err(err).Msg("Gateway failed")
		}
	}()

	log.Info().Int("port", *port).Msg("Gateway started")

	<-stop
	log.Info().Msg("Gateway stopping...")
}
