package main

import (
	"sync"
	"time"
)

// BadExample4: Cond 唤醒遗漏
// goroutine 等待条件但没有被唤醒
type BadExample4 struct {
	mu    sync.Mutex
	cond  *sync.Cond
	ready bool
	data  string
}

func NewBadExample4() *BadExample4 {
	b := &BadExample4{}
	b.cond = sync.NewCond(&b.mu)
	return b
}

func (b *BadExample4) WaitForData() string {
	// 问题：没有使用循环检查条件
	// 可能会有虚假唤醒，或者条件永远不满足
	b.mu.Lock()
	if !b.ready { // 错误：应该用 for 而不是 if
		b.cond.Wait()
	}
	data := b.data
	b.mu.Unlock()
	return data
}

func (b *BadExample4) SetData(data string) {
	b.mu.Lock()
	b.data = data
	b.ready = true
	// 问题：忘记调用 Signal 或 Broadcast
	// 等待的 goroutine 永远不会被唤醒
	// b.cond.Signal() // 忘记这行！
	b.mu.Unlock()
}

func (b *BadExample4) WaitForDataCorrect() string {
	// 正确做法：使用 for 循环检查条件
	b.mu.Lock()
	for !b.ready { // 正确：使用 for 循环
		b.cond.Wait()
	}
	data := b.data
	b.mu.Unlock()
	return data
}

func (b *BadExample4) SetDataCorrect(data string) {
	b.mu.Lock()
	b.data = data
	b.ready = true
	b.cond.Broadcast() // 正确：唤醒所有等待者
	b.mu.Unlock()
}

// 另一个问题：Signal vs Broadcast 的选择
func (b *BadExample4) SignalWhenBroadcastNeeded() {
	b.mu.Lock()
	b.data = "updated"
	b.ready = true
	// 问题：有多个 goroutine 在等待，但只调用了 Signal
	// 只有一个 goroutine 会被唤醒，其他的永远等待
	b.cond.Signal() // 应该用 Broadcast
	b.mu.Unlock()
}

// 使用示例展示问题
func DemonstrateCondIssue() {
	b := NewBadExample4()

	// 启动多个等待者
	for i := 0; i < 3; i++ {
		go func(id int) {
			data := b.WaitForData()
			println("Goroutine", id, "got data:", data)
		}(i)
	}

	// 等待一下让 goroutine 开始等待
	time.Sleep(100 * time.Millisecond)

	// 设置数据但忘记唤醒
	b.SetData("hello world")

	// 结果：所有 goroutine 永远等待
	time.Sleep(1 * time.Second)
}
