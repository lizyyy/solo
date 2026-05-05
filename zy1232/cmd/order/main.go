package main

import (
	"flag"
	"os"
	"os/signal"
	"syscall"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"

	"github.com/zy1232/microservice-framework/services/order"
)

func main() {
	port := flag.Int("port", 8092, "Order service port")
	flag.Parse()

	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	zerolog.SetGlobalLevel(zerolog.InfoLevel)

	svc := order.NewService(*port)

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		if err := svc.Run(); err != nil {
			log.Fatal().Err(err).Msg("Order service failed")
		}
	}()

	log.Info().Int("port", *port).Msg("Order service started")

	<-stop
	log.Info().Msg("Order service stopping...")
}
