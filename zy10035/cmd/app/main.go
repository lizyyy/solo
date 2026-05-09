package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"gorm.io/driver/sqlite"
	"gorm.io/gorm"

	"mq-deadletter-review/internal/config"
	"mq-deadletter-review/internal/domain/model"
	"mq-deadletter-review/internal/domain/service"
	"mq-deadletter-review/internal/infrastructure/cache"
	"mq-deadletter-review/internal/infrastructure/messagequeue"
	"mq-deadletter-review/internal/interfaces/api"
	"mq-deadletter-review/internal/interfaces/reporter"
	"mq-deadletter-review/pkg/logger"
)

type App struct {
	cfg      *config.Config
	db       *gorm.DB
	redis    *cache.RedisClient
	locker   *cache.RedisLocker
	cacheMgr *cache.CacheManager
	mqClient *messagequeue.RocketMQClient
}

func NewApp(cfg *config.Config) (*App, error) {
	app := &App{cfg: cfg}

	if err := app.initDatabase(); err != nil {
		return nil, err
	}

	app.initCache()
	app.initMQ()

	return app, nil
}

func (a *App) initDatabase() error {
	logger.Info("Initializing database with SQLite...")

	db, err := gorm.Open(sqlite.Open("./mq_review.db"), &gorm.Config{})
	if err != nil {
		return fmt.Errorf("failed to open sqlite: %w", err)
	}

	models := []interface{}{
		&model.MessageTracking{},
		&model.DeadLetterMessage{},
		&model.MessageEventLog{},
		&model.ReplayRequest{},
		&model.ReplayTask{},
	}

	if err := db.AutoMigrate(models...); err != nil {
		return fmt.Errorf("failed to auto migrate: %w", err)
	}

	a.db = db
	logger.Info("Database initialized successfully")
	return nil
}

func (a *App) initCache() {
	logger.Info("Initializing in-memory cache...")
	a.cacheMgr = cache.NewCacheManager(nil, nil)
	logger.Info("Cache initialized (in-memory mode)")
}

func (a *App) initMQ() {
	logger.Info("Initializing MQ client...")
	client, err := messagequeue.NewRocketMQClient(&a.cfg.RocketMQ)
	if err != nil {
		logger.Warn("Failed to init MQ client: %v", err)
		return
	}
	a.mqClient = client
	logger.Info("MQ client initialized (mock mode)")
}

func (a *App) Run(ctx context.Context) error {
	trackingSvc := service.NewTrackingService(
		&DBWrapper{db: a.db},
		a.cacheMgr,
		a.locker,
		&a.cfg.Tracking,
		a.mqClient.GetProducer(),
	)

	replaySvc := service.NewReplayService(
		&DBWrapper{db: a.db},
		a.cacheMgr,
		a.locker,
		trackingSvc,
		a.mqClient.GetProducer(),
		&a.cfg.Replay,
	)

	markdownReporter := reporter.NewMarkdownReporter(trackingSvc, replaySvc)
	handler := api.NewAPIHandler(trackingSvc, replaySvc, markdownReporter)

	mux := http.NewServeMux()
	handler.RegisterRoutes(mux)

	server := &http.Server{
		Addr:         fmt.Sprintf(":%d", a.cfg.Server.Port),
		Handler:      api.CORS(mux),
		ReadTimeout:  a.cfg.Server.ReadTimeout,
		WriteTimeout: a.cfg.Server.WriteTimeout,
	}

	go func() {
		logger.Info("HTTP server starting on port %d...", a.cfg.Server.Port)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("HTTP server failed: %v", err)
		}
	}()

	<-ctx.Done()
	logger.Info("Shutting down HTTP server...")

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	return server.Shutdown(shutdownCtx)
}

func (a *App) Close() {
	if a.mqClient != nil {
		a.mqClient.Close()
	}
	if a.redis != nil {
		a.redis.Close()
	}
}

type DBWrapper struct {
	db *gorm.DB
}

func (w *DBWrapper) GetDB() *gorm.DB {
	return w.db
}

func (w *DBWrapper) Close() error {
	return nil
}

func (w *DBWrapper) Transaction(fn func(tx *gorm.DB) error) error {
	return w.db.Transaction(fn)
}

func (w *DBWrapper) AutoMigrate(models ...interface{}) error {
	return w.db.AutoMigrate(models...)
}

func main() {
	cfg := config.Load()

	if err := logger.Init(cfg.Logger.Level, cfg.Logger.Path); err != nil {
		fmt.Fprintf(os.Stderr, "Failed to init logger: %v\n", err)
		os.Exit(1)
	}

	logger.Info("========================================")
	logger.Info("MQ Dead Letter Review System Starting")
	logger.Info("========================================")

	app, err := NewApp(cfg)
	if err != nil {
		logger.Fatal("Failed to create app: %v", err)
	}
	defer app.Close()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		sig := <-sigChan
		logger.Info("Received signal: %v", sig)
		cancel()
	}()

	if err := app.Run(ctx); err != nil {
		logger.Error("App error: %v", err)
	}

	logger.Info("System stopped")
}
