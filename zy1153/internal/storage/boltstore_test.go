package storage

import (
	"os"
	"testing"
	"time"

	"github.com/zy1153/pool-diagnostic/internal/models"
)

func TestBoltStore_BasicOperations(t *testing.T) {
	// 创建临时测试数据库
	testDB := "test_basic.db"
	defer os.Remove(testDB)

	store, err := NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	t.Run("Create and Get Pool", func(t *testing.T) {
		pool := &models.ConnectionPool{
			Name:        "test-pool",
			MaxOpen:     20,
			MaxIdle:     10,
			IdleTimeout: 5 * time.Minute,
			TenantQuota: 5,
		}

		err := store.CreatePool(pool)
		if err != nil {
			t.Fatalf("Failed to create pool: %v", err)
		}

		if pool.ID == "" {
			t.Error("Pool ID should be generated")
		}

		retrieved, err := store.GetPool(pool.ID)
		if err != nil {
			t.Fatalf("Failed to get pool: %v", err)
		}

		if retrieved.Name != pool.Name {
			t.Errorf("Expected pool name %s, got %s", pool.Name, retrieved.Name)
		}

		if retrieved.MaxOpen != pool.MaxOpen {
			t.Errorf("Expected max_open %d, got %d", pool.MaxOpen, retrieved.MaxOpen)
		}
	})

	t.Run("GetDefaultPool", func(t *testing.T) {
		pool, err := store.GetDefaultPool()
		if err != nil {
			t.Fatalf("Failed to get default pool: %v", err)
		}

		if pool.Name != "test-pool" {
			t.Errorf("Expected default pool name 'test-pool', got %s", pool.Name)
		}
	})

	t.Run("Create and Get Lease", func(t *testing.T) {
		lease := &models.ConnectionLease{
			ConnectionID: "conn-test-001",
			RequestID:    "req-test-001",
			TenantID:     "tenant-test",
			BorrowedAt:   time.Now(),
			Status:       models.LeaseStatusBorrowed,
		}

		err := store.CreateLease(lease)
		if err != nil {
			t.Fatalf("Failed to create lease: %v", err)
		}

		retrieved, err := store.GetLease(lease.ID)
		if err != nil {
			t.Fatalf("Failed to get lease: %v", err)
		}

		if retrieved.ConnectionID != lease.ConnectionID {
			t.Errorf("Expected connection_id %s, got %s", lease.ConnectionID, retrieved.ConnectionID)
		}
	})

	t.Run("GetLeasesByConnection", func(t *testing.T) {
		// 为同一连接创建多个租约
		lease1 := &models.ConnectionLease{
			ConnectionID: "conn-multi-001",
			RequestID:    "req-multi-001",
			TenantID:     "tenant-test",
			BorrowedAt:   time.Now(),
			Status:       models.LeaseStatusReturned,
		}
		lease2 := &models.ConnectionLease{
			ConnectionID: "conn-multi-001",
			RequestID:    "req-multi-002",
			TenantID:     "tenant-test",
			BorrowedAt:   time.Now().Add(1 * time.Minute),
			Status:       models.LeaseStatusBorrowed,
		}

		store.CreateLease(lease1)
		store.CreateLease(lease2)

		leases, err := store.GetLeasesByConnection("conn-multi-001")
		if err != nil {
			t.Fatalf("Failed to get leases by connection: %v", err)
		}

		if len(leases) != 2 {
			t.Errorf("Expected 2 leases, got %d", len(leases))
		}
	})

	t.Run("GetActiveLeases", func(t *testing.T) {
		// 先清理可能存在的其他租约
		// 创建一个活跃租约和一个已归还租约
		activeLease := &models.ConnectionLease{
			ConnectionID: "conn-active-001",
			RequestID:    "req-active-001",
			TenantID:     "tenant-test",
			BorrowedAt:   time.Now(),
			Status:       models.LeaseStatusBorrowed,
		}
		returnedLease := &models.ConnectionLease{
			ConnectionID: "conn-returned-001",
			RequestID:    "req-returned-001",
			TenantID:     "tenant-test",
			BorrowedAt:   time.Now().Add(-1 * time.Hour),
			Status:       models.LeaseStatusReturned,
		}

		store.CreateLease(activeLease)
		store.CreateLease(returnedLease)

		activeLeases, err := store.GetActiveLeases()
		if err != nil {
			t.Fatalf("Failed to get active leases: %v", err)
		}

		// 应该至少包含我们刚创建的活跃租约
		if len(activeLeases) < 1 {
			t.Error("Expected at least 1 active lease")
		}
	})
}

func TestBoltStore_TransactionOperations(t *testing.T) {
	testDB := "test_transactions.db"
	defer os.Remove(testDB)

	store, err := NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	t.Run("Create and Get Transaction", func(t *testing.T) {
		tx := &models.Transaction{
			ID:           "tx-test-001",
			ConnectionID: "conn-tx-001",
			RequestID:    "req-tx-001",
			TenantID:     "tenant-test",
			BeginTime:    time.Now(),
			Status:       models.TransactionStatusActive,
			SQLCount:     2,
		}

		err := store.CreateTransaction(tx)
		if err != nil {
			t.Fatalf("Failed to create transaction: %v", err)
		}

		retrieved, err := store.GetTransaction(tx.ID)
		if err != nil {
			t.Fatalf("Failed to get transaction: %v", err)
		}

		if retrieved.ConnectionID != tx.ConnectionID {
			t.Errorf("Expected connection_id %s, got %s", tx.ConnectionID, retrieved.ConnectionID)
		}

		if retrieved.Status != models.TransactionStatusActive {
			t.Errorf("Expected status active, got %s", retrieved.Status)
		}
	})

	t.Run("GetActiveTransactions", func(t *testing.T) {
		activeTx := &models.Transaction{
			ID:           "tx-active-001",
			ConnectionID: "conn-active-tx-001",
			RequestID:    "req-active-tx-001",
			TenantID:     "tenant-test",
			BeginTime:    time.Now(),
			Status:       models.TransactionStatusActive,
		}
		committedTx := &models.Transaction{
			ID:           "tx-committed-001",
			ConnectionID: "conn-committed-tx-001",
			RequestID:    "req-committed-tx-001",
			TenantID:     "tenant-test",
			BeginTime:    time.Now().Add(-1 * time.Hour),
			Status:       models.TransactionStatusCommitted,
		}

		store.CreateTransaction(activeTx)
		store.CreateTransaction(committedTx)

		activeTxs, err := store.GetActiveTransactions()
		if err != nil {
			t.Fatalf("Failed to get active transactions: %v", err)
		}

		if len(activeTxs) < 1 {
			t.Error("Expected at least 1 active transaction")
		}
	})
}

func TestBoltStore_AlertOperations(t *testing.T) {
	testDB := "test_alerts.db"
	defer os.Remove(testDB)

	store, err := NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	t.Run("Create and Get Alert", func(t *testing.T) {
		alert := &models.Alert{
			Type:           models.AlertTypeConnectionUnreturned,
			Severity:       models.AlertSeverityHigh,
			Title:          "Test Alert",
			Description:    "Test description",
			RootCause:      "Test root cause",
			Recommendation: "Test recommendation",
			Status:         models.AlertStatusOpen,
			IsFalsePositive: false,
			Score:          0.85,
		}

		err := store.CreateAlert(alert)
		if err != nil {
			t.Fatalf("Failed to create alert: %v", err)
		}

		if alert.ID == "" {
			t.Error("Alert ID should be generated")
		}

		retrieved, err := store.GetAlert(alert.ID)
		if err != nil {
			t.Fatalf("Failed to get alert: %v", err)
		}

		if retrieved.Title != alert.Title {
			t.Errorf("Expected title %s, got %s", alert.Title, retrieved.Title)
		}

		if retrieved.Score != alert.Score {
			t.Errorf("Expected score %.2f, got %.2f", alert.Score, retrieved.Score)
		}
	})

	t.Run("UpdateAlert", func(t *testing.T) {
		alert := &models.Alert{
			Type:           models.AlertTypeSlowSQLOccupation,
			Severity:       models.AlertSeverityMedium,
			Title:          "Slow SQL Alert",
			Status:         models.AlertStatusOpen,
			IsFalsePositive: false,
		}

		store.CreateAlert(alert)

		// 更新状态
		alert.Status = models.AlertStatusAcknowledged
		alert.IsFalsePositive = false

		err := store.UpdateAlert(alert)
		if err != nil {
			t.Fatalf("Failed to update alert: %v", err)
		}

		retrieved, _ := store.GetAlert(alert.ID)
		if retrieved.Status != models.AlertStatusAcknowledged {
			t.Errorf("Expected status acknowledged, got %s", retrieved.Status)
		}
	})

	t.Run("GetOpenAlerts", func(t *testing.T) {
		openAlert := &models.Alert{
			Type:           models.AlertTypeLongTransaction,
			Severity:       models.AlertSeverityCritical,
			Title:          "Open Alert",
			Status:         models.AlertStatusOpen,
			IsFalsePositive: false,
		}
		resolvedAlert := &models.Alert{
			Type:           models.AlertTypeConfigurationIssue,
			Severity:       models.AlertSeverityLow,
			Title:          "Resolved Alert",
			Status:         models.AlertStatusResolved,
			IsFalsePositive: false,
		}

		store.CreateAlert(openAlert)
		store.CreateAlert(resolvedAlert)

		openAlerts, err := store.GetOpenAlerts()
		if err != nil {
			t.Fatalf("Failed to get open alerts: %v", err)
		}

		if len(openAlerts) < 1 {
			t.Error("Expected at least 1 open alert")
		}
	})
}

func TestBoltStore_TenantOperations(t *testing.T) {
	testDB := "test_tenants.db"
	defer os.Remove(testDB)

	store, err := NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	t.Run("Create and Get Tenant", func(t *testing.T) {
		tenant := &models.Tenant{
			ID:                 "tenant-test-001",
			Name:               "Test Tenant",
			Quota:              5,
			CurrentConnections: 2,
			TotalBorrows:       100,
			AlertCount:         1,
		}

		err := store.CreateTenant(tenant)
		if err != nil {
			t.Fatalf("Failed to create tenant: %v", err)
		}

		retrieved, err := store.GetTenant(tenant.ID)
		if err != nil {
			t.Fatalf("Failed to get tenant: %v", err)
		}

		if retrieved.Name != tenant.Name {
			t.Errorf("Expected name %s, got %s", tenant.Name, retrieved.Name)
		}

		if retrieved.Quota != tenant.Quota {
			t.Errorf("Expected quota %d, got %d", tenant.Quota, retrieved.Quota)
		}
	})

	t.Run("GetAllTenants", func(t *testing.T) {
		tenant1 := &models.Tenant{
			ID:    "tenant-all-001",
			Name:  "Tenant 1",
			Quota: 5,
		}
		tenant2 := &models.Tenant{
			ID:    "tenant-all-002",
			Name:  "Tenant 2",
			Quota: 10,
		}

		store.CreateTenant(tenant1)
		store.CreateTenant(tenant2)

		tenants, err := store.GetAllTenants()
		if err != nil {
			t.Fatalf("Failed to get all tenants: %v", err)
		}

		if len(tenants) < 2 {
			t.Errorf("Expected at least 2 tenants, got %d", len(tenants))
		}
	})
}

func TestBoltStore_QueryOperations(t *testing.T) {
	testDB := "test_queries.db"
	defer os.Remove(testDB)

	store, err := NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	t.Run("Create and Get Query", func(t *testing.T) {
		query := &models.SQLQuery{
			ID:           "query-test-001",
			ConnectionID: "conn-query-001",
			RequestID:    "req-query-001",
			TenantID:     "tenant-test",
			SQLText:      "SELECT * FROM users WHERE id = 1",
			SQLType:      models.SQLTypeSelect,
			StartTime:    time.Now(),
			Duration:     100 * time.Millisecond,
			IsSlow:       false,
		}

		err := store.CreateQuery(query)
		if err != nil {
			t.Fatalf("Failed to create query: %v", err)
		}

		retrieved, err := store.GetQuery(query.ID)
		if err != nil {
			t.Fatalf("Failed to get query: %v", err)
		}

		if retrieved.SQLText != query.SQLText {
			t.Errorf("Expected SQL text %s, got %s", query.SQLText, retrieved.SQLText)
		}
	})

	t.Run("GetSlowQueries", func(t *testing.T) {
		fastQuery := &models.SQLQuery{
			ConnectionID: "conn-slow-001",
			RequestID:    "req-slow-001",
			TenantID:     "tenant-test",
			SQLText:      "SELECT 1",
			SQLType:      models.SQLTypeSelect,
			StartTime:    time.Now(),
			Duration:     50 * time.Millisecond,
			IsSlow:       false,
		}
		slowQuery := &models.SQLQuery{
			ConnectionID: "conn-slow-002",
			RequestID:    "req-slow-002",
			TenantID:     "tenant-test",
			SQLText:      "SELECT * FROM large_table",
			SQLType:      models.SQLTypeSelect,
			StartTime:    time.Now().Add(-1 * time.Minute),
			Duration:     15 * time.Second,
			IsSlow:       true,
		}

		store.CreateQuery(fastQuery)
		store.CreateQuery(slowQuery)

		threshold := 10 * time.Second
		slowQueries, err := store.GetSlowQueries(threshold)
		if err != nil {
			t.Fatalf("Failed to get slow queries: %v", err)
		}

		if len(slowQueries) < 1 {
			t.Error("Expected at least 1 slow query")
		}
	})
}

func TestBoltStore_QueueOperations(t *testing.T) {
	testDB := "test_queue.db"
	defer os.Remove(testDB)

	store, err := NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	t.Run("Create and Get Queue Item", func(t *testing.T) {
		item := &models.WaitQueueItem{
			RequestID:  "req-queue-001",
			TenantID:   "tenant-test",
			EnqueuedAt: time.Now(),
			Status:     models.QueueStatusWaiting,
			Timeout:    30 * time.Second,
		}

		err := store.CreateQueueItem(item)
		if err != nil {
			t.Fatalf("Failed to create queue item: %v", err)
		}

		retrieved, err := store.GetQueueItem(item.ID)
		if err != nil {
			t.Fatalf("Failed to get queue item: %v", err)
		}

		if retrieved.RequestID != item.RequestID {
			t.Errorf("Expected request_id %s, got %s", item.RequestID, retrieved.RequestID)
		}
	})

	t.Run("GetActiveQueueItems", func(t *testing.T) {
		waitingItem := &models.WaitQueueItem{
			RequestID:  "req-active-queue-001",
			TenantID:   "tenant-test",
			EnqueuedAt: time.Now(),
			Status:     models.QueueStatusWaiting,
			Timeout:    30 * time.Second,
		}
		acquiredItem := &models.WaitQueueItem{
			RequestID:  "req-acquired-queue-001",
			TenantID:   "tenant-test",
			EnqueuedAt: time.Now().Add(-1 * time.Minute),
			Status:     models.QueueStatusAcquired,
			Timeout:    30 * time.Second,
		}

		store.CreateQueueItem(waitingItem)
		store.CreateQueueItem(acquiredItem)

		activeItems, err := store.GetActiveQueueItems()
		if err != nil {
			t.Fatalf("Failed to get active queue items: %v", err)
		}

		if len(activeItems) < 1 {
			t.Error("Expected at least 1 active queue item")
		}
	})
}

func TestBoltStore_ClearAllData(t *testing.T) {
	testDB := "test_clear.db"
	defer os.Remove(testDB)

	store, err := NewBoltStore(testDB)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	// 创建一些测试数据
	lease := &models.ConnectionLease{
		ConnectionID: "conn-clear-001",
		RequestID:    "req-clear-001",
		TenantID:     "tenant-clear",
		BorrowedAt:   time.Now(),
		Status:       models.LeaseStatusBorrowed,
	}
	store.CreateLease(lease)

	alert := &models.Alert{
		Type:           models.AlertTypeConnectionUnreturned,
		Severity:       models.AlertSeverityHigh,
		Title:          "Test Alert for Clear",
		Status:         models.AlertStatusOpen,
		IsFalsePositive: false,
	}
	store.CreateAlert(alert)

	// 验证数据存在
	leasesBefore, _ := store.GetAllLeases()
	alertsBefore, _ := store.GetAllAlerts()

	if len(leasesBefore) == 0 {
		t.Error("Leases should exist before clear")
	}
	if len(alertsBefore) == 0 {
		t.Error("Alerts should exist before clear")
	}

	// 清理数据
	err = store.ClearAllData()
	if err != nil {
		t.Fatalf("Failed to clear data: %v", err)
	}

	// 验证数据已清理
	leasesAfter, _ := store.GetAllLeases()
	alertsAfter, _ := store.GetAllAlerts()

	if len(leasesAfter) != 0 {
		t.Error("Leases should be cleared")
	}
	if len(alertsAfter) != 0 {
		t.Error("Alerts should be cleared")
	}
}
