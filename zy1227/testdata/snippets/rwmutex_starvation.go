package main

import (
	"sync"
	"time"
)

// BadExample3: 读写锁饥饿
// 当有大量读操作时，写操作可能会饿死
type BadExample3 struct {
	rwmu   sync.RWMutex
	config map[string]string
}

func (b *BadExample3) ReadConfig(key string) string {
	// 读操作 - 可以并发执行
	b.rwmu.RLock()
	defer b.rwmu.RUnlock()

	// 模拟一些耗时的读取操作
	time.Sleep(100 * time.Millisecond)
	return b.config[key]
}

func (b *BadExample3) UpdateConfig(key, value string) {
	// 写操作 - 需要独占锁
	// 问题：如果有持续的读操作，写操作可能永远等待
	b.rwmu.Lock()
	defer b.rwmu.Unlock()

	b.config[key] = value
}

// 问题场景：
// 1. Goroutine 1 调用 ReadConfig，获取读锁
// 2. Goroutine 2 调用 ReadConfig，获取读锁（可以并发）
// 3. Goroutine 3 调用 UpdateConfig，等待写锁
// 4. Goroutine 4 调用 ReadConfig，获取读锁（因为已有读锁，写锁在等待）
// 5. Goroutine 5 调用 ReadConfig，继续获取读锁
// ...
// 结果：写锁永远等不到，写操作饿死

// 注意：Go 1.19+ 对 RWMutex 进行了改进，减少了写饥饿的可能性
// 但在高并发读多写少的场景下，仍可能出现问题

// 替代方案考虑：
// 1. 如果写操作很重要，考虑使用普通的 sync.Mutex
// 2. 使用 copy-on-write 模式，读操作不加锁，写操作复制数据
// 3. 使用 channel 进行同步
