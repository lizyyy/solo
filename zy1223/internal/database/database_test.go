package database

import (
	"os"
	"path/filepath"
	"testing"
	"time"

	"go-iface-analyzer/internal/models"
)

func TestNewDatabase(t *testing.T) {
	tempDir := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("获取当前目录失败: %v", err)
	}
	defer os.Chdir(oldWD)

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("切换到临时目录失败: %v", err)
	}

	db, err := New()
	if err != nil {
		t.Fatalf("New 失败: %v", err)
	}
	defer db.Close()

	if db == nil {
		t.Fatal("db 不应为 nil")
	}

	dbPath := filepath.Join(tempDir, "analysis.db")
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Error("数据库文件应该已创建")
	}
}

func TestCreateAndGetSession(t *testing.T) {
	tempDir := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("获取当前目录失败: %v", err)
	}
	defer os.Chdir(oldWD)

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("切换到临时目录失败: %v", err)
	}

	db, err := New()
	if err != nil {
		t.Fatalf("New 失败: %v", err)
	}
	defer db.Close()

	session, err := db.CreateSession()
	if err != nil {
		t.Fatalf("CreateSession 失败: %v", err)
	}

	if session.ID == 0 {
		t.Error("会话 ID 不应为 0")
	}

	if session.Status != "running" {
		t.Errorf("期望状态 'running'，实际得到 '%s'", session.Status)
	}

	retrieved, err := db.GetSessionByID(session.ID)
	if err != nil {
		t.Fatalf("GetSessionByID 失败: %v", err)
	}

	if retrieved == nil {
		t.Fatal("retrieved 不应为 nil")
	}

	if retrieved.ID != session.ID {
		t.Errorf("期望 ID %d，实际得到 %d", session.ID, retrieved.ID)
	}
}

func TestUpdateSession(t *testing.T) {
	tempDir := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("获取当前目录失败: %v", err)
	}
	defer os.Chdir(oldWD)

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("切换到临时目录失败: %v", err)
	}

	db, err := New()
	if err != nil {
		t.Fatalf("New 失败: %v", err)
	}
	defer db.Close()

	session, err := db.CreateSession()
	if err != nil {
		t.Fatalf("CreateSession 失败: %v", err)
	}

	session.EndTime = time.Now()
	session.Status = "completed"
	session.TotalCases = 5
	session.IssuesFound = 3

	if err := db.UpdateSession(session); err != nil {
		t.Fatalf("UpdateSession 失败: %v", err)
	}

	retrieved, err := db.GetSessionByID(session.ID)
	if err != nil {
		t.Fatalf("GetSessionByID 失败: %v", err)
	}

	if retrieved.Status != "completed" {
		t.Errorf("期望状态 'completed'，实际得到 '%s'", retrieved.Status)
	}

	if retrieved.TotalCases != 5 {
		t.Errorf("期望 TotalCases 5，实际得到 %d", retrieved.TotalCases)
	}

	if retrieved.IssuesFound != 3 {
		t.Errorf("期望 IssuesFound 3，实际得到 %d", retrieved.IssuesFound)
	}
}

func TestCreateCase(t *testing.T) {
	tempDir := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("获取当前目录失败: %v", err)
	}
	defer os.Chdir(oldWD)

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("切换到临时目录失败: %v", err)
	}

	db, err := New()
	if err != nil {
		t.Fatalf("New 失败: %v", err)
	}
	defer db.Close()

	session, err := db.CreateSession()
	if err != nil {
		t.Fatalf("CreateSession 失败: %v", err)
	}

	caseItem := &models.InterfaceCase{
		SessionID:   session.ID,
		CaseName:    "test_case",
		Category:    "eface_iface",
		Description: "测试案例",
		SourceFile:  "test.go",
		LineNumber:  10,
	}

	caseID, err := db.CreateCase(caseItem)
	if err != nil {
		t.Fatalf("CreateCase 失败: %v", err)
	}

	if caseID == 0 {
		t.Error("case ID 不应为 0")
	}
}

func TestCreateIssue(t *testing.T) {
	tempDir := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("获取当前目录失败: %v", err)
	}
	defer os.Chdir(oldWD)

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("切换到临时目录失败: %v", err)
	}

	db, err := New()
	if err != nil {
		t.Fatalf("New 失败: %v", err)
	}
	defer db.Close()

	session, err := db.CreateSession()
	if err != nil {
		t.Fatalf("CreateSession 失败: %v", err)
	}

	caseItem := &models.InterfaceCase{
		SessionID: session.ID,
		CaseName:  "test_case",
		Category:  "eface_iface",
	}

	caseID, err := db.CreateCase(caseItem)
	if err != nil {
		t.Fatalf("CreateCase 失败: %v", err)
	}

	issue := &models.AnalysisIssue{
		SessionID:   session.ID,
		CaseID:      caseID,
		IssueType:   "test_issue",
		Severity:    "high",
		Description: "测试问题描述",
		Location:    "test.go:10",
		Suggestion:  "测试建议",
	}

	if err := db.CreateIssue(issue); err != nil {
		t.Fatalf("CreateIssue 失败: %v", err)
	}
}

func TestGetRecentSessions(t *testing.T) {
	tempDir := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("获取当前目录失败: %v", err)
	}
	defer os.Chdir(oldWD)

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("切换到临时目录失败: %v", err)
	}

	db, err := New()
	if err != nil {
		t.Fatalf("New 失败: %v", err)
	}
	defer db.Close()

	for i := 0; i < 5; i++ {
		_, err := db.CreateSession()
		if err != nil {
			t.Fatalf("CreateSession 失败: %v", err)
		}
	}

	sessions, err := db.GetRecentSessions(3)
	if err != nil {
		t.Fatalf("GetRecentSessions 失败: %v", err)
	}

	if len(sessions) != 3 {
		t.Errorf("期望 3 个会话，实际得到 %d", len(sessions))
	}
}

func TestDBExists(t *testing.T) {
	tempDir := t.TempDir()
	oldWD, err := os.Getwd()
	if err != nil {
		t.Fatalf("获取当前目录失败: %v", err)
	}
	defer os.Chdir(oldWD)

	if err := os.Chdir(tempDir); err != nil {
		t.Fatalf("切换到临时目录失败: %v", err)
	}

	db, err := New()
	if err != nil {
		t.Fatalf("New 失败: %v", err)
	}
	defer db.Close()

	if !db.DBExists() {
		t.Error("数据库应该存在")
	}
}
