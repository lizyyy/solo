package main

import (
	"fmt"
	"sync"
)

// BadExample2: WaitGroup 计数错误
type BadExample2 struct {
	wg sync.WaitGroup
}

func (b *BadExample2) wrongUsage1() {
	// 错误：在 goroutine 内部调用 Add
	// 这会导致 main goroutine 可能在 Add 之前就调用了 Wait
	go func() {
		b.wg.Add(1) // 错误：应该在 go 之前调用
		defer b.wg.Done()
		// 做一些工作
		fmt.Println("Working...")
	}()

	b.wg.Wait() // 可能在 Add 之前执行，直接返回
}

func (b *BadExample2) wrongUsage2() {
	// 错误：Done 调用次数超过 Add
	b.wg.Add(1)

	go func() {
		defer b.wg.Done()
		// 做一些工作
		fmt.Println("Working...")

		// 错误：不小心多调用了一次 Done
		// 这会导致 panic: sync: negative WaitGroup counter
		b.wg.Done()
	}()

	b.wg.Wait()
}

func (b *BadExample2) wrongUsage3() {
	// 错误：Wait 但没有 Add
	// 这会导致 Wait 立即返回，不会等待任何 goroutine
	go func() {
		// 忘记调用 Add
		defer b.wg.Done() // 这会导致 panic，因为 counter 变成负数
		fmt.Println("Working...")
	}()

	b.wg.Wait()
}

// 正确做法：
// func (b *BadExample2) correctUsage() {
// 	b.wg.Add(1) // 在 go 之前调用 Add
// 	go func() {
// 		defer b.wg.Done()
// 		fmt.Println("Working...")
// 	}()
// 	b.wg.Wait()
// }
