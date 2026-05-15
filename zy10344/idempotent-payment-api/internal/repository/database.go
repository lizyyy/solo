package repository

import (
	"fmt"
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/mattn/go-sqlite3"
)

var schema = `
CREATE TABLE IF NOT EXISTS receiver_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    bank_name VARCHAR(100) NOT NULL,
    account_no VARCHAR(50) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    bank_branch VARCHAR(100),
    province VARCHAR(50),
    city VARCHAR(50),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_instructions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_no VARCHAR(64) NOT NULL UNIQUE,
    idempotent_key VARCHAR(128) NOT NULL UNIQUE,
    merchant_id VARCHAR(64) NOT NULL,
    amount BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'CNY',
    receiver_account_id INTEGER NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    channel VARCHAR(50) NOT NULL,
    channel_order_no VARCHAR(128) DEFAULT '',
    remark TEXT DEFAULT '',
    notify_url VARCHAR(256) DEFAULT '',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (receiver_account_id) REFERENCES receiver_accounts(id)
);

CREATE INDEX IF NOT EXISTS idx_payment_no ON payment_instructions(payment_no);
CREATE INDEX IF NOT EXISTS idx_idempotent_key ON payment_instructions(idempotent_key);
CREATE INDEX IF NOT EXISTS idx_merchant_id ON payment_instructions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_status ON payment_instructions(status);

CREATE TABLE IF NOT EXISTS idempotent_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    idempotent_key VARCHAR(128) NOT NULL UNIQUE,
    payment_id INTEGER NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expired_at DATETIME NOT NULL,
    FOREIGN KEY (payment_id) REFERENCES payment_instructions(id)
);

CREATE INDEX IF NOT EXISTS idx_idk_key ON idempotent_keys(idempotent_key);
CREATE INDEX IF NOT EXISTS idx_idk_expired ON idempotent_keys(expired_at);

CREATE TABLE IF NOT EXISTS channel_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    payment_no VARCHAR(64) NOT NULL,
    channel VARCHAR(50) NOT NULL,
    channel_order_no VARCHAR(128) NOT NULL,
    channel_status VARCHAR(50) NOT NULL,
    receipt_content TEXT,
    is_success BOOLEAN NOT NULL DEFAULT 0,
    response_time DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payment_instructions(id)
);

CREATE INDEX IF NOT EXISTS idx_cr_payment_id ON channel_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_cr_channel_order ON channel_receipts(channel_order_no);

CREATE TABLE IF NOT EXISTS cancel_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    payment_no VARCHAR(64) NOT NULL,
    cancel_reason TEXT NOT NULL,
    cancel_status VARCHAR(20) NOT NULL DEFAULT 'CANCELLING',
    channel_cancel_no VARCHAR(128),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payment_instructions(id)
);

CREATE INDEX IF NOT EXISTS idx_ca_payment_id ON cancel_applications(payment_id);

CREATE TABLE IF NOT EXISTS timeline_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    payment_no VARCHAR(64) NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    event_status VARCHAR(20) NOT NULL,
    content TEXT,
    operator VARCHAR(100),
    ip_address VARCHAR(50),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payment_instructions(id)
);

CREATE INDEX IF NOT EXISTS idx_te_payment_id ON timeline_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_te_created_at ON timeline_events(created_at);
`

type Database struct {
	*sqlx.DB
}

func NewDatabase(dsn string) (*Database, error) {
	db, err := sqlx.Open("sqlite3", dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	db.SetMaxOpenConns(25)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(5 * time.Minute)

	if err := db.Ping(); err != nil {
		return nil, fmt.Errorf("failed to ping database: %w", err)
	}

	if _, err := db.Exec(schema); err != nil {
		return nil, fmt.Errorf("failed to create schema: %w", err)
	}

	log.Println("Database schema initialized successfully")
	return &Database{db}, nil
}

func (db *Database) Close() error {
	return db.DB.Close()
}

func (db *Database) BeginTx() (*sqlx.Tx, error) {
	return db.Beginx()
}
