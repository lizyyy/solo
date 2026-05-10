package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"gopkg.in/yaml.v3"

	"chaos-demo/internal/api"
	"chaos-demo/internal/eventstore"
	"chaos-demo/internal/messagequeue"
	"chaos-demo/internal/replay"
	"chaos-demo/internal/services"
	"chaos-demo/internal/types"
)

type Config struct {
	Server struct {
		Port int    `yaml:"port"`
		Mode string `yaml:"mode"`
	} `yaml:"server"`

	Database struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		User     string `yaml:"user"`
		Password string `yaml:"password"`
		DBName   string `yaml:"dbname"`
		MaxConns int    `yaml:"max_conns"`
		MinConns int    `yaml:"min_conns"`
	} `yaml:"database"`

	Redis struct {
		Host     string `yaml:"host"`
		Port     int    `yaml:"port"`
		Password string `yaml:"password"`
		DB       int    `yaml:"db"`
		PoolSize int    `yaml:"pool_size"`
	} `yaml:"redis"`

	Chaos types.FaultConfig `yaml:"chaos"`
}

func loadConfig(path string) (*Config, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var config Config
	if err := yaml.Unmarshal(data, &config); err != nil {
		return nil, err
	}

	return &config, nil
}

func main() {
	config, err := loadConfig("config.yaml")
	if err != nil {
		log.Fatalf("Failed to load config: %v", err)
	}

	if config.Server.Mode == "release" {
		gin.SetMode(gin.ReleaseMode)
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	dbURL := fmt.Sprintf(
		"postgres://%s:%s@%s:%d/%s?sslmode=disable",
		config.Database.User,
		config.Database.Password,
		config.Database.Host,
		config.Database.Port,
		config.Database.DBName,
	)

	var dbPool *pgxpool.Pool
	poolConfig, err := pgxpool.ParseConfig(dbURL)
	if err != nil {
		log.Fatalf("Failed to parse DB config: %v", err)
	}
	poolConfig.MaxConns = int32(config.Database.MaxConns)
	poolConfig.MinConns = int32(config.Database.MinConns)

	dbPool, err = pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		log.Printf("Warning: Failed to connect to PostgreSQL: %v", err)
		log.Printf("Continuing without PostgreSQL, connection pool exhaustion will be simulated")
	} else {
		defer dbPool.Close()
		if err := dbPool.Ping(ctx); err != nil {
			log.Printf("Warning: PostgreSQL ping failed: %v", err)
		}
	}

	redisClient := redis.NewClient(&redis.Options{
		Addr:     fmt.Sprintf("%s:%d", config.Redis.Host, config.Redis.Port),
		Password: config.Redis.Password,
		DB:       config.Redis.DB,
		PoolSize: config.Redis.PoolSize,
	})
	defer redisClient.Close()

	if err := redisClient.Ping(ctx).Err(); err != nil {
		log.Printf("Warning: Failed to connect to Redis: %v", err)
		log.Printf("Continuing without Redis, events will not be persisted")
	}

	eventStore := eventstore.NewEventStore(redisClient)

	chaosService := services.NewChaosService(eventStore, dbPool)
	chaosService.SetConfig(config.Chaos)
	chaosService.StartConfigDriftTicker(ctx)

	queue := messagequeue.NewMessageQueue(10000, chaosService)

	inventoryService := services.NewInventoryService(dbPool, redisClient, eventStore, chaosService)
	inventoryService.InitTestData()

	orderService := services.NewOrderService(dbPool, eventStore, chaosService, inventoryService, queue)

	queue.Subscribe("default", func(msg messagequeue.Message) error {
		var task types.CompensationTask
		if err := json.Unmarshal(msg.Payload, &task); err != nil {
			return err
		}
		return orderService.ProcessCompensation(ctx, task)
	})

	queue.Subscribe("compensation", func(msg messagequeue.Message) error {
		var task types.CompensationTask
		if err := json.Unmarshal(msg.Payload, &task); err != nil {
			return err
		}

		time.Sleep(time.Until(task.NextRetry))
		return orderService.ProcessCompensation(ctx, task)
	})

	queue.Start(ctx)
	defer queue.Stop()

	replayService := replay.NewReplayService(eventStore, inventoryService, orderService, chaosService)

	handler := api.NewHandler(inventoryService, orderService, chaosService, eventStore, replayService, queue)

	r := gin.Default()

	r.Use(func(c *gin.Context) {
		c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	handler.RegisterRoutes(r)

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		addr := fmt.Sprintf(":%d", config.Server.Port)
		log.Printf("Server starting on %s", addr)
		log.Printf("Web UI available at http://localhost%s", addr)
		if err := r.Run(addr); err != nil {
			log.Fatalf("Server failed: %v", err)
		}
	}()

	<-sigChan
	log.Println("Shutting down gracefully...")
	cancel()

	time.Sleep(500 * time.Millisecond)
	log.Println("Server stopped")
}
