package detector

import (
	"fmt"
	"sync"
	"testing"
	"time"

	"github.com/deadlock-detector/internal/logger"
	"github.com/deadlock-detector/internal/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestNewDetector(t *testing.T) {
	tmpDir := t.TempDir()
	logMgr := logger.NewManager(tmpDir + "/test.log")
	defer logMgr.Close()

	det := NewDetector(logMgr)
	require.NotNil(t, det)
	assert.False(t, det.HasPotentialDeadlock())
	assert.Empty(t, det.GetAllDeadlocks())
}

func TestRecordPotentialDeadlock(t *testing.T) {
	tmpDir := t.TempDir()
	logMgr := logger.NewManager(tmpDir + "/test.log")
	defer logMgr.Close()

	det := NewDetector(logMgr)

	g1 := model.NewGoroutineInfo("g1", "producer")
	g2 := model.NewGoroutineInfo("g2", "consumer")

	det.RecordPotentialDeadlock([]*model.GoroutineInfo{g1, g2}, "test reason")

	assert.True(t, det.HasPotentialDeadlock())
	assert.Len(t, det.GetAllDeadlocks(), 1)
	assert.NotNil(t, det.GetLastDeadlockInfo())
}

func TestResolveDeadlock(t *testing.T) {
	tmpDir := t.TempDir()
	logMgr := logger.NewManager(tmpDir + "/test.log")
	defer logMgr.Close()

	det := NewDetector(logMgr)

	g1 := model.NewGoroutineInfo("g1", "producer")
	g2 := model.NewGoroutineInfo("g2", "consumer")

	det.RecordPotentialDeadlock([]*model.GoroutineInfo{g1, g2}, "test reason")

	deadlock := det.GetLastDeadlockInfo()
	require.NotNil(t, deadlock)

	det.ResolveDeadlock(deadlock.ID, "test_resolution")

	assert.False(t, det.HasPotentialDeadlock())

	allDeadlocks := det.GetAllDeadlocks()
	require.Len(t, allDeadlocks, 1)
	assert.True(t, allDeadlocks[0].Resolved)
	assert.Equal(t, "test_resolution", allDeadlocks[0].ResolutionType)
}

func TestGetUnresolvedDeadlocks(t *testing.T) {
	tmpDir := t.TempDir()
	logMgr := logger.NewManager(tmpDir + "/test.log")
	defer logMgr.Close()

	det := NewDetector(logMgr)

	g1 := model.NewGoroutineInfo("g1", "producer")
	g2 := model.NewGoroutineInfo("g2", "consumer")

	det.RecordPotentialDeadlock([]*model.GoroutineInfo{g1, g2}, "reason 1")
	dl1 := det.GetLastDeadlockInfo()

	det.RecordPotentialDeadlock([]*model.GoroutineInfo{g1, g2}, "reason 2")
	dl2 := det.GetLastDeadlockInfo()

	det.ResolveDeadlock(dl1.ID, "resolution")

	unresolved := det.GetUnresolvedDeadlocks()
	assert.Len(t, unresolved, 1)
	assert.Equal(t, dl2.ID, unresolved[0].ID)
}

func TestAnalyzeWaitGraph_NoCycle(t *testing.T) {
	tmpDir := t.TempDir()
	logMgr := logger.NewManager(tmpDir + "/test.log")
	defer logMgr.Close()

	det := NewDetector(logMgr)

	g1 := model.NewGoroutineInfo("g1", "producer")
	g2 := model.NewGoroutineInfo("g2", "consumer")

	deadlock := model.NewDeadlockInfo([]*model.GoroutineInfo{g1, g2}, nil, "test")
	deadlock.WaitGraph = map[string][]string{
		g1.ID: {"ch1"},
		g2.ID: {"ch2"},
	}

	analysis := det.AnalyzeWaitGraph(deadlock)
	assert.False(t, analysis["is_circular"].(bool))
}

func TestAnalyzeWaitGraph_WithCycle(t *testing.T) {
	tmpDir := t.TempDir()
	logMgr := logger.NewManager(tmpDir + "/test.log")
	defer logMgr.Close()

	det := NewDetector(logMgr)

	g1 := model.NewGoroutineInfo("g1", "producer")
	g2 := model.NewGoroutineInfo("g2", "consumer")

	deadlock := model.NewDeadlockInfo([]*model.GoroutineInfo{g1, g2}, nil, "test")
	deadlock.WaitGraph = map[string][]string{
		g1.ID: {g2.ID},
		g2.ID: {g1.ID},
	}

	analysis := det.AnalyzeWaitGraph(deadlock)
	assert.True(t, analysis["is_circular"].(bool))
}

func TestGetStatistics(t *testing.T) {
	tmpDir := t.TempDir()
	logMgr := logger.NewManager(tmpDir + "/test.log")
	defer logMgr.Close()

	det := NewDetector(logMgr)

	g1 := model.NewGoroutineInfo("g1", "producer")
	g2 := model.NewGoroutineInfo("g2", "consumer")

	det.RecordPotentialDeadlock([]*model.GoroutineInfo{g1, g2}, "reason 1")
	dl := det.GetLastDeadlockInfo()
	time.Sleep(10 * time.Millisecond)
	det.ResolveDeadlock(dl.ID, "resolution")

	det.RecordPotentialDeadlock([]*model.GoroutineInfo{g1, g2}, "reason 2")

	stats := det.GetStatistics()
	assert.Equal(t, 2, stats["total"])
	assert.Equal(t, 1, stats["resolved"])
	assert.Equal(t, 1, stats["unresolved"])
	assert.True(t, stats["has_potential"].(bool))
}

func TestConcurrentDeadlockRecording(t *testing.T) {
	tmpDir := t.TempDir()
	logMgr := logger.NewManager(tmpDir + "/test.log")
	defer logMgr.Close()

	det := NewDetector(logMgr)

	done := make(chan struct{})
	var wg sync.WaitGroup

	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			for j := 0; j < 100; j++ {
				g1 := model.NewGoroutineInfo(fmt.Sprintf("g-%d-%d-1", id, j), "producer")
				g2 := model.NewGoroutineInfo(fmt.Sprintf("g-%d-%d-2", id, j), "consumer")
				det.RecordPotentialDeadlock([]*model.GoroutineInfo{g1, g2}, fmt.Sprintf("reason-%d-%d", id, j))
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
		t.Fatal("timeout")
	}

	stats := det.GetStatistics()
	assert.Equal(t, 1000, stats["total"])
}
