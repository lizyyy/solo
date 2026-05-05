package cli

import (
	"db-audit/internal/analyzer"
	"db-audit/internal/config"
	"db-audit/internal/reporter"
	"db-audit/internal/simulator"
	"db-audit/internal/storage"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

type CLI struct {
	parser   *config.Parser
	store    *storage.Storage
	workDir  string
}

type Command struct {
	Name        string
	Description string
	Usage       string
	Run         func(args []string) error
}

func NewCLI(workDir string) (*CLI, error) {
	if workDir == "" {
		var err error
		workDir, err = os.Getwd()
		if err != nil {
			return nil, fmt.Errorf("failed to get working directory: %w", err)
		}
	}

	store, err := storage.NewStorage(filepath.Join(workDir, "db-audit.db"))
	if err != nil {
		return nil, fmt.Errorf("failed to initialize storage: %w", err)
	}

	return &CLI{
		parser:  config.NewParser(),
		store:   store,
		workDir: workDir,
	}, nil
}

func (c *CLI) Close() error {
	return c.store.Close()
}

func (c *CLI) Commands() map[string]*Command {
	return map[string]*Command{
		"init": {
			Name:        "init",
			Description: "初始化工作目录，创建示例配置文件",
			Usage:       "db-audit init [--seed] [--bad-config]",
			Run:         c.runInit,
		},
		"analyze": {
			Name:        "analyze",
			Description: "执行数据库性能分析",
			Usage:       "db-audit analyze [--profile db-profile.yaml] [--schema schema.sql] [--slowlog slow.log] [--writebatch write-batch.jsonl] [--project name] [--version v1.0]",
			Run:         c.runAnalyze,
		},
		"simulate": {
			Name:        "simulate",
			Description: "执行性能模拟测试",
			Usage:       "db-audit simulate [--type connection-pool|write-performance] [--duration 10s] [--clients 50] [--pool-size 10]",
			Run:         c.runSimulate,
		},
		"export": {
			Name:        "export",
			Description: "导出分析报告",
			Usage:       "db-audit export [--session 1] [--format markdown|json] [--output report.md]",
			Run:         c.runExport,
		},
		"list": {
			Name:        "list",
			Description: "列出历史分析会话",
			Usage:       "db-audit list [--limit 10]",
			Run:         c.runList,
		},
		"help": {
			Name:        "help",
			Description: "显示帮助信息",
			Usage:       "db-audit help [command]",
			Run:         c.runHelp,
		},
	}
}

func (c *CLI) Run(args []string) error {
	if len(args) < 1 {
		c.printUsage()
		os.Exit(1)
	}

	cmdName := args[0]
	commands := c.Commands()

	cmd, exists := commands[cmdName]
	if !exists {
		fmt.Fprintf(os.Stderr, "Unknown command: %s\n\n", cmdName)
		c.printUsage()
		os.Exit(1)
	}

	return cmd.Run(args[1:])
}

func (c *CLI) printUsage() {
	fmt.Println("db-audit - 数据库性能体检工具")
	fmt.Println()
	fmt.Println("Usage:")
	fmt.Println("  db-audit <command> [options]")
	fmt.Println()
	fmt.Println("Commands:")

	commands := c.Commands()
	longest := 0
	for name := range commands {
		if len(name) > longest {
			longest = len(name)
		}
	}

	for name, cmd := range commands {
		fmt.Printf("  %-*s  %s\n", longest, name, cmd.Description)
	}

	fmt.Println()
	fmt.Println("Use \"db-audit help <command>\" for more information about a command.")
}

func (c *CLI) runHelp(args []string) error {
	if len(args) < 1 {
		c.printUsage()
		return nil
	}

	cmdName := args[0]
	commands := c.Commands()

	cmd, exists := commands[cmdName]
	if !exists {
		return fmt.Errorf("unknown command: %s", cmdName)
	}

	fmt.Printf("Command: %s\n\n", cmd.Name)
	fmt.Printf("Description: %s\n\n", cmd.Description)
	fmt.Printf("Usage: %s\n", cmd.Usage)

	return nil
}

func (c *CLI) runInit(args []string) error {
	flags := flag.NewFlagSet("init", flag.ExitOnError)
	withSeed := flags.Bool("seed", false, "生成样例数据")
	withBadConfig := flags.Bool("bad-config", false, "生成带有问题的配置示例")

	if err := flags.Parse(args); err != nil {
		return err
	}

	fmt.Println("Initializing db-audit workspace...")
	fmt.Printf("Working directory: %s\n", c.workDir)

	files := []struct {
		name    string
		content string
	}{
		{
			name: "db-profile.yaml",
			content: `database:
  driver: mysql
  host: localhost
  port: 3306
  username: root
  password: ""
  database_name: mydb
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
    - localhost:3308
  write_endpoint: localhost:3306
  read_ratio: 0.8

sharding:
  enabled: false
  strategy: mod
  shard_key: user_id
  shard_count: 4
  table_map:
    orders:
      shard_key: order_id
      strategy: range
`,
		},
		{
			name: "schema.sql",
			content: `-- Sample schema
CREATE TABLE users (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(50) NOT NULL,
    email VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    status TINYINT DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uk_username (username),
    UNIQUE KEY uk_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_no VARCHAR(32) NOT NULL,
    user_id BIGINT NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    status TINYINT DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    KEY idx_user_id (user_id),
    KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE order_items (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    order_id BIGINT NOT NULL,
    product_id BIGINT NOT NULL,
    quantity INT NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    KEY idx_order_id (order_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`,
		},
		{
			name: "slow.log",
			content: `# Time: 2026-05-04T10:00:00.123456Z
# User@Host: app[app] @ localhost []
# Query_time: 12.345678  Lock_time: 0.000123 Rows_sent: 100  Rows_examined: 1000000
SET timestamp=1714810800;
SELECT * FROM orders WHERE status = 0 ORDER BY created_at DESC;

# Time: 2026-05-04T10:01:00.123456Z
# User@Host: app[app] @ localhost []
# Query_time: 8.765432  Lock_time: 0.000456 Rows_sent: 1  Rows_examined: 500000
SET timestamp=1714810860;
SELECT * FROM users WHERE phone = '13800138000';

# Time: 2026-05-04T10:02:00.123456Z
# User@Host: app[app] @ localhost []
# Query_time: 5.234567  Lock_time: 0.000789 Rows_sent: 10  Rows_examined: 100000
SET timestamp=1714810920;
SELECT * FROM order_items oi JOIN orders o ON oi.order_id = o.id WHERE o.user_id = 123;

# Time: 2026-05-04T10:03:00.123456Z
# User@Host: app[app] @ localhost []
# Query_time: 3.456789  Lock_time: 0.000234 Rows_sent: 20  Rows_examined: 50000
SET timestamp=1714810980;
SELECT * FROM users WHERE username LIKE '%john%';
`,
		},
		{
			name: "write-batch.jsonl",
			content: `{"timestamp":"2026-05-04T10:00:00Z","table":"orders","operation":"INSERT","row_count":1,"column_count":6,"data_size":512,"duration_ms":25,"transaction":"txn_001","batch_size":1}
{"timestamp":"2026-05-04T10:00:01Z","table":"orders","operation":"INSERT","row_count":1,"column_count":6,"data_size":498,"duration_ms":22,"transaction":"txn_002","batch_size":1}
{"timestamp":"2026-05-04T10:00:02Z","table":"orders","operation":"INSERT","row_count":1,"column_count":6,"data_size":523,"duration_ms":28,"transaction":"txn_003","batch_size":1}
{"timestamp":"2026-05-04T10:00:03Z","table":"order_items","operation":"INSERT","row_count":100,"column_count":5,"data_size":24500,"duration_ms":120,"transaction":"txn_004","batch_size":100}
{"timestamp":"2026-05-04T10:00:04Z","table":"order_items","operation":"INSERT","row_count":50,"column_count":5,"data_size":12200,"duration_ms":65,"transaction":"txn_005","batch_size":50}
{"timestamp":"2026-05-04T10:00:05Z","table":"users","operation":"INSERT","row_count":1,"column_count":7,"data_size":350,"duration_ms":18,"transaction":"txn_006","batch_size":1}
`,
		},
	}

	for _, f := range files {
		path := filepath.Join(c.workDir, f.name)
		if err := os.WriteFile(path, []byte(f.content), 0644); err != nil {
			return fmt.Errorf("failed to write %s: %w", f.name, err)
		}
		fmt.Printf("  Created: %s\n", f.name)
	}

	if *withBadConfig {
		badConfig := `database:
  driver: mysql
  host: localhost
  port: 3306
  username: root
  password: ""
  database_name: mydb

connection_pool:
  max_open_conns: 5
  max_idle_conns: 20
  conn_max_lifetime: 0
  acquire_timeout: 0

read_write:
  enabled: true
  read_endpoints: []
  read_ratio: 1.5

sharding:
  enabled: true
  shard_key: ""
  shard_count: 1
`
		path := filepath.Join(c.workDir, "db-profile-bad.yaml")
		if err := os.WriteFile(path, []byte(badConfig), 0644); err != nil {
			return fmt.Errorf("failed to write bad config: %w", err)
		}
		fmt.Printf("  Created: db-profile-bad.yaml (bad configuration example)\n")
	}

	if *withSeed {
		fmt.Println("\nGenerating seed data...")
		if err := c.generateSeedData(); err != nil {
			return fmt.Errorf("failed to generate seed data: %w", err)
		}
	}

	fmt.Println("\nInitialization complete!")
	fmt.Println("\nNext steps:")
	fmt.Println("  1. Review and edit db-profile.yaml")
	fmt.Println("  2. Run 'db-audit analyze' to perform analysis")
	fmt.Println("  3. Run 'db-audit export' to generate reports")

	return nil
}

func (c *CLI) generateSeedData() error {
	sessionID, err := c.store.CreateSession("seed-project", "v1.0.0")
	if err != nil {
		return err
	}

	demoProfile := &config.DBProfile{
		ConnectionPool: config.ConnectionPoolConfig{
			MaxOpenConns:    5,
			MaxIdleConns:    20,
			ConnMaxLifetime: 0,
			AcquireTimeout:  0,
		},
		ReadWrite: config.ReadWriteConfig{
			Enabled:       true,
			ReadEndpoints: []string{},
			ReadRatio:     1.5,
		},
		Sharding: config.ShardingConfig{
			Enabled:    true,
			ShardKey:   "",
			ShardCount: 1,
		},
	}

	profile := &config.AnalysisProfile{
		Profile: demoProfile,
		Schema: map[string]*config.TableSchema{
			"users": {
				Name: "users",
				Columns: []config.ColumnSchema{
					{Name: "id", Type: "BIGINT", IsPrimaryKey: true, IsAutoIncrement: true},
					{Name: "username", Type: "VARCHAR(50)"},
					{Name: "email", Type: "VARCHAR(100)"},
					{Name: "phone", Type: "VARCHAR(20)"},
				},
				Indexes: []config.IndexSchema{
					{Name: "PRIMARY", Columns: []string{"id"}, IsPrimary: true},
					{Name: "uk_username", Columns: []string{"username"}, IsUnique: true},
					{Name: "uk_email", Columns: []string{"email"}, IsUnique: true},
				},
			},
			"orders": {
				Name: "orders",
				Columns: []config.ColumnSchema{
					{Name: "id", Type: "BIGINT", IsPrimaryKey: true, IsAutoIncrement: true},
					{Name: "order_no", Type: "VARCHAR(32)"},
					{Name: "user_id", Type: "BIGINT"},
					{Name: "status", Type: "TINYINT"},
				},
				Indexes: []config.IndexSchema{
					{Name: "PRIMARY", Columns: []string{"id"}, IsPrimary: true},
					{Name: "idx_user_id", Columns: []string{"user_id"}},
				},
			},
			"order_items": {
				Name: "order_items",
				Columns: []config.ColumnSchema{
					{Name: "id", Type: "BIGINT", IsPrimaryKey: true, IsAutoIncrement: true},
					{Name: "order_id", Type: "BIGINT"},
					{Name: "product_id", Type: "BIGINT"},
				},
				Indexes: []config.IndexSchema{
					{Name: "idx_order_id", Columns: []string{"order_id"}},
				},
			},
		},
		SlowLogs: []config.SlowLogEntry{
			{
				QueryTime:    12 * time.Second,
				LockTime:     123 * time.Microsecond,
				RowsSent:     100,
				RowsExamined: 1000000,
				SQL:          "SELECT * FROM orders WHERE status = 0 ORDER BY created_at DESC",
				FullScan:     true,
				Filesort:     true,
			},
			{
				QueryTime:    8 * time.Second,
				LockTime:     456 * time.Microsecond,
				RowsSent:     1,
				RowsExamined: 500000,
				SQL:          "SELECT * FROM users WHERE phone = '13800138000'",
				FullScan:     true,
			},
		},
	}

	analyzer := analyzer.NewAnalyzer(profile, c.store)
	if err := analyzer.AnalyzeAll(sessionID); err != nil {
		return err
	}

	if err := c.store.UpdateSessionStatus(sessionID, "completed", ""); err != nil {
		return err
	}

	fmt.Printf("  Seed data created with session ID: %d\n", sessionID)
	return nil
}

func (c *CLI) runAnalyze(args []string) error {
	flags := flag.NewFlagSet("analyze", flag.ExitOnError)
	profilePath := flags.String("profile", "db-profile.yaml", "Path to db-profile.yaml")
	schemaPath := flags.String("schema", "schema.sql", "Path to schema.sql")
	slowLogPath := flags.String("slowlog", "slow.log", "Path to slow.log")
	writeBatchPath := flags.String("writebatch", "write-batch.jsonl", "Path to write-batch.jsonl")
	projectName := flags.String("project", "", "Project name")
	version := flags.String("version", "", "Project version")

	if err := flags.Parse(args); err != nil {
		return err
	}

	profile := &config.AnalysisProfile{}

	if *projectName == "" {
		*projectName = filepath.Base(c.workDir)
	}
	if *version == "" {
		*version = "v1.0.0"
	}

	fmt.Println("Starting database performance analysis...")
	fmt.Printf("  Project: %s\n", *projectName)
	fmt.Printf("  Version: %s\n", *version)

	if _, err := os.Stat(*profilePath); err == nil {
		fmt.Printf("  Loading profile: %s\n", *profilePath)
		dbProfile, err := c.parser.ParseDBProfile(*profilePath)
		if err != nil {
			fmt.Printf("  Warning: Failed to parse profile: %v\n", err)
		} else {
			profile.Profile = dbProfile
		}
	}

	if _, err := os.Stat(*schemaPath); err == nil {
		fmt.Printf("  Loading schema: %s\n", *schemaPath)
		schema, err := c.parser.ParseSchema(*schemaPath)
		if err != nil {
			fmt.Printf("  Warning: Failed to parse schema: %v\n", err)
		} else {
			profile.Schema = schema
			fmt.Printf("  Found %d tables\n", len(schema))
		}
	}

	if _, err := os.Stat(*slowLogPath); err == nil {
		fmt.Printf("  Loading slow log: %s\n", *slowLogPath)
		slowLogs, err := c.parser.ParseSlowLog(*slowLogPath)
		if err != nil {
			fmt.Printf("  Warning: Failed to parse slow log: %v\n", err)
		} else {
			profile.SlowLogs = slowLogs
			fmt.Printf("  Found %d slow queries\n", len(slowLogs))
		}
	}

	if _, err := os.Stat(*writeBatchPath); err == nil {
		fmt.Printf("  Loading write batch log: %s\n", *writeBatchPath)
		writeBatches, err := c.parser.ParseWriteBatch(*writeBatchPath)
		if err != nil {
			fmt.Printf("  Warning: Failed to parse write batch log: %v\n", err)
		} else {
			profile.WriteBatches = writeBatches
			fmt.Printf("  Found %d write batches\n", len(writeBatches))
		}
	}

	sessionID, err := c.store.CreateSession(*projectName, *version)
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}
	fmt.Printf("\n  Session ID: %d\n", sessionID)

	fmt.Println("\nRunning analysis...")

	analyzer := analyzer.NewAnalyzer(profile, c.store)
	if err := analyzer.AnalyzeAll(sessionID); err != nil {
		c.store.UpdateSessionStatus(sessionID, "failed", err.Error())
		return fmt.Errorf("analysis failed: %w", err)
	}

	if err := c.store.UpdateSessionStatus(sessionID, "completed", ""); err != nil {
		return err
	}

	bottlenecks, err := c.store.GetBottlenecksBySession(sessionID)
	if err == nil && len(bottlenecks) > 0 {
		fmt.Println("\nAnalysis Results - Top Bottlenecks:")
		for i, b := range bottlenecks {
			if i >= 5 {
				break
			}
			fmt.Printf("  [%d] [%s] %s (impact: %.1f)\n", i+1, b.Severity, b.Description, b.Impact)
		}
	}

	fmt.Println("\nAnalysis completed successfully!")
	fmt.Println("\nUse 'db-audit export --session", sessionID, "' to generate report")

	return nil
}

func (c *CLI) runSimulate(args []string) error {
	flags := flag.NewFlagSet("simulate", flag.ExitOnError)
	simType := flags.String("type", "all", "Simulation type: connection-pool, write-performance, all")
	duration := flags.Duration("duration", 10*time.Second, "Simulation duration")
	clients := flags.Int("clients", runtime.NumCPU()*10, "Number of concurrent clients")
	poolSize := flags.Int("pool-size", 10, "Connection pool size")
	projectName := flags.String("project", "simulation", "Project name")
	version := flags.String("version", "v1.0", "Project version")

	if err := flags.Parse(args); err != nil {
		return err
	}

	fmt.Println("Starting performance simulation...")
	fmt.Printf("  Type: %s\n", *simType)
	fmt.Printf("  Duration: %v\n", *duration)
	fmt.Printf("  Clients: %d\n", *clients)
	fmt.Printf("  Pool Size: %d\n", *poolSize)

	profile := &config.AnalysisProfile{
		Profile: &config.DBProfile{
			ConnectionPool: config.ConnectionPoolConfig{
				MaxOpenConns:   *poolSize,
				AcquireTimeout: 5 * time.Second,
			},
		},
	}

	simulator := simulator.NewSimulator(profile, c.store)

	sessionID, err := c.store.CreateSession(*projectName, *version)
	if err != nil {
		return fmt.Errorf("failed to create session: %w", err)
	}
	fmt.Printf("  Session ID: %d\n", sessionID)

	result := &simulator.SimulationResult{}

	if *simType == "connection-pool" || *simType == "all" {
		fmt.Println("\nRunning connection pool exhaustion simulation...")
		cpResult, err := simulator.SimulateConnectionPoolExhaustion(&simulator.SimulationConfig{
			Duration:          *duration,
			ConcurrentClients: *clients,
			PoolSize:          *poolSize,
		})
		if err != nil {
			return fmt.Errorf("connection pool simulation failed: %w", err)
		}
		result.ConnectionPool = cpResult

		fmt.Println("  Connection Pool Simulation Results:")
		fmt.Printf("    Total Requests: %d\n", cpResult.TotalRequests)
		fmt.Printf("    Successful: %d\n", cpResult.SuccessfulRequests)
		fmt.Printf("    Failed: %d\n", cpResult.FailedRequests)
		fmt.Printf("    Timeouts: %d\n", cpResult.TimeoutRequests)
		fmt.Printf("    Pool Exhaustion Events: %d\n", cpResult.PoolExhaustionEvents)
		fmt.Printf("    Avg Wait Time: %v\n", cpResult.WaitTimeAvg)
		fmt.Printf("    P95 Wait Time: %v\n", cpResult.WaitTimeP95)
		fmt.Printf("    Max Wait Time: %v\n", cpResult.WaitTimeMax)
	}

	if *simType == "write-performance" || *simType == "all" {
		fmt.Println("\nRunning write performance simulation...")
		wpResult, err := simulator.SimulateWritePerformance(&simulator.SimulationConfig{
			Duration: *duration,
		})
		if err != nil {
			return fmt.Errorf("write performance simulation failed: %w", err)
		}
		result.WritePerformance = wpResult

		fmt.Println("  Write Performance Simulation Results:")
		fmt.Printf("    Single Row Avg Time: %v\n", wpResult.SingleRowAvgTime)
		fmt.Printf("    Batch Row Avg Time: %v\n", wpResult.BatchRowAvgTime)
		fmt.Printf("    Performance Ratio: %.2fx\n", wpResult.PerformanceRatio)
	}

	if err := simulator.SaveSimulationResult(sessionID, result); err != nil {
		return fmt.Errorf("failed to save simulation results: %w", err)
	}

	if err := c.store.UpdateSessionStatus(sessionID, "completed", ""); err != nil {
		return err
	}

	fmt.Println("\nSimulation completed successfully!")
	fmt.Println("\nUse 'db-audit export --session", sessionID, "' to generate report")

	return nil
}

func (c *CLI) runExport(args []string) error {
	flags := flag.NewFlagSet("export", flag.ExitOnError)
	sessionID := flags.Int64("session", 0, "Session ID to export (0 for latest)")
	format := flags.String("format", "markdown", "Output format: markdown, json")
	outputPath := flags.String("output", "", "Output file path (default: stdout)")

	if err := flags.Parse(args); err != nil {
		return err
	}

	reporter := reporter.NewReporter(c.store)

	var targetSessionID int64
	if *sessionID == 0 {
		session, err := c.store.GetLatestSession()
		if err != nil {
			return fmt.Errorf("failed to get latest session: %w", err)
		}
		if session == nil {
			return fmt.Errorf("no sessions found. Run 'db-audit analyze' first.")
		}
		targetSessionID = session.ID
		fmt.Printf("Using latest session: %d\n", targetSessionID)
	} else {
		targetSessionID = *sessionID
	}

	fmt.Printf("Exporting session %d as %s...\n", targetSessionID, *format)

	var err error
	switch *format {
	case "json":
		err = reporter.ExportJSON(targetSessionID, *outputPath)
	case "markdown", "md":
		err = reporter.ExportMarkdown(targetSessionID, *outputPath)
	default:
		return fmt.Errorf("unsupported format: %s", *format)
	}

	if err != nil {
		return fmt.Errorf("export failed: %w", err)
	}

	if *outputPath != "" {
		fmt.Printf("Report saved to: %s\n", *outputPath)
	}

	return nil
}

func (c *CLI) runList(args []string) error {
	flags := flag.NewFlagSet("list", flag.ExitOnError)
	limit := flags.Int("limit", 10, "Number of sessions to list")

	if err := flags.Parse(args); err != nil {
		return err
	}

	sessions, err := c.store.ListSessions(*limit)
	if err != nil {
		return fmt.Errorf("failed to list sessions: %w", err)
	}

	if len(sessions) == 0 {
		fmt.Println("No sessions found.")
		return nil
	}

	fmt.Println("Analysis Sessions:")
	fmt.Println("")
	fmt.Printf("%-6s  %-20s  %-10s  %-10s  %s\n",
		"ID", "Created At", "Project", "Status", "Version")
	fmt.Println(strings.Repeat("-", 80))

	for _, s := range sessions {
		fmt.Printf("%-6d  %-20s  %-10s  %-10s  %s\n",
			s.ID,
			s.CreatedAt.Format("2006-01-02 15:04:05"),
			truncate(s.ProjectName, 10),
			s.Status,
			s.Version,
		)
	}

	return nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
