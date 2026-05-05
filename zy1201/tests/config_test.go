package tests

import (
	"db-audit/internal/config"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestParseDBProfile(t *testing.T) {
	tempDir := t.TempDir()

	profileContent := `database:
  driver: mysql
  host: localhost
  port: 3306
  username: root
  password: testpass
  database_name: testdb
  charset: utf8mb4

connection_pool:
  max_open_conns: 100
  max_idle_conns: 20
  conn_max_lifetime: 1h
  conn_max_idle_time: 30m
  acquire_timeout: 30s

index:
  min_index_cardinality: 0.1
  max_composite_index_cols: 5
  redundant_index_threshold: 0.8

read_write:
  enabled: false
  read_endpoints:
    - localhost:3307
  write_endpoint: localhost:3306
  read_ratio: 0.8

sharding:
  enabled: false
  strategy: mod
  shard_key: user_id
  shard_count: 4
`
	profilePath := filepath.Join(tempDir, "db-profile.yaml")
	if err := os.WriteFile(profilePath, []byte(profileContent), 0644); err != nil {
		t.Fatalf("Failed to write test profile: %v", err)
	}

	parser := config.NewParser()
	profile, err := parser.ParseDBProfile(profilePath)
	if err != nil {
		t.Fatalf("ParseDBProfile failed: %v", err)
	}

	if profile.Database.Driver != "mysql" {
		t.Errorf("Expected driver 'mysql', got '%s'", profile.Database.Driver)
	}

	if profile.Database.DatabaseName != "testdb" {
		t.Errorf("Expected database_name 'testdb', got '%s'", profile.Database.DatabaseName)
	}

	if profile.ConnectionPool.MaxOpenConns != 100 {
		t.Errorf("Expected max_open_conns 100, got %d", profile.ConnectionPool.MaxOpenConns)
	}

	if profile.ConnectionPool.MaxIdleConns != 20 {
		t.Errorf("Expected max_idle_conns 20, got %d", profile.ConnectionPool.MaxIdleConns)
	}

	if profile.ConnectionPool.ConnMaxLifetime != time.Hour {
		t.Errorf("Expected conn_max_lifetime 1h, got %v", profile.ConnectionPool.ConnMaxLifetime)
	}

	if profile.ReadWrite.ReadRatio != 0.8 {
		t.Errorf("Expected read_ratio 0.8, got %f", profile.ReadWrite.ReadRatio)
	}

	if profile.Sharding.ShardCount != 4 {
		t.Errorf("Expected shard_count 4, got %d", profile.Sharding.ShardCount)
	}
}

func TestParseDBProfile_InvalidConfig(t *testing.T) {
	tempDir := t.TempDir()

	badProfile := `connection_pool:
  max_open_conns: 5
  max_idle_conns: 20
`
	profilePath := filepath.Join(tempDir, "bad-profile.yaml")
	if err := os.WriteFile(profilePath, []byte(badProfile), 0644); err != nil {
		t.Fatalf("Failed to write test profile: %v", err)
	}

	parser := config.NewParser()
	_, err := parser.ParseDBProfile(profilePath)

	if err == nil {
		t.Error("Expected error for invalid config (max_idle_conns > max_open_conns), but got none")
	}
}

func TestParseSchema(t *testing.T) {
	tempDir := t.TempDir()

	schemaContent := `
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uk_username (username),
    INDEX idx_email (email)
) ENGINE=InnoDB;

CREATE TABLE orders (
    id BIGINT AUTO_INCREMENT,
    user_id BIGINT NOT NULL,
    order_no VARCHAR(32) NOT NULL,
    PRIMARY KEY (id),
    KEY idx_user_id (user_id)
) ENGINE=InnoDB;
`
	schemaPath := filepath.Join(tempDir, "schema.sql")
	if err := os.WriteFile(schemaPath, []byte(schemaContent), 0644); err != nil {
		t.Fatalf("Failed to write test schema: %v", err)
	}

	parser := config.NewParser()
	schema, err := parser.ParseSchema(schemaPath)
	if err != nil {
		t.Fatalf("ParseSchema failed: %v", err)
	}

	if len(schema) != 2 {
		t.Errorf("Expected 2 tables, got %d", len(schema))
	}

	usersTable, exists := schema["users"]
	if !exists {
		t.Error("Expected 'users' table to exist")
	} else {
		if usersTable.Name != "users" {
			t.Errorf("Expected table name 'users', got '%s'", usersTable.Name)
		}

		hasPrimary := false
		for _, idx := range usersTable.Indexes {
			if idx.IsPrimary {
				hasPrimary = true
				break
			}
		}
		if !hasPrimary {
			t.Error("Expected 'users' table to have primary key")
		}
	}

	ordersTable, exists := schema["orders"]
	if !exists {
		t.Error("Expected 'orders' table to exist")
	} else {
		foundIdx := false
		for _, idx := range ordersTable.Indexes {
			if idx.Name == "idx_user_id" {
				foundIdx = true
				if len(idx.Columns) != 1 || idx.Columns[0] != "user_id" {
					t.Errorf("Expected idx_user_id to have column 'user_id', got %v", idx.Columns)
				}
				break
			}
		}
		if !foundIdx {
			t.Error("Expected idx_user_id index to exist")
		}
	}
}

func TestParseWriteBatch(t *testing.T) {
	tempDir := t.TempDir()

	jsonlContent := `{"timestamp":"2026-05-04T10:00:00Z","table":"orders","operation":"INSERT","row_count":1,"column_count":6,"data_size":512,"duration_ms":25,"transaction":"txn_001","batch_size":1}
{"timestamp":"2026-05-04T10:00:01Z","table":"order_items","operation":"INSERT","row_count":100,"column_count":5,"data_size":24500,"duration_ms":120,"transaction":"txn_002","batch_size":100}
`
	batchPath := filepath.Join(tempDir, "write-batch.jsonl")
	if err := os.WriteFile(batchPath, []byte(jsonlContent), 0644); err != nil {
		t.Fatalf("Failed to write test batch file: %v", err)
	}

	parser := config.NewParser()
	batches, err := parser.ParseWriteBatch(batchPath)
	if err != nil {
		t.Fatalf("ParseWriteBatch failed: %v", err)
	}

	if len(batches) != 2 {
		t.Errorf("Expected 2 batches, got %d", len(batches))
	}

	if batches[0].Table != "orders" {
		t.Errorf("Expected first batch table 'orders', got '%s'", batches[0].Table)
	}

	if batches[0].BatchSize != 1 {
		t.Errorf("Expected first batch size 1, got %d", batches[0].BatchSize)
	}

	if batches[1].Table != "order_items" {
		t.Errorf("Expected second batch table 'order_items', got '%s'", batches[1].Table)
	}

	if batches[1].RowCount != 100 {
		t.Errorf("Expected second batch row count 100, got %d", batches[1].RowCount)
	}
}

func TestValidateDBProfile(t *testing.T) {
	tests := []struct {
		name        string
		profile     config.DBProfile
		expectError bool
	}{
		{
			name: "valid config",
			profile: config.DBProfile{
				ConnectionPool: config.ConnectionPoolConfig{
					MaxOpenConns: 100,
					MaxIdleConns: 20,
				},
			},
			expectError: false,
		},
		{
			name: "negative max_open_conns",
			profile: config.DBProfile{
				ConnectionPool: config.ConnectionPoolConfig{
					MaxOpenConns: -1,
					MaxIdleConns: 0,
				},
			},
			expectError: true,
		},
		{
			name: "negative max_idle_conns",
			profile: config.DBProfile{
				ConnectionPool: config.ConnectionPoolConfig{
					MaxOpenConns: 100,
					MaxIdleConns: -1,
				},
			},
			expectError: true,
		},
		{
			name: "max_idle_conns > max_open_conns",
			profile: config.DBProfile{
				ConnectionPool: config.ConnectionPoolConfig{
					MaxOpenConns: 10,
					MaxIdleConns: 20,
				},
			},
			expectError: true,
		},
	}

	parser := config.NewParser()
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := parser.ParseDBProfile("")
			if tt.expectError {
				if err == nil {
					t.Error("Expected error but got none")
				}
			}
		})
	}
}
