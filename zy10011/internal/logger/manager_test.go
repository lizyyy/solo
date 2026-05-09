package logger

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewManager(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "test.log")

	mgr := NewManager(logPath)
	require.NotNil(t, mgr)
	defer mgr.Close()

	assert.FileExists(t, logPath)
}

func TestLogLevels(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "levels.log")

	mgr := NewManager(logPath)
	defer mgr.Close()

	mgr.Debug("test", "debug message", nil)
	mgr.Info("test", "info message", nil)
	mgr.Warn("test", "warn message", nil)
	mgr.Error("test", "error message", nil)

	summary := mgr.GetSummary()
	assert.Equal(t, int64(4), summary.TotalEntries)
	assert.Equal(t, int64(1), summary.DebugCount)
	assert.Equal(t, int64(1), summary.InfoCount)
	assert.Equal(t, int64(1), summary.WarningCount)
	assert.Equal(t, int64(1), summary.ErrorCount)
}

func TestLogWithData(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "data.log")

	mgr := NewManager(logPath)
	defer mgr.Close()

	data := map[string]interface{}{
		"channel_id": "ch-123",
		"count":      42,
		"error":      "test error",
	}

	mgr.Info("monitor", "channel operation", data)

	entries := mgr.GetEntries(10)
	require.Len(t, entries, 1)
	assert.Equal(t, "monitor", entries[0].Component)
	assert.Equal(t, data, entries[0].Data)
}

func TestGetEntries(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "entries.log")

	mgr := NewManager(logPath)
	defer mgr.Close()

	for i := 0; i < 10; i++ {
		mgr.Info("test", fmt.Sprintf("message %d", i), nil)
	}

	entries := mgr.GetEntries(5)
	assert.Len(t, entries, 5)

	allEntries := mgr.GetEntries(0)
	assert.Len(t, allEntries, 10)
}

func TestGetErrors(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "errors.log")

	mgr := NewManager(logPath)
	defer mgr.Close()

	for i := 0; i < 5; i++ {
		if i%2 == 0 {
			mgr.Error("test", fmt.Sprintf("error %d", i), nil)
		} else {
			mgr.Info("test", fmt.Sprintf("info %d", i), nil)
		}
	}

	errors := mgr.GetErrors(10)
	assert.Len(t, errors, 3)
}

func TestGetByComponent(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "component.log")

	mgr := NewManager(logPath)
	defer mgr.Close()

	mgr.Info("monitor", "m1", nil)
	mgr.Info("detector", "d1", nil)
	mgr.Info("monitor", "m2", nil)
	mgr.Info("recovery", "r1", nil)

	monitorLogs := mgr.GetByComponent("monitor", 10)
	assert.Len(t, monitorLogs, 2)
}

func TestLogFileWriting(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "file.log")

	mgr := NewManager(logPath)

	mgr.Info("test", "test message 1", nil)
	mgr.Info("test", "test message 2", nil)

	mgr.Close()

	content, err := os.ReadFile(logPath)
	require.NoError(t, err)
	assert.Contains(t, string(content), "test message 1")
	assert.Contains(t, string(content), "test message 2")
}

func TestConcurrentLogging(t *testing.T) {
	tmpDir := t.TempDir()
	logPath := filepath.Join(tmpDir, "concurrent.log")

	mgr := NewManager(logPath)
	defer mgr.Close()

	done := make(chan struct{})
	var wg sync.WaitGroup

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				mgr.Info("concurrent", fmt.Sprintf("goroutine %d msg %d", id, j), nil)
			}
		}(i)
	}

	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(10 * time.Second):
		t.Fatal("timeout waiting for concurrent logging")
	}

	summary := mgr.GetSummary()
	assert.Equal(t, int64(1000), summary.TotalEntries)
}
