package main

import (
	"sync"
)

// BadExample1: 锁顺序反转 - 不同 goroutine 以不同顺序获取锁
// 这可能导致死锁
type BadExample1 struct {
	muA sync.Mutex
	muB sync.Mutex
	dataA int
	dataB int
}

func (b *BadExample1) updateFromGoroutine1() {
	// Goroutine 1: 先获取 muA，再获取 muB
	b.muA.Lock()
	defer b.muA.Unlock()

	b.dataA++

	b.muB.Lock()
	defer b.muB.Unlock()

	b.dataB++
}

func (b *BadExample1) updateFromGoroutine2() {
	// Goroutine 2: 先获取 muB，再获取 muA（顺序相反！）
	// 这会导致锁顺序反转，可能发生死锁
	b.muB.Lock()
	defer b.muB.Unlock()

	b.dataB++

	b.muA.Lock()
	defer b.muA.Unlock()

	b.dataA++
}

// 问题分析：
// 如果 Goroutine 1 获得了 muA，Goroutine 2 获得了 muB，
// 那么它们会互相等待对方释放锁，导致死锁。
//
// 正确做法：
// 所有 goroutine 应该按照相同的顺序获取锁，例如：
// 总是先获取 muA，再获取 muB。
