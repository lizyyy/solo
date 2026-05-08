package main

import (
	"context"
	"flag"
	"fmt"
	"net"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"

	pb "github.com/chaos-simulator/chaos-simulator/api/proto"
	"github.com/chaos-simulator/chaos-simulator/internal/config"
	"github.com/chaos-simulator/chaos-simulator/internal/handler"
	"github.com/chaos-simulator/chaos-simulator/internal/repository"
	"github.com/chaos-simulator/chaos-simulator/internal/service"
	"github.com/chaos-simulator/chaos-simulator/internal/utils"
	"github.com/chaos-simulator/chaos-simulator/pkg/tracer"
	"go.uber.org/zap"
	"google.golang.org/grpc"
)

var (
	configPath = flag.String("config", "./configs/config.yaml", "Path to config file")
)

func main() {
	flag.Parse()

	cfg, err := config.Load(*configPath)
	if err != nil {
		fmt.Printf("Failed to load config: %v\n", err)
		os.Exit(1)
	}

	if err := utils.InitLogger(cfg.Logging.Level, cfg.Logging.Format); err != nil {
		fmt.Printf("Failed to init logger: %v\n", err)
		os.Exit(1)
	}
	defer utils.GetLogger().Sync()

	utils.InitIdempotencyStore(30 * 60 * 1000000000)

	if err := os.MkdirAll(filepath.Dir(cfg.Database.SQLite.Path), 0755); err != nil {
		utils.GetLogger().Fatal("Failed to create data directory", zap.Error(err))
	}

	repo, err := repository.NewSQLiteRepository(cfg.Database.SQLite.Path)
	if err != nil {
		utils.GetLogger().Fatal("Failed to init database", zap.Error(err))
	}
	defer repo.Close()

	chaosManager := service.NewChaosManager(repo)

	hybridTracer, err := tracer.NewHybridTracer(repo, tracer.TracerConfig{
		OTLPEndpoint:    cfg.Tracing.OTEL.Endpoint,
		ServiceName:     "order-service",
		OTELEnabled:     cfg.Tracing.Enabled,
		BusinessEnabled: cfg.Tracing.Business.Enabled,
		BufferSize:      100,
		FlushInterval:   5 * 1000000000,
	})
	if err != nil {
		utils.GetLogger().Warn("Failed to init tracer", zap.Error(err))
	}
	defer hybridTracer.Flush()

	orderService := service.NewOrderService(repo, chaosManager)
	orderHandler := handler.NewOrderHandler(orderService, hybridTracer)

	traceInterceptor := tracer.NewTraceInterceptor(hybridTracer, "order-service")

	lis, err := net.Listen("tcp", fmt.Sprintf(":%d", cfg.Server.OrderService.Port))
	if err != nil {
		utils.GetLogger().Fatal("Failed to listen", zap.Error(err))
	}

	grpcServer := grpc.NewServer(
		grpc.UnaryInterceptor(traceInterceptor.UnaryServerInterceptor()),
	)

	pb.RegisterOrderServiceServer(grpcServer, orderHandler)

	utils.GetLogger().Info("Order service starting",
		zap.Int("port", cfg.Server.OrderService.Port))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)
		<-sigChan
		utils.GetLogger().Info("Shutting down order service...")
		grpcServer.GracefulStop()
		cancel()
	}()

	if err := grpcServer.Serve(lis); err != nil {
		utils.GetLogger().Fatal("Failed to serve", zap.Error(err))
	}
}
