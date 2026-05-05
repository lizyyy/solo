package main

import (
	"flag"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/services/user"
)

func main() {
	port := flag.Int("port", 8091, "User service port")
	flag.Parse()

	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	svc := user.NewService(*port)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := svc.Run(); err != nil {
			log.Fatal().Err(err).Msg("User service failed")
		}
	}()

	log.Info().Int("port", *port).Msg("User service started")

	<-stop
	log.Info().Msg("User service stopping...")
}
