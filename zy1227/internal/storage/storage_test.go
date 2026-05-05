package storage

import (
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/yourteam/sync-analyzer/internal/models"
)

func TestSQLiteStore_Init(t *testing.T) {
	// 创建临时数据库
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	// 测试初始化
	if err := store.Init(); err != nil {
		t.Fatalf("Failed to init database: %v", err)
	}

	// 验证表是否创建成功
	// 尝试查询一个表
	rows, err := store.db.Query("SELECT name FROM sqlite_master WHERE type='table'")
	if err != nil {
		t.Fatalf("Failed to query tables: %v", err)
	}
	defer rows.Close()

	tables := make(map[string]bool)
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			t.Fatalf("Failed to scan table name: %v", err)
		}
		tables[name] = true
	}

	expectedTables := []string{
		"analysis_runs",
		"sync_primitives",
		"sync_events",
		"issues",
	}

	for _, table := range expectedTables {
		if !tables[table] {
			t.Errorf("Table %s not found", table)
		}
	}
}

func TestSQLiteStore_AnalysisRun(t *testing.T) {
	// 创建临时数据库
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	if err := store.Init(); err != nil {
		t.Fatalf("Failed to init database: %v", err)
	}

	// 测试创建分析运行
	tx, err := store.BeginTransaction()
	if err != nil {
		t.Fatalf("Failed to begin transaction: %v", err)
	}

	run := &models.AnalysisRun{
		Name:      "test_run_1",
		StartTime: time.Now(),
		Status:    "running",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	runID, err := store.CreateAnalysisRun(tx, run)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to create analysis run: %v", err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}

	// 验证运行ID
	if runID <= 0 {
		t.Errorf("Expected positive run ID, got %d", runID)
	}

	// 测试获取分析运行
	retrievedRun, err := store.GetAnalysisRun(runID)
	if err != nil {
		t.Fatalf("Failed to get analysis run: %v", err)
	}

	if retrievedRun.Name != "test_run_1" {
		t.Errorf("Expected run name 'test_run_1', got '%s'", retrievedRun.Name)
	}

	// 测试更新分析运行
	tx, err = store.BeginTransaction()
	if err != nil {
		t.Fatalf("Failed to begin transaction: %v", err)
	}

	retrievedRun.Status = "completed"
	if err := store.UpdateAnalysisRun(tx, retrievedRun); err != nil {
		tx.Rollback()
		t.Fatalf("Failed to update analysis run: %v", err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}

	// 验证更新
	updatedRun, err := store.GetAnalysisRun(runID)
	if err != nil {
		t.Fatalf("Failed to get updated run: %v", err)
	}

	if updatedRun.Status != "completed" {
		t.Errorf("Expected status 'completed', got '%s'", updatedRun.Status)
	}
}

func TestSQLiteStore_ListAnalysisRuns(t *testing.T) {
	// 创建临时数据库
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	if err := store.Init(); err != nil {
		t.Fatalf("Failed to init database: %v", err)
	}

	// 创建多个运行
	for i := 0; i < 3; i++ {
		tx, err := store.BeginTransaction()
		if err != nil {
			t.Fatalf("Failed to begin transaction: %v", err)
		}

		run := &models.AnalysisRun{
			Name:      fmt.Sprintf("test_run_%d", i),
			StartTime: time.Now(),
			Status:    "running",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		_, err = store.CreateAnalysisRun(tx, run)
		if err != nil {
			tx.Rollback()
			t.Fatalf("Failed to create analysis run: %v", err)
		}

		if err := tx.Commit(); err != nil {
			t.Fatalf("Failed to commit transaction: %v", err)
		}
	}

	// 测试列出运行
	runs, err := store.ListAnalysisRuns()
	if err != nil {
		t.Fatalf("Failed to list analysis runs: %v", err)
	}

	if len(runs) != 3 {
		t.Errorf("Expected 3 runs, got %d", len(runs))
	}

	// 验证是否按时间倒序排列
	for i := 0; i < len(runs)-1; i++ {
		if runs[i].CreatedAt.Before(runs[i+1].CreatedAt) {
			t.Error("Runs should be ordered by created_at DESC")
		}
	}
}

func TestSQLiteStore_SaveAndGetIssues(t *testing.T) {
	// 创建临时数据库
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	if err := store.Init(); err != nil {
		t.Fatalf("Failed to init database: %v", err)
	}

	// 创建一个运行
	tx, err := store.BeginTransaction()
	if err != nil {
		t.Fatalf("Failed to begin transaction: %v", err)
	}

	run := &models.AnalysisRun{
		Name:      "test_run_with_issues",
		StartTime: time.Now(),
		Status:    "running",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	runID, err := store.CreateAnalysisRun(tx, run)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to create analysis run: %v", err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}

	// 保存一些问题
	issues := []models.Issue{
		{
			RunID:       runID,
			Type:        models.IssueLockOrderInversion,
			Severity:    models.SeverityCritical,
			Title:       "Test Issue 1",
			Description: "This is a critical issue",
			File:        "main.go",
			Line:        10,
			CreatedAt:   time.Now(),
		},
		{
			RunID:       runID,
			Type:        models.IssueWaitGroupCountError,
			Severity:    models.SeverityHigh,
			Title:       "Test Issue 2",
			Description: "This is a high severity issue",
			File:        "main.go",
			Line:        20,
			CreatedAt:   time.Now(),
		},
	}

	tx, err = store.BeginTransaction()
	if err != nil {
		t.Fatalf("Failed to begin transaction: %v", err)
	}

	for i := range issues {
		_, err := store.SaveIssue(tx, &issues[i])
		if err != nil {
			tx.Rollback()
			t.Fatalf("Failed to save issue: %v", err)
		}
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}

	// 测试获取问题
	retrievedIssues, err := store.GetIssuesByRunID(runID)
	if err != nil {
		t.Fatalf("Failed to get issues: %v", err)
	}

	if len(retrievedIssues) != 2 {
		t.Errorf("Expected 2 issues, got %d", len(retrievedIssues))
	}

	// 验证问题内容
	for _, issue := range retrievedIssues {
		if issue.RunID != runID {
			t.Errorf("Expected run ID %d, got %d", runID, issue.RunID)
		}
	}
}

func TestSQLiteStore_SaveAnalysisResult(t *testing.T) {
	// 创建临时数据库
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	if err := store.Init(); err != nil {
		t.Fatalf("Failed to init database: %v", err)
	}

	// 先创建一个运行
	tx, err := store.BeginTransaction()
	if err != nil {
		t.Fatalf("Failed to begin transaction: %v", err)
	}

	run := &models.AnalysisRun{
		Name:      "test_result_run",
		StartTime: time.Now(),
		Status:    "running",
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	runID, err := store.CreateAnalysisRun(tx, run)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to create analysis run: %v", err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit transaction: %v", err)
	}

	// 创建分析结果
	result := &models.AnalysisResult{
		RunID:   runID,
		RunName: "test_result_run",
		Primitives: []models.SyncPrimitive{
			{
				Type:     models.SyncTypeMutex,
				Name:     "mu",
				Location: "main.go:10",
				File:     "main.go",
				Line:     10,
			},
		},
		Events: []models.SyncEvent{
			{
				PrimitiveName: "mu",
				PrimitiveType: models.SyncTypeMutex,
				EventType:     "Lock",
				GoroutineID:   1,
				Timestamp:     time.Now(),
				File:          "main.go",
				Line:          20,
			},
		},
		Issues: []models.Issue{
			{
				Type:        models.IssueLockOrderInversion,
				Severity:    models.SeverityCritical,
				Title:       "Test Issue",
				Description: "Test description",
				File:        "main.go",
				Line:        30,
			},
		},
	}

	// 测试保存分析结果
	if err := store.SaveAnalysisResult(result); err != nil {
		t.Fatalf("Failed to save analysis result: %v", err)
	}

	// 测试获取分析结果
	retrievedResult, err := store.GetAnalysisResult(runID)
	if err != nil {
		t.Fatalf("Failed to get analysis result: %v", err)
	}

	// 验证结果
	if retrievedResult.RunID != runID {
		t.Errorf("Expected run ID %d, got %d", runID, retrievedResult.RunID)
	}

	if len(retrievedResult.Primitives) != 1 {
		t.Errorf("Expected 1 primitive, got %d", len(retrievedResult.Primitives))
	}

	if len(retrievedResult.Events) != 1 {
		t.Errorf("Expected 1 event, got %d", len(retrievedResult.Events))
	}

	if len(retrievedResult.Issues) != 1 {
		t.Errorf("Expected 1 issue, got %d", len(retrievedResult.Issues))
	}
}

func TestSQLiteStore_GetLatestAnalysisRun(t *testing.T) {
	// 创建临时数据库
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := NewSQLiteStore(dbPath)
	if err != nil {
		t.Fatalf("Failed to create store: %v", err)
	}
	defer store.Close()

	if err := store.Init(); err != nil {
		t.Fatalf("Failed to init database: %v", err)
	}

	// 创建多个运行
	var lastRunID int64
	for i := 0; i < 3; i++ {
		tx, err := store.BeginTransaction()
		if err != nil {
			t.Fatalf("Failed to begin transaction: %v", err)
		}

		run := &models.AnalysisRun{
			Name:      fmt.Sprintf("latest_test_run_%d", i),
			StartTime: time.Now(),
			Status:    "completed",
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		}

		runID, err := store.CreateAnalysisRun(tx, run)
		if err != nil {
			tx.Rollback()
			t.Fatalf("Failed to create analysis run: %v", err)
		}
		lastRunID = runID

		if err := tx.Commit(); err != nil {
			t.Fatalf("Failed to commit transaction: %v", err)
		}

		// 等待一下确保时间戳不同
		time.Sleep(10 * time.Millisecond)
	}

	// 测试获取最新运行
	latestRun, err := store.GetLatestAnalysisRun()
	if err != nil {
		t.Fatalf("Failed to get latest analysis run: %v", err)
	}

	if latestRun.ID != lastRunID {
		t.Errorf("Expected latest run ID %d, got %d", lastRunID, latestRun.ID)
	}
}
