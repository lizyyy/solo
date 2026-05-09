package benchmark

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/deadlock-detector/internal/detector"
	"github.com/deadlock-detector/internal/logger"
	"github.com/deadlock-detector/internal/model"
	"github.com/deadlock-detector/internal/monitor"
	"github.com/deadlock-detector/internal/recovery"
	"github.com/deadlock-detector/internal/replay"
)

func BenchmarkChannelSendRecv(b *testing.B) {
	ch := make(chan int, 100)

	b.Run("unbuffered", func(b *testing.B) {
		chUnbuf := make(chan int)
		var wg sync.WaitGroup
		wg.Add(1)

		go func() {
			defer wg.Done()
			for i := 0; i < b.N; i++ {
				<-chUnbuf
			}
		}()

		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			chUnbuf <- i
		}
		wg.Wait()
	})

	b.Run("buffered_100", func(b *testing.B) {
		b.ResetTimer()
		for i := 0; i < b.N; i++ {
			ch <- i
			<-ch
		}
	})
}

func BenchmarkConcurrentChannels(b *testing.B) {
	numGoroutines := []int{10, 100, 1000}

	for _, n := range numGoroutines {
		b.Run(fmt.Sprintf("goroutines_%d", n), func(b *testing.B) {
			ch := make(chan int, n*2)
			var wg sync.WaitGroup
			var counter int64

			wg.Add(n)
			for i := 0; i < n; i++ {
				go func(id int) {
					defer wg.Done()
					for j := 0; j < b.N/n; j++ {
						ch <- id*1000 + j
						<-ch
						atomic.AddInt64(&counter, 1)
					}
				}(i)
			}

			wg.Wait()
			close(ch)
		})
	}
}

func BenchmarkDeadlockDetection(b *testing.B) {
	tmpDir := b.TempDir()
	logMgr := logger.NewManager(tmpDir + "/bench.log")
	defer logMgr.Close()

	det := detector.NewDetector(logMgr)

	b.Run("record_potential", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			g1 := model.NewGoroutineInfo(fmt.Sprintf("g-%d-1", i), "producer")
			g2 := model.NewGoroutineInfo(fmt.Sprintf("g-%d-2", i), "consumer")
			det.RecordPotentialDeadlock([]*model.GoroutineInfo{g1, g2}, "test")
		}
	})

	b.Run("check_potential", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			det.HasPotentialDeadlock()
		}
	})
}

func BenchmarkIdempotentCheck(b *testing.B) {
	tmpDir := b.TempDir()
	logMgr := logger.NewManager(tmpDir + "/bench.log")
	defer logMgr.Close()

	recMgr := recovery.NewManager(logMgr)

	b.Run("mark_processed", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			recMgr.MarkProcessed(fmt.Sprintf("msg-%d", i))
		}
	})

	b.Run("check_processed", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			recMgr.IsProcessed(fmt.Sprintf("msg-%d", i))
		}
	})
}

func BenchmarkLogging(b *testing.B) {
	tmpDir := b.TempDir()
	logMgr := logger.NewManager(tmpDir + "/bench.log")
	defer logMgr.Close()

	b.Run("info_log", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			logMgr.Info("bench", fmt.Sprintf("message %d", i), nil)
		}
	})

	b.Run("error_log_with_data", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			logMgr.Error("bench", "error message", map[string]interface{}{
				"error_code": i,
				"details":    "test error",
			})
		}
	})
}

func BenchmarkReplayEventCapture(b *testing.B) {
	tmpDir := b.TempDir()
	logMgr := logger.NewManager(tmpDir + "/bench.log")
	defer logMgr.Close()

	replayMgr := replay.NewManager(logMgr)

	b.Run("record_event", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			replayMgr.RecordEvent(
				"send",
				fmt.Sprintf("ch-%d", i%100),
				fmt.Sprintf("g-%d", i%50),
				map[string]interface{}{"value": i},
			)
		}
	})
}

func TestStressTestHighConcurrency(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping stress test in short mode")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	numGoroutines := 100
	messagesPerGoroutine := 1000

	ch := make(chan int, numGoroutines*10)
	var wg sync.WaitGroup
	var sentCount, recvCount int64

	wg.Add(numGoroutines)
	for i := 0; i < numGoroutines; i++ {
		go func(id int) {
			defer wg.Done()
			for j := 0; j < messagesPerGoroutine; j++ {
				select {
				case <-ctx.Done():
					return
				case ch <- id*10000 + j:
					atomic.AddInt64(&sentCount, 1)
				}
			}
		}(i)
	}

	wg.Add(1)
	go func() {
		defer wg.Done()
		for {
			select {
			case <-ctx.Done():
				return
			case _, ok := <-ch:
				if !ok {
					return
				}
				atomic.AddInt64(&recvCount, 1)
			}
		}
	}()

	select {
	case <-ctx.Done():
	case <-time.After(25 * time.Second):
		cancel()
	}

	wg.Wait()
	close(ch)

	t.Logf("Sent: %d, Received: %d", atomic.LoadInt64(&sentCount), atomic.LoadInt64(&recvCount))
}

func TestMonitorWithRealConcurrency(t *testing.T) {
	tmpDir := t.TempDir()
	logMgr := logger.NewManager(tmpDir + "/monitor.log")
	defer logMgr.Close()

	det := detector.NewDetector(logMgr)
	m := monitor.NewMonitor(logMgr, det)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go m.Start(ctx)

	ch := m.RegisterChannel("stress-ch", 100, model.ChannelTypeBidirectional)
	defer m.UnregisterChannel(ch.ID())

	numGoroutines := 50
	iterations := 200

	var wg sync.WaitGroup
	var successCount int64

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			g := model.NewGoroutineInfo(fmt.Sprintf("worker-%d", id), "worker")
			m.RegisterGoroutine(g)
			defer m.UnregisterGoroutine(g.ID)

			for j := 0; j < iterations; j++ {
				select {
				case ch.Inner() <- id*1000 + j:
					g.UpdateState(model.GoroutineStateRunning)
					atomic.AddInt64(&successCount, 1)
				case <-ctx.Done():
					return
				}

				select {
				case <-ch.Inner():
					g.UpdateState(model.GoroutineStateRunning)
				case <-ctx.Done():
					return
				}
			}
		}(i)
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(30 * time.Second):
		cancel()
		t.Fatal("test timeout")
	}

	expected := int64(numGoroutines * iterations)
	if atomic.LoadInt64(&successCount) != expected {
		t.Errorf("Expected %d successful sends, got %d", expected, atomic.LoadInt64(&successCount))
	}
}
