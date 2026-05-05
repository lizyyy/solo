package tests

import (
	"db-audit/internal/storage"
	"os"
	"path/filepath"
	"testing"
)

func TestStorage_InitDB(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := storage.NewStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer store.Close()

	_, err = store.GetLatestSession()
	if err != nil {
		t.Fatalf("Failed to query after init: %v", err)
	}
}

func TestStorage_CreateSession(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := storage.NewStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer store.Close()

	sessionID, err := store.CreateSession("test-project", "v1.0.0")
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	if sessionID <= 0 {
		t.Errorf("Expected positive session ID, got %d", sessionID)
	}

	session, err := store.GetSession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get session: %v", err)
	}

	if session == nil {
		t.Error("Expected session to exist")
	}

	if session.ProjectName != "test-project" {
		t.Errorf("Expected project name 'test-project', got '%s'", session.ProjectName)
	}

	if session.Version != "v1.0.0" {
		t.Errorf("Expected version 'v1.0.0', got '%s'", session.Version)
	}
}

func TestStorage_UpdateSessionStatus(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := storage.NewStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer store.Close()

	sessionID, err := store.CreateSession("test-project", "v1.0.0")
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	err = store.UpdateSessionStatus(sessionID, "completed", "")
	if err != nil {
		t.Fatalf("Failed to update session status: %v", err)
	}

	session, err := store.GetSession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get session: %v", err)
	}

	if session.Status != "completed" {
		t.Errorf("Expected status 'completed', got '%s'", session.Status)
	}
}

func TestStorage_ListSessions(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := storage.NewStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer store.Close()

	for i := 0; i < 5; i++ {
		_, err := store.CreateSession(fmt.Sprintf("project-%d", i), "v1.0.0")
		if err != nil {
			t.Fatalf("Failed to create session: %v", err)
		}
	}

	sessions, err := store.ListSessions(10)
	if err != nil {
		t.Fatalf("Failed to list sessions: %v", err)
	}

	if len(sessions) != 5 {
		t.Errorf("Expected 5 sessions, got %d", len(sessions))
	}

	sessions, err = store.ListSessions(3)
	if err != nil {
		t.Fatalf("Failed to list sessions with limit: %v", err)
	}

	if len(sessions) != 3 {
		t.Errorf("Expected 3 sessions with limit, got %d", len(sessions))
	}
}

func TestStorage_SaveAndGetBottlenecks(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := storage.NewStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer store.Close()

	sessionID, err := store.CreateSession("test-project", "v1.0.0")
	if err != nil {
		t.Fatalf("Failed to create session: %v", err)
	}

	bottlenecks := []storage.Bottleneck{
		{
			Category:    "connection_pool",
			Description: "Connection pool too small",
			Severity:    "HIGH",
			Priority:    1,
			Impact:      8.5,
		},
		{
			Category:    "index",
			Description: "Missing index on users.phone",
			Severity:    "CRITICAL",
			Priority:    2,
			Impact:      9.0,
		},
	}

	err = store.SaveBottlenecks(sessionID, bottlenecks)
	if err != nil {
		t.Fatalf("Failed to save bottlenecks: %v", err)
	}

	saved, err := store.GetBottlenecksBySession(sessionID)
	if err != nil {
		t.Fatalf("Failed to get bottlenecks: %v", err)
	}

	if len(saved) != 2 {
		t.Errorf("Expected 2 bottlenecks, got %d", len(saved))
	}

	if saved[0].Priority <= saved[1].Priority {
		t.Error("Expected bottlenecks to be ordered by priority")
	}
}

func TestStorage_GetLatestSession(t *testing.T) {
	tempDir := t.TempDir()
	dbPath := filepath.Join(tempDir, "test.db")

	store, err := storage.NewStorage(dbPath)
	if err != nil {
		t.Fatalf("Failed to create storage: %v", err)
	}
	defer store.Close()

	latest, err := store.GetLatestSession()
	if err != nil {
		t.Fatalf("Failed to get latest session on empty db: %v", err)
	}
	if latest != nil {
		t.Error("Expected nil session on empty db")
	}

	_, err = store.CreateSession("first", "v1.0")
	if err != nil {
		t.Fatalf("Failed to create first session: %v", err)
	}

	secondID, err := store.CreateSession("second", "v2.0")
	if err != nil {
		t.Fatalf("Failed to create second session: %v", err)
	}

	latest, err = store.GetLatestSession()
	if err != nil {
		t.Fatalf("Failed to get latest session: %v", err)
	}

	if latest == nil {
		t.Error("Expected latest session to exist")
	}

	if latest.ID != secondID {
		t.Errorf("Expected latest session ID %d, got %d", secondID, latest.ID)
	}
}


