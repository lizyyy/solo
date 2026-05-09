package database

import (
	"database/sql"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"

	"grayscale-simulator/pkg/config"
	"grayscale-simulator/pkg/logger"
)

var DB *sqlx.DB

func Init(cfg *config.DatabaseConfig) error {
	logger.Infof("Connecting to database: %s:%d/%s", cfg.Host, cfg.Port, cfg.DBName)
	
	var err error
	DB, err = sqlx.Connect("postgres", cfg.DSN())
	if err != nil {
		return err
	}
	
	DB.SetMaxOpenConns(cfg.MaxConnections)
	DB.SetMaxIdleConns(cfg.MaxIdleConnections)
	
	if lifetime, err := time.ParseDuration(cfg.ConnectionMaxLifetime); err == nil {
		DB.SetConnMaxLifetime(lifetime)
	}
	
	if err := DB.Ping(); err != nil {
		return err
	}
	
	logger.Info("Database connection established successfully")
	return nil
}

func Close() {
	if DB != nil {
		DB.Close()
		logger.Info("Database connection closed")
	}
}

func GetDB() *sqlx.DB {
	return DB
}

func Exec(query string, args ...interface{}) (sql.Result, error) {
	return DB.Exec(query, args...)
}

func QueryRow(query string, args ...interface{}) *sql.Row {
	return DB.QueryRow(query, args...)
}

func Query(query string, args ...interface{}) (*sql.Rows, error) {
	return DB.Query(query, args...)
}

func Select(dest interface{}, query string, args ...interface{}) error {
	return DB.Select(dest, query, args...)
}

func Get(dest interface{}, query string, args ...interface{}) error {
	return DB.Get(dest, query, args...)
}

func NamedExec(query string, arg interface{}) (sql.Result, error) {
	return DB.NamedExec(query, arg)
}

