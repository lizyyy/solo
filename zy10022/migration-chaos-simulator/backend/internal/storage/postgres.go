package storage

import (
	"context"
	"fmt"
	"sync"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"go.uber.org/zap"

	"migration-chaos-simulator/internal/config"
	"migration-chaos-simulator/internal/logger"
)

type PostgresPool struct {
	pool *pgxpool.Pool
	cfg  config.DatabaseConfig
}

var (
	instance *PostgresPool
	once     sync.Once
)

func GetPool(cfg config.DatabaseConfig) (*PostgresPool, error) {
	var err error
	once.Do(func() {
		instance, err = newPool(cfg)
	})
	if err != nil {
		return nil, err
	}
	return instance, nil
}

func newPool(cfg config.DatabaseConfig) (*PostgresPool, error) {
	poolConfig, err := pgxpool.ParseConfig(cfg.DSN())
	if err != nil {
		return nil, fmt.Errorf("failed to parse DSN: %w", err)
	}

	poolConfig.MaxConns = int32(cfg.MaxConnections)
	poolConfig.MinConns = int32(cfg.MinConnections)
	poolConfig.MaxConnLifetime = cfg.ConnMaxLifetime
	poolConfig.MaxConnIdleTime = cfg.ConnMaxIdleTime

	pool, err := pgxpool.NewWithConfig(context.Background(), poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create pool: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	logger.Info("Database pool initialized",
		zap.String("host", cfg.Host),
		zap.String("database", cfg.Database),
		zap.Int("max_conns", cfg.MaxConnections),
	)

	return &PostgresPool{
		pool: pool,
		cfg:  cfg,
	}, nil
}

func (p *PostgresPool) Pool() *pgxpool.Pool {
	return p.pool
}

func (p *PostgresPool) Close() {
	if p.pool != nil {
		p.pool.Close()
		logger.Info("Database pool closed")
	}
}

func (p *PostgresPool) Exec(ctx context.Context, sql string, args ...interface{}) (int64, error) {
	tag, err := p.pool.Exec(ctx, sql, args...)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (p *PostgresPool) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	return p.pool.QueryRow(ctx, sql, args...)
}

func (p *PostgresPool) Query(ctx context.Context, sql string, args ...interface{}) (pgx.Rows, error) {
	return p.pool.Query(ctx, sql, args...)
}

func (p *PostgresPool) BeginTx(ctx context.Context) (*Transaction, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return nil, err
	}
	return &Transaction{tx: tx}, nil
}

type Transaction struct {
	tx pgx.Tx
}

func (t *Transaction) Commit(ctx context.Context) error {
	return t.tx.Commit(ctx)
}

func (t *Transaction) Rollback(ctx context.Context) error {
	return t.tx.Rollback(ctx)
}

func (t *Transaction) Exec(ctx context.Context, sql string, args ...interface{}) (int64, error) {
	tag, err := t.tx.Exec(ctx, sql, args...)
	if err != nil {
		return 0, err
	}
	return tag.RowsAffected(), nil
}

func (t *Transaction) QueryRow(ctx context.Context, sql string, args ...interface{}) pgx.Row {
	return t.tx.QueryRow(ctx, sql, args...)
}
