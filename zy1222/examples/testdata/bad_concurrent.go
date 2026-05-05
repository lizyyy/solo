package main

import (
	"fmt"
	"sync"
	"time"
)

var m = make(map[string]int)

// 错误示例: 并发写入 map 会导致 panic
func BadConcurrentWrite() {
	var wg sync.WaitGroup
	
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			key := fmt.Sprintf("key_%d", n)
			// 危险！并发写入 map
			m[key] = n
		}(i)
	}
	
	wg.Wait()
}

// 错误示例: 并发读写
func BadConcurrentReadWrite() {
	var wg sync.WaitGroup
	
	// 写入 goroutine
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 1000; i++ {
			m[fmt.Sprintf("write_%d", i)] = i
		}
	}()
	
	// 读取 goroutine
	wg.Add(1)
	go func() {
		defer wg.Done()
		for i := 0; i < 1000; i++ {
			// 危险！并发读取可能看到不一致状态
			_ = m[fmt.Sprintf("key_%d", i)]
		}
	}()
	
	wg.Wait()
}

// 正确示例: 使用 sync.Map
func GoodSyncMap() {
	var sm sync.Map
	var wg sync.WaitGroup
	
	for i := 0; i < 10; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			key := fmt.Sprintf("key_%d", n)
			sm.Store(key, n)
		}(i)
	}
	
	wg.Wait()
	
	sm.Range(func(key, value interface{}) bool {
		fmt.Printf("%s: %v\n", key, value)
		return true
	})
}

// 正确示例: 使用 mutex 保护
func GoodMutexProtected() {
	var mu sync.RWMutex
	localMap := make(map[string]int)
	var wg sync.WaitGroup
	
	// 写入 (需要写锁)
	for i := 0; i < 5; i++ {
		wg.Add(1)
		go func(n int) {
			defer wg.Done()
			mu.Lock()
			defer mu.Unlock()
			localMap[fmt.Sprintf("key_%d", n)] = n
		}(i)
	}
	
	wg.Wait()
	
	// 读取 (可以用读锁)
	mu.RLock()
	for k, v := range localMap {
		fmt.Printf("%s: %d\n", k, v)
	}
	mu.RUnlock()
}

func main() {
	fmt.Println("测试正确的并发写法...")
	GoodSyncMap()
	fmt.Println("---")
	GoodMutexProtected()
	
	fmt.Println("\n⚠️  警告: BadConcurrentWrite 和 BadConcurrentReadWrite 会导致 panic!")
	fmt.Println("取消注释下面的代码来观察问题 (需要用 mapdebug 来分析)")
	
	// BadConcurrentWrite()  // 会 panic: concurrent map writes
	// BadConcurrentReadWrite() // 会 panic 或产生竞态条件
}
