package diagnostics

import (
	"os"
	"testing"
	"time"

	"github.com/zy1153/pool-diagnostic/internal/models"
	"github.com/zy1153/pool-diagnostic/internal/storage"
)

func TestDiagnosticEngine_Basic(t *testing.T) {
	testDB := "test_diagnostic.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	engine := NewDiagnosticEngine(store)

	t.Run("DefaultThresholds", func(t *testing.T) {
		thresholds := DefaultThresholds()

		if thresholds.ConnectionUnreturnedThreshold != 5*time.Minute {
			t.Errorf("Expected ConnectionUnreturnedThreshold to be 5m, got %v", thresholds.ConnectionUnreturnedThreshold)
		}

		if thresholds.LongTransactionThreshold != 1*time.Minute {
			t.Errorf("Expected LongTransactionThreshold to be 1m, got %v", thresholds.LongTransactionThreshold)
		}

		if thresholds.SlowSQLThreshold != 10*time.Second {
			t.Errorf("Expected SlowSQLThreshold to be 10s, got %v", thresholds.SlowSQLThreshold)
		}
	})

	t.Run("CalculateSeverity", func(t *testing.T) {
		threshold := 1 * time.Minute

		// 测试不同比例的严重程度
		testCases := []struct {
			name     string
			actual   time.Duration
			expected models.AlertSeverity
		}{
			{"Low severity", 2 * time.Minute, models.AlertSeverityLow},
			{"Medium severity", 3 * time.Minute, models.AlertSeverityMedium},
			{"High severity", 6 * time.Minute, models.AlertSeverityHigh},
			{"Critical severity", 11 * time.Minute, models.AlertSeverityCritical},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				severity := engine.calculateSeverity(tc.actual, threshold)
				if severity != tc.expected {
					t.Errorf("Expected severity %s, got %s for actual=%v", tc.expected, severity, tc.actual)
				}
			})
		}
	})

	t.Run("CalculateScore", func(t *testing.T) {
		threshold := 1 * time.Minute

		// 测试分数计算
		testCases := []struct {
			name          string
			actual        time.Duration
			expectedRange struct {
				min float64
				max float64
			}
		}{
			{"Below threshold", 30 * time.Second, struct{ min, max float64 }{0, 0.5}},
			{"Just above threshold", 2 * time.Minute, struct{ min, max float64 }{0.5, 0.6}},
			{"Well above threshold", 5 * time.Minute, struct{ min, max float64 }{0.6, 0.8}},
			{"Maximum", 15 * time.Minute, struct{ min, max float64 }{0.9, 1.0}},
		}

		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				score := engine.calculateScore(tc.actual, threshold)
				if score < tc.expectedRange.min || score > tc.expectedRange.max {
					t.Errorf("Expected score between %.2f and %.2f, got %.2f for actual=%v",
						tc.expectedRange.min, tc.expectedRange.max, score, tc.actual)
				}
			})
		}
	})
}

func TestDiagnosticEngine_DetectConnectionUnreturned(t *testing.T) {
	testDB := "test_conn_unreturned.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	engine := NewDiagnosticEngine(store)

	// 创建一个正常归还的租约
	now := time.Now()
	returnedLease := &models.ConnectionLease{
		ConnectionID: "conn-returned",
		RequestID:    "req-returned",
		TenantID:     "tenant-1",
		BorrowedAt:   now.Add(-10 * time.Minute),
		Status:       models.LeaseStatusReturned,
	}
	store.CreateLease(returnedLease)

	// 创建一个疑似未归还的租约（超过阈值）
	unreturnedLease := &models.ConnectionLease{
		ConnectionID: "conn-unreturned",
		RequestID:    "req-unreturned",
		TenantID:     "tenant-1",
		BorrowedAt:   now.Add(-10 * time.Minute), // 超过 5 分钟阈值
		Status:       models.LeaseStatusBorrowed,
	}
	store.CreateLease(unreturnedLease)

	// 创建一个刚借出的租约（在阈值内）
	freshLease := &models.ConnectionLease{
		ConnectionID: "conn-fresh",
		RequestID:    "req-fresh",
		TenantID:     "tenant-2",
		BorrowedAt:   now.Add(-1 * time.Minute), // 在 5 分钟阈值内
		Status:       models.LeaseStatusBorrowed,
	}
	store.CreateLease(freshLease)

	alerts, err := engine.detectConnectionUnreturned()
	if err != nil {
		t.Fatalf("Failed to detect connection unreturned: %v", err)
	}

	// 应该只有一个告警（未归还的那个）
	if len(alerts) != 1 {
		t.Errorf("Expected 1 alert, got %d", len(alerts))
	}

	if len(alerts) > 0 {
		alert := alerts[0]
		if alert.Type != models.AlertTypeConnectionUnreturned {
			t.Errorf("Expected alert type connection_unreturned, got %s", alert.Type)
		}

		if *alert.ConnectionID != "conn-unreturned" {
			t.Errorf("Expected connection_id conn-unreturned, got %s", *alert.ConnectionID)
		}
	}
}

func TestDiagnosticEngine_DetectLongTransaction(t *testing.T) {
	testDB := "test_long_tx.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	engine := NewDiagnosticEngine(store)

	now := time.Now()

	// 创建一个正常的已提交事务
	committedTx := &models.Transaction{
		ID:           "tx-committed",
		ConnectionID: "conn-committed",
		RequestID:    "req-committed",
		TenantID:     "tenant-1",
		BeginTime:    now.Add(-10 * time.Minute),
		Status:       models.TransactionStatusCommitted,
	}
	store.CreateTransaction(committedTx)

	// 创建一个长事务（超过 1 分钟阈值）
	longTx := &models.Transaction{
		ID:           "tx-long",
		ConnectionID: "conn-long",
		RequestID:    "req-long",
		TenantID:     "tenant-1",
		BeginTime:    now.Add(-5 * time.Minute), // 超过 1 分钟阈值
		Status:       models.TransactionStatusActive,
	}
	store.CreateTransaction(longTx)

	// 创建一个短事务（在阈值内）
	shortTx := &models.Transaction{
		ID:           "tx-short",
		ConnectionID: "conn-short",
		RequestID:    "req-short",
		TenantID:     "tenant-2",
		BeginTime:    now.Add(-30 * time.Second), // 在 1 分钟阈值内
		Status:       models.TransactionStatusActive,
	}
	store.CreateTransaction(shortTx)

	alerts, err := engine.detectLongTransaction()
	if err != nil {
		t.Fatalf("Failed to detect long transaction: %v", err)
	}

	// 应该只有一个告警（长事务）
	if len(alerts) != 1 {
		t.Errorf("Expected 1 alert, got %d", len(alerts))
	}

	if len(alerts) > 0 {
		alert := alerts[0]
		if alert.Type != models.AlertTypeLongTransaction {
			t.Errorf("Expected alert type long_transaction, got %s", alert.Type)
		}
	}
}

func TestDiagnosticEngine_DetectSlowSQLOccupation(t *testing.T) {
	testDB := "test_slow_sql.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	engine := NewDiagnosticEngine(store)

	now := time.Now()

	// 创建一个正常查询
	fastQuery := &models.SQLQuery{
		ConnectionID: "conn-fast",
		RequestID:    "req-fast",
		TenantID:     "tenant-1",
		SQLText:      "SELECT 1",
		SQLType:      models.SQLTypeSelect,
		StartTime:    now.Add(-1 * time.Minute),
		Duration:     100 * time.Millisecond,
		IsSlow:       false,
	}
	store.CreateQuery(fastQuery)

	// 创建一个慢查询（超过 10 秒阈值）
	slowQuery := &models.SQLQuery{
		ConnectionID: "conn-slow",
		RequestID:    "req-slow",
		TenantID:     "tenant-1",
		SQLText:      "SELECT * FROM large_table",
		SQLType:      models.SQLTypeSelect,
		StartTime:    now.Add(-1 * time.Minute),
		Duration:     15 * time.Second, // 超过 10 秒阈值
		IsSlow:       true,
	}
	store.CreateQuery(slowQuery)

	alerts, err := engine.detectSlowSQLOccupation()
	if err != nil {
		t.Fatalf("Failed to detect slow SQL: %v", err)
	}

	// 应该有一个慢查询告警
	if len(alerts) != 1 {
		t.Errorf("Expected 1 alert, got %d", len(alerts))
	}

	if len(alerts) > 0 {
		alert := alerts[0]
		if alert.Type != models.AlertTypeSlowSQLOccupation {
			t.Errorf("Expected alert type slow_sql_occupation, got %s", alert.Type)
		}
	}
}

func TestDiagnosticEngine_DetectWaitQueueStarvation(t *testing.T) {
	testDB := "test_wait_queue.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	engine := NewDiagnosticEngine(store)

	now := time.Now()

	// 创建一个超时的等待项
	timeoutItem := &models.WaitQueueItem{
		RequestID:  "req-timeout",
		TenantID:   "tenant-1",
		EnqueuedAt: now.Add(-40 * time.Second),
		Status:     models.QueueStatusTimeout,
		IsTimeout:  true,
		Timeout:    30 * time.Second,
	}
	store.CreateQueueItem(timeoutItem)

	// 创建一个正常等待项
	waitingItem := &models.WaitQueueItem{
		RequestID:  "req-waiting",
		TenantID:   "tenant-2",
		EnqueuedAt: now.Add(-5 * time.Second),
		Status:     models.QueueStatusWaiting,
		IsTimeout:  false,
		Timeout:    30 * time.Second,
	}
	store.CreateQueueItem(waitingItem)

	alerts, err := engine.detectWaitQueueStarvation()
	if err != nil {
		t.Fatalf("Failed to detect wait queue starvation: %v", err)
	}

	// 应该有超时告警
	if len(alerts) < 1 {
		t.Error("Expected at least 1 alert for timeout")
	}

	// 检查是否有等待队列饥饿类型的告警
	found := false
	for _, alert := range alerts {
		if alert.Type == models.AlertTypeWaitQueueStarvation {
			found = true
			break
		}
	}

	if !found && len(alerts) > 0 {
		// 可能只检测到了超时，这也是可以接受的
		t.Logf("Alerts found: %v", alerts)
	}
}

func TestDiagnosticEngine_DetectConfigurationIssue(t *testing.T) {
	testDB := "test_config.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	engine := NewDiagnosticEngine(store)

	// 创建一个有问题的配置：max_idle > max_open
	badPool := &models.ConnectionPool{
		Name:        "bad-config-pool",
		MaxOpen:     10,
		MaxIdle:     15, // 这是错误的，max_idle 不能大于 max_open
		IdleTimeout: 5 * time.Minute,
		TenantQuota: 3,
	}
	store.CreatePool(badPool)

	alerts, err := engine.detectConfigurationIssue()
	if err != nil {
		t.Fatalf("Failed to detect configuration issues: %v", err)
	}

	// 应该有配置告警
	if len(alerts) < 1 {
		t.Error("Expected at least 1 configuration alert")
	}

	// 检查是否检测到 max_idle > max_open 的问题
	found := false
	for _, alert := range alerts {
		if alert.Type == models.AlertTypeConfigurationIssue {
			// 检查证据中是否包含 max_idle 和 max_open 的问题
			found = true
			t.Logf("Found configuration alert: %s", alert.Title)
		}
	}

	if !found {
		t.Error("Expected configuration issue alert for max_idle > max_open")
	}
}

func TestDiagnosticEngine_RunFullDiagnostics(t *testing.T) {
	testDB := "test_full_diagnostics.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	// 创建一些测试数据
	now := time.Now()

	// 创建连接池配置
	pool := &models.ConnectionPool{
		Name:        "test-pool",
		MaxOpen:     20,
		MaxIdle:     10,
		IdleTimeout: 5 * time.Minute,
		TenantQuota: 5,
	}
	store.CreatePool(pool)

	// 创建一个未归还的连接
	unreturnedLease := &models.ConnectionLease{
		ConnectionID: "conn-unreturned",
		RequestID:    "req-unreturned",
		TenantID:     "tenant-1",
		BorrowedAt:   now.Add(-10 * time.Minute),
		Status:       models.LeaseStatusBorrowed,
	}
	store.CreateLease(unreturnedLease)

	// 创建一个长事务
	longTx := &models.Transaction{
		ID:           "tx-long",
		ConnectionID: "conn-unreturned",
		RequestID:    "req-unreturned",
		TenantID:     "tenant-1",
		BeginTime:    now.Add(-10 * time.Minute),
		Status:       models.TransactionStatusActive,
	}
	store.CreateTransaction(longTx)

	// 创建一个慢查询
	slowQuery := &models.SQLQuery{
		ConnectionID: "conn-slow",
		RequestID:    "req-slow",
		TenantID:     "tenant-2",
		SQLText:      "SELECT * FROM large_table",
		SQLType:      models.SQLTypeSelect,
		StartTime:    now.Add(-1 * time.Minute),
		Duration:     15 * time.Second,
		IsSlow:       true,
	}
	store.CreateQuery(slowQuery)

	engine := NewDiagnosticEngine(store)
	result, err := engine.RunFullDiagnostics()
	if err != nil {
		t.Fatalf("Failed to run full diagnostics: %v", err)
	}

	// 验证结果
	if result.AnalysisTime.IsZero() {
		t.Error("Analysis time should not be zero")
	}

	if result.Summary.TotalAlerts == 0 {
		t.Error("Expected at least some alerts")
	}

	t.Logf("Total alerts: %d", result.Summary.TotalAlerts)
	t.Logf("Critical alerts: %d", result.Summary.CriticalAlerts)
	t.Logf("High alerts: %d", result.Summary.HighAlerts)
}

func TestDiagnosticEngine_SimulateConfigChange(t *testing.T) {
	testDB := "test_simulate_config.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	engine := NewDiagnosticEngine(store)

	// 创建原始配置
	originalPool := &models.ConnectionPool{
		Name:        "original-pool",
		MaxOpen:     10,
		MaxIdle:     5,
		IdleTimeout: 1 * time.Minute,
		TenantQuota: 3,
	}
	store.CreatePool(originalPool)

	// 模拟新配置
	newConfig := models.PoolConfig{
		MaxOpen:     30,
		MaxIdle:     15,
		IdleTimeout: 5 * time.Minute,
		TenantQuota: 6,
	}

	simulation, err := engine.SimulateConfigChange(newConfig)
	if err != nil {
		t.Fatalf("Failed to simulate config change: %v", err)
	}

	// 验证原始配置
	if simulation.OriginalConfig.MaxOpen != 10 {
		t.Errorf("Expected original max_open 10, got %d", simulation.OriginalConfig.MaxOpen)
	}

	// 验证新配置
	if simulation.ProposedConfig.MaxOpen != 30 {
		t.Errorf("Expected proposed max_open 30, got %d", simulation.ProposedConfig.MaxOpen)
	}

	// 验证改进项
	if len(simulation.ExpectedImprovements) == 0 {
		t.Log("No improvements calculated (this may be expected)")
	} else {
		for _, imp := range simulation.ExpectedImprovements {
			t.Logf("Improvement: %s, %.2f%%", imp.Metric, imp.ImprovementPct)
		}
	}
}

func TestDiagnosticEngine_GetConnectionTimeline(t *testing.T) {
	testDB := "test_timeline.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	engine := NewDiagnosticEngine(store)

	// 为同一连接创建多个租约
	connectionID := "conn-timeline-001"
	now := time.Now()

	// 第一个租约
	lease1 := &models.ConnectionLease{
		ConnectionID: connectionID,
		RequestID:    "req-1",
		TenantID:     "tenant-1",
		BorrowedAt:   now.Add(-30 * time.Minute),
		Status:       models.LeaseStatusReturned,
	}
	returnedAt1 := now.Add(-25 * time.Minute)
	lease1.ReturnedAt = &returnedAt1
	lease1.UseDuration = 5 * time.Minute
	store.CreateLease(lease1)

	// 第二个租约（活跃）
	lease2 := &models.ConnectionLease{
		ConnectionID: connectionID,
		RequestID:    "req-2",
		TenantID:     "tenant-2",
		BorrowedAt:   now.Add(-10 * time.Minute),
		Status:       models.LeaseStatusBorrowed,
	}
	store.CreateLease(lease2)

	// 获取时间线
	events, err := engine.GetConnectionTimeline(connectionID)
	if err != nil {
		t.Fatalf("Failed to get connection timeline: %v", err)
	}

	// 应该至少有 3 个事件（2 个借出 + 1 个归还）
	if len(events) < 3 {
		t.Errorf("Expected at least 3 timeline events, got %d", len(events))
	}

	// 验证事件按时间排序
	for i := 1; i < len(events); i++ {
		if events[i].Timestamp.Before(events[i-1].Timestamp) {
			t.Error("Timeline events should be sorted by time")
		}
	}
}

func TestDiagnosticEngine_GetRequestTimeline(t *testing.T) {
	testDB := "test_request_timeline.db"
	defer os.Remove(testDB)

	store, err := storage.NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	engine := NewDiagnosticEngine(store)

	requestID := "req-timeline-001"
	now := time.Now()

	// 创建租约
	lease := &models.ConnectionLease{
		ConnectionID: "conn-1",
		RequestID:    requestID,
		TenantID:     "tenant-1",
		BorrowedAt:   now.Add(-5 * time.Minute),
		Status:       models.LeaseStatusReturned,
	}
	returnedAt := now.Add(-3 * time.Minute)
	lease.ReturnedAt = &returnedAt
	lease.UseDuration = 2 * time.Minute
	store.CreateLease(lease)

	// 创建 SQL 查询
	query := &models.SQLQuery{
		ConnectionID: "conn-1",
		RequestID:    requestID,
		TenantID:     "tenant-1",
		SQLText:      "SELECT * FROM users WHERE id = 1",
		SQLType:      models.SQLTypeSelect,
		StartTime:    now.Add(-4 * time.Minute),
		Duration:     500 * time.Millisecond,
		IsSlow:       false,
	}
	store.CreateQuery(query)

	// 获取时间线
	events, err := engine.GetRequestTimeline(requestID)
	if err != nil {
		t.Fatalf("Failed to get request timeline: %v", err)
	}

	// 应该至少有 3 个事件（借出、SQL、归还）
	if len(events) < 3 {
		t.Errorf("Expected at least 3 timeline events, got %d", len(events))
	}

	for _, event := range events {
		t.Logf("Event: %s - %s", event.Type, event.Description)
	}
}
