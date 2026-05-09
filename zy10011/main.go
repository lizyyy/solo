package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"sync"
	"syscall"
	"time"

	"github.com/deadlock-detector/internal/detector"
	"github.com/deadlock-detector/internal/logger"
	"github.com/deadlock-detector/internal/model"
	"github.com/deadlock-detector/internal/monitor"
	"github.com/deadlock-detector/internal/recovery"
	"github.com/deadlock-detector/internal/replay"
)

func main() {
	fmt.Println("=== Go Channel 死锁诊断系统 ===")
	fmt.Println()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	logMgr := logger.NewManager("logs/deadlock.log")
	defer logMgr.Close()

	detector := detector.NewDetector(logMgr)
	monitor := monitor.NewMonitor(logMgr, detector)
	recoveryMgr := recovery.NewManager(logMgr)
	replayMgr := replay.NewManager(logMgr)

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		monitor.Start(ctx)
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		runDemoScenarios(ctx, monitor, detector, recoveryMgr)
	}()

	<-sigChan
	fmt.Println("\n收到关闭信号，正在优雅关闭...")
	cancel()

	wg.Wait()
	fmt.Println("系统已安全关闭")

	generateReport(logMgr, detector, replayMgr)
}

func runDemoScenarios(ctx context.Context, m *monitor.Monitor, d *detector.Detector, r *recovery.Manager) {
	time.Sleep(1 * time.Second)

	fmt.Println("\n=== 场景1: 正常的生产者-消费者模式 ===")
	scenarioNormal(ctx, m)

	time.Sleep(2 * time.Second)

	fmt.Println("\n=== 场景2: 模拟死锁（会被检测并恢复） ===")
	scenarioDeadlock(ctx, m, d, r)

	time.Sleep(3 * time.Second)

	fmt.Println("\n=== 场景3: 幂等性测试 ===")
	scenarioIdempotent(ctx, m, r)

	time.Sleep(2 * time.Second)

	fmt.Println("\n=== 场景4: 缓存一致性测试 ===")
	scenarioCacheConsistency(ctx, m)

	fmt.Println("\n=== 所有演示场景完成 ===")
}

func scenarioNormal(ctx context.Context, m *monitor.Monitor) {
	ch := m.RegisterChannel("normal-prod-cons", 5, model.ChannelTypeBidirectional)
	defer m.UnregisterChannel(ch.ID())

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 3; i++ {
			select {
			case <-ctx.Done():
				return
			case ch.Inner() <- fmt.Sprintf("msg-%d", i):
				log.Printf("生产者发送: msg-%d", i)
				time.Sleep(500 * time.Millisecond)
			}
		}
		close(ch.Inner())
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		for msg := range ch.Inner() {
			log.Printf("消费者接收: %v", msg)
		}
	}()

	wg.Wait()
}

func scenarioDeadlock(ctx context.Context, m *monitor.Monitor, d *detector.Detector, r *recovery.Manager) {
	ch1 := m.RegisterChannel("deadlock-ch1", 1, model.ChannelTypeSendOnly)
	ch2 := m.RegisterChannel("deadlock-ch2", 1, model.ChannelTypeRecvOnly)
	defer m.UnregisterChannel(ch1.ID())
	defer m.UnregisterChannel(ch2.ID())

	goroutineA := model.NewGoroutineInfo("deadlock-goroutine-A", "producer")
	goroutineB := model.NewGoroutineInfo("deadlock-goroutine-B", "consumer")

	m.RegisterGoroutine(goroutineA)
	m.RegisterGoroutine(goroutineB)
	defer m.UnregisterGoroutine(goroutineA.ID)
	defer m.UnregisterGoroutine(goroutineB.ID)

	var wg sync.WaitGroup
	deadlockCtx, deadlockCancel := context.WithTimeout(ctx, 10*time.Second)
	defer deadlockCancel()

	done := make(chan struct{})

	wg.Add(1)
	go func() {
		defer wg.Done()
		goroutineA.UpdateState(model.GoroutineStateRunning)
		select {
		case ch1.Inner() <- "data-A":
			log.Println("Goroutine A 发送成功")
		case <-deadlockCtx.Done():
			log.Println("Goroutine A 超时，可能发生死锁")
			goroutineA.UpdateState(model.GoroutineStateBlocked)
			d.RecordPotentialDeadlock([]*model.GoroutineInfo{goroutineA, goroutineB}, "ch1 发送阻塞")
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		goroutineB.UpdateState(model.GoroutineStateRunning)
		time.Sleep(2 * time.Second)

		if d.HasPotentialDeadlock() {
			log.Println("检测到潜在死锁，启动恢复机制...")
			r.HandleDeadlock(d.GetLastDeadlockInfo())

			select {
			case msg := <-ch2.Inner():
				log.Printf("Goroutine B 接收到: %v", msg)
			case <-deadlockCtx.Done():
				log.Println("Goroutine B 超时退出")
			}
			close(done)
			return
		}

		select {
		case msg := <-ch1.Inner():
			log.Printf("Goroutine B 接收到: %v", msg)
			ch2.Inner() <- "response-B"
		case <-deadlockCtx.Done():
			log.Println("Goroutine B 超时退出")
		}
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(12 * time.Second):
		log.Println("死锁场景演示完成")
	}

	deadlockCancel()
	wg.Wait()
}

func scenarioIdempotent(ctx context.Context, m *monitor.Monitor, r *recovery.Manager) {
	ch := m.RegisterChannel("idempotent-ch", 3, model.ChannelTypeBidirectional)
	defer m.UnregisterChannel(ch.ID())

	msgID := "msg-001"
	payload := "重要数据"

	processor := func(msg *model.Message) error {
		if r.IsProcessed(msgID) {
			log.Printf("[幂等] 消息 %s 已处理过，跳过", msgID)
			return nil
		}

		log.Printf("[幂等] 首次处理消息 %s: %s", msgID, payload)
		time.Sleep(100 * time.Millisecond)

		r.MarkProcessed(msgID)
		return nil
	}

	for i := 0; i < 3; i++ {
		msg := model.NewMessage(msgID, payload, "test-producer")
		ch.Inner() <- msg
	}

	close(ch.Inner())

	for msg := range ch.Inner() {
		if m, ok := msg.(*model.Message); ok {
			processor(m)
		}
	}
}

func scenarioCacheConsistency(ctx context.Context, m *monitor.Monitor) {
	cache := make(map[string]string)
	var mu sync.RWMutex

	updateCache := func(key, value string) {
		mu.Lock()
		defer mu.Unlock()
		cache[key] = value
		log.Printf("[缓存] 更新: %s = %s", key, value)
	}

	readCache := func(key string) string {
		mu.RLock()
		defer mu.RUnlock()
		return cache[key]
	}

	ch := m.RegisterChannel("cache-ch", 10, model.ChannelTypeBidirectional)
	defer m.UnregisterChannel(ch.ID())

	var wg sync.WaitGroup

	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()
			key := fmt.Sprintf("key-%d", id%3)
			value := fmt.Sprintf("value-%d", id)

			updateCache(key, value)
			ch.Inner() <- fmt.Sprintf("updated-%s", key)

			time.Sleep(50 * time.Millisecond)
			current := readCache(key)
			log.Printf("[缓存] Goroutine %d 读取 %s = %s", id, key, current)
		}(i)
	}

	wg.Wait()
	close(ch.Inner())
}

func generateReport(l *logger.Manager, d *detector.Detector, r *replay.Manager) {
	fmt.Println("\n=== 生成系统报告 ===")

	report := &model.Report{
		GeneratedAt: time.Now(),
		SystemInfo: model.SystemInfo{
			GoVersion: "1.21",
			Platform:  "darwin/amd64",
		},
		DeadlockDetections: d.GetAllDeadlocks(),
		LogSummary:         l.GetSummary(),
		ReplayCapable:      r.CanReplay(),
	}

	reportPath := "reports/deadlock-report.md"
	if err := r.GenerateMarkdownReport(report, reportPath); err != nil {
		log.Printf("生成报告失败: %v", err)
		return
	}

	fmt.Printf("报告已生成: %s\n", reportPath)
}
