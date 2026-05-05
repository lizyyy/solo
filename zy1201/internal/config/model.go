package config

import (
	"time"
)

type DBProfile struct {
	Database      DatabaseConfig      `yaml:"database"`
	ConnectionPool ConnectionPoolConfig `yaml:"connection_pool"`
	Index         IndexConfig         `yaml:"index"`
	ReadWrite     ReadWriteConfig     `yaml:"read_write"`
	Sharding      ShardingConfig      `yaml:"sharding"`
}

type DatabaseConfig struct {
	Driver       string `yaml:"driver"`
	Host         string `yaml:"host"`
	Port         int    `yaml:"port"`
	Username     string `yaml:"username"`
	Password     string `yaml:"password"`
	DatabaseName string `yaml:"database_name"`
	Charset      string `yaml:"charset"`
}

type ConnectionPoolConfig struct {
	MaxOpenConns    int           `yaml:"max_open_conns"`
	MaxIdleConns    int           `yaml:"max_idle_conns"`
	ConnMaxLifetime time.Duration `yaml:"conn_max_lifetime"`
	ConnMaxIdleTime time.Duration `yaml:"conn_max_idle_time"`
	AcquireTimeout  time.Duration `yaml:"acquire_timeout"`
}

type IndexConfig struct {
	MinIndexCardinality  float64 `yaml:"min_index_cardinality"`
	MaxCompositeIndexCols int     `yaml:"max_composite_index_cols"`
	RedundantIndexThreshold float64 `yaml:"redundant_index_threshold"`
}

type ReadWriteConfig struct {
	Enabled       bool     `yaml:"enabled"`
	ReadEndpoints []string `yaml:"read_endpoints"`
	WriteEndpoint string   `yaml:"write_endpoint"`
	ReadRatio     float64  `yaml:"read_ratio"`
}

type ShardingConfig struct {
	Enabled          bool              `yaml:"enabled"`
	Strategy         string            `yaml:"strategy"`
	ShardKey         string            `yaml:"shard_key"`
	ShardCount       int               `yaml:"shard_count"`
	TableMap         map[string]ShardTable `yaml:"table_map"`
}

type ShardTable struct {
	ShardKey string `yaml:"shard_key"`
	Strategy string `yaml:"strategy"`
}

type TableSchema struct {
	Name        string
	Columns     []ColumnSchema
	Indexes     []IndexSchema
	Constraints []ConstraintSchema
}

type ColumnSchema struct {
	Name         string
	Type         string
	Nullable     bool
	DefaultValue interface{}
	IsPrimaryKey bool
	IsAutoIncrement bool
	Comment      string
}

type IndexSchema struct {
	Name         string
	Columns      []string
	IsUnique     bool
	IsPrimary    bool
	Cardinality  float64
	Type         string
	Comment      string
}

type ConstraintSchema struct {
	Name       string
	Type       string
	Columns    []string
	References *ForeignKeyReference
}

type ForeignKeyReference struct {
	Table   string
	Columns []string
}

type SlowLogEntry struct {
	Timestamp      time.Time
	User           string
	Host           string
	QueryTime      time.Duration
	LockTime       time.Duration
	RowsSent       int64
	RowsExamined   int64
	RowsAffected   int64
	BytesSent      int64
	SQL            string
	Database       string
	RowsSorted     int64
	FullScan       bool
	FullJoin       bool
	Filesort       bool
	TmpTable       bool
	TmpDiskTable   bool
}

type WriteBatchEntry struct {
	Timestamp    time.Time
	Table        string
	Operation    string
	RowCount     int
	ColumnCount  int
	DataSize     int64
	Duration     time.Duration
	Transaction  string
	BatchSize    int
}

type AnalysisProfile struct {
	Profile   *DBProfile
	Schema    map[string]*TableSchema
	SlowLogs  []SlowLogEntry
	WriteBatches []WriteBatchEntry
}
