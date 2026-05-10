package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"runtime"
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

	scenariosDone := make(chan struct{})
	wg.Add(1)
	go func() {
		defer wg.Done()
		runDemoScenarios(ctx, monitor, detector, recoveryMgr, replayMgr)
		close(scenariosDone)
	}()

	select {
	case <-scenariosDone:
		fmt.Println("\n所有演示场景已完成")
	case <-sigChan:
		fmt.Println("\n收到关闭信号，正在优雅关闭...")
	}

	cancel()
	wg.Wait()

	fmt.Println("\n系统已安全关闭")

	generateReport(logMgr, detector, replayMgr)
}

func runDemoScenarios(ctx context.Context, m *monitor.Monitor, d *detector.Detector, r *recovery.Manager, replayMgr *replay.Manager) {
	time.Sleep(500 * time.Millisecond)

	fmt.Println("\n=== 场景1: 正常的生产者-消费者模式 ===")
	scenarioNormal(ctx, m, replayMgr)

	time.Sleep(1 * time.Second)

	fmt.Println("\n=== 场景2: 模拟死锁（会被检测并恢复） ===")
	scenarioDeadlock(ctx, m, d, r, replayMgr)

	time.Sleep(2 * time.Second)

	fmt.Println("\n=== 场景3: 幂等性测试 ===")
	scenarioIdempotent(ctx, m, r, replayMgr)

	time.Sleep(1 * time.Second)

	fmt.Println("\n=== 场景4: 缓存一致性测试 ===")
	scenarioCacheConsistency(ctx, m, replayMgr)

	fmt.Println("\n=== 所有演示场景完成 ===")
}

func scenarioNormal(ctx context.Context, m *monitor.Monitor, replayMgr *replay.Manager) {
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
				replayMgr.RecordEvent("send", ch.ID(), "producer", map[string]interface{}{"msg": fmt.Sprintf("msg-%d", i)})
				log.Printf("生产者发送: msg-%d", i)
				time.Sleep(300 * time.Millisecond)
			}
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 3; i++ {
			select {
			case <-ctx.Done():
				return
			case msg := <-ch.Inner():
				replayMgr.RecordEvent("recv", ch.ID(), "consumer", map[string]interface{}{"msg": msg})
				log.Printf("消费者接收: %v", msg)
			}
		}
	}()

	wg.Wait()
}

func scenarioDeadlock(ctx context.Context, m *monitor.Monitor, d *detector.Detector, r *recovery.Manager, replayMgr *replay.Manager) {
	ch1 := m.RegisterChannel("deadlock-ch1", 0, model.ChannelTypeBidirectional)
	ch2 := m.RegisterChannel("deadlock-ch2", 0, model.ChannelTypeBidirectional)
	defer m.UnregisterChannel(ch1.ID())
	defer m.UnregisterChannel(ch2.ID())

	goroutineA := model.NewGoroutineInfo("deadlock-goroutine-A", "producer")
	goroutineB := model.NewGoroutineInfo("deadlock-goroutine-B", "consumer")

	m.RegisterGoroutine(goroutineA)
	m.RegisterGoroutine(goroutineB)
	defer m.UnregisterGoroutine(goroutineA.ID)
	defer m.UnregisterGoroutine(goroutineB.ID)

	log.Println("演示死锁检测场景：Goroutine A 等待 ch1 接收，Goroutine B 等待 ch2 接收")
	log.Println("两个 Goroutine 都会因超时而触发死锁检测...")

	var wg sync.WaitGroup

	wg.Add(1)
	go func() {
		defer wg.Done()
		goroutineA.UpdateState(model.GoroutineStateRunning)
		replayMgr.RecordEvent("start", ch1.ID(), goroutineA.ID, nil)

		select {
		case msg := <-ch1.Inner():
			log.Printf("Goroutine A 接收到: %v", msg)
		case <-time.After(2 * time.Second):
			log.Println("Goroutine A 等待 ch1 超时，标记为阻塞状态")
			goroutineA.UpdateState(model.GoroutineStateBlocked)
			goroutineA.AddWaitChannel(ch1.ID())
			replayMgr.RecordEvent("blocked", ch1.ID(), goroutineA.ID, map[string]interface{}{"wait_for": "ch1"})
		}
	}()

	wg.Add(1)
	go func() {
		defer wg.Done()
		goroutineB.UpdateState(model.GoroutineStateRunning)
		replayMgr.RecordEvent("start", ch2.ID(), goroutineB.ID, nil)

		select {
		case msg := <-ch2.Inner():
			log.Printf("Goroutine B 接收到: %v", msg)
		case <-time.After(2 * time.Second):
			log.Println("Goroutine B 等待 ch2 超时，标记为阻塞状态")
			goroutineB.UpdateState(model.GoroutineStateBlocked)
			goroutineB.AddWaitChannel(ch2.ID())
			replayMgr.RecordEvent("blocked", ch2.ID(), goroutineB.ID, map[string]interface{}{"wait_for": "ch2"})
		}
	}()

	wg.Wait()

	log.Println("检测到多个 Goroutine 处于阻塞状态，触发死锁检测...")
	d.RecordPotentialDeadlock(
		[]*model.GoroutineInfo{goroutineA, goroutineB},
		"Goroutine A 等待 ch1，Goroutine B 等待 ch2，形成潜在死锁",
	)
	replayMgr.RecordEvent("deadlock_recorded", "", "", map[string]interface{}{
		"blocked_goroutines": 2,
		"reason":             "multiple goroutines blocked",
	})

	time.Sleep(500 * time.Millisecond)

	if d.HasPotentialDeadlock() {
		log.Println("✓ 检测到潜在死锁！")
		deadlockInfo := d.GetLastDeadlockInfo()
		log.Printf("  - 死锁ID: %s", deadlockInfo.ID)
		log.Printf("  - 原因: %s", deadlockInfo.Reason)
		log.Printf("  - 涉及 Goroutine 数: %d", len(deadlockInfo.Goroutines))

		log.Println("启动异常恢复机制...")
		r.HandleDeadlock(deadlockInfo)

		log.Println("标记死锁为已解决（恢复策略: timeout_release）...")
		d.ResolveDeadlock(deadlockInfo.ID, "timeout_release")
		replayMgr.RecordEvent("deadlock_resolved", "", "", map[string]interface{}{
			"deadlock_id": deadlockInfo.ID,
			"resolution":  "timeout_release",
		})

		analysis := d.AnalyzeWaitGraph(deadlockInfo)
		log.Printf("等待图分析: is_circular=%v", analysis["is_circular"])
	}

	stats := d.GetStatistics()
	log.Printf("死锁检测统计: total=%d, resolved=%d, unresolved=%d",
		stats["total"], stats["resolved"], stats["unresolved"])

	log.Println("死锁场景演示完成")
}

func scenarioIdempotent(ctx context.Context, m *monitor.Monitor, r *recovery.Manager, replayMgr *replay.Manager) {
	ch := m.RegisterChannel("idempotent-ch", 3, model.ChannelTypeBidirectional)
	defer m.UnregisterChannel(ch.ID())

	msgID := "msg-001"
	payload := "重要数据"

	processor := func(msg *model.Message) error {
		if r.IsProcessed(msgID) {
			log.Printf("[幂等] 消息 %s 已处理过，跳过", msgID)
			replayMgr.RecordEvent("idempotent_skip", ch.ID(), "processor", map[string]interface{}{"msg_id": msgID})
			return nil
		}

		log.Printf("[幂等] 首次处理消息 %s: %s", msgID, payload)
		replayMgr.RecordEvent("idempotent_process", ch.ID(), "processor", map[string]interface{}{"msg_id": msgID})
		time.Sleep(100 * time.Millisecond)

		r.MarkProcessed(msgID)
		return nil
	}

	for i := 0; i < 3; i++ {
		msg := model.NewMessage(msgID, payload, "test-producer")
		msg.Attempt = i + 1
		ch.Inner() <- msg
		replayMgr.RecordEvent("send", ch.ID(), "producer", map[string]interface{}{"msg_id": msgID, "attempt": i + 1})
	}

	for i := 0; i < 3; i++ {
		select {
		case <-ctx.Done():
			return
		case msgRaw := <-ch.Inner():
			if m, ok := msgRaw.(*model.Message); ok {
				processor(m)
			}
		case <-time.After(1 * time.Second):
			log.Println("[幂等] 等待消息超时")
			return
		}
	}
}

func scenarioCacheConsistency(ctx context.Context, m *monitor.Monitor, replayMgr *replay.Manager) {
	cache := make(map[string]string)
	var mu sync.RWMutex

	updateCache := func(key, value string) {
		mu.Lock()
		defer mu.Unlock()
		cache[key] = value
		replayMgr.RecordEvent("cache_update", "", "cache", map[string]interface{}{"key": key, "value": value})
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

	for i := 0; i < 5; i++ {
		select {
		case <-ctx.Done():
			return
		case <-ch.Inner():
		case <-time.After(500 * time.Millisecond):
			return
		}
	}
}

func generateReport(l *logger.Manager, d *detector.Detector, r *replay.Manager) {
	fmt.Println("\n=== 生成系统报告 ===")

	report := &model.Report{
		GeneratedAt: time.Now(),
		SystemInfo: model.SystemInfo{
			GoVersion:    runtime.Version(),
			Platform:     runtime.GOOS + "/" + runtime.GOARCH,
			NumCPU:       runtime.NumCPU(),
			NumGoroutine: runtime.NumGoroutine(),
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
