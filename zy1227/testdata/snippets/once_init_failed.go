package main

import (
	"errors"
	"sync"
)

// BadExample6: Once 初始化失败缓存
// sync.Once 只执行一次函数，即使函数失败也不会重试
type BadExample6 struct {
	once   sync.Once
	client *DatabaseClient
	err    error
}

type DatabaseClient struct {
	connected bool
}

func (b *BadExample6) GetClient() (*DatabaseClient, error) {
	// 问题：如果 initClient 失败，Once 不会重试
	b.once.Do(b.initClient)
	return b.client, b.err
}

func (b *BadExample6) initClient() {
	// 模拟可能失败的初始化
	// 例如：网络连接、读取配置等
	client, err := connectToDatabase()
	if err != nil {
		// 问题：错误被缓存了
		// 下次调用 GetClient 时，Once 不会再执行 initClient
		// 会直接返回错误
		b.err = err
		return
	}
	b.client = client
}

// 模拟数据库连接可能失败
func connectToDatabase() (*DatabaseClient, error) {
	// 假设这里是实际的数据库连接
	// 可能因为网络问题失败
	return nil, errors.New("network timeout")
}

// 使用示例
func DemonstrateOnceIssue() {
	b := &BadExample6{}

	// 第一次调用：数据库连接失败
	client, err := b.GetClient()
	if err != nil {
		println("First attempt failed:", err.Error())
		// 等待网络恢复...
	}

	// 第二次调用：即使网络恢复了，也不会重试
	// 因为 Once 已经执行过一次了
	client, err = b.GetClient()
	if err != nil {
		println("Second attempt also failed:", err.Error()) // 仍然失败！
	}

	// 结果：client 永远是 nil，err 永远是 "network timeout"
	_ = client
}

// 正确做法示例

// CorrectInit 使用互斥锁实现可重试的初始化
type CorrectInit struct {
	mu     sync.Mutex
	client *DatabaseClient
	inited bool
}

func (c *CorrectInit) GetClient() (*DatabaseClient, error) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 如果已经初始化成功，直接返回
	if c.inited {
		return c.client, nil
	}

	// 尝试初始化
	client, err := connectToDatabase()
	if err != nil {
		return nil, err // 失败，不标记为已初始化
	}

	// 成功，标记为已初始化
	c.client = client
	c.inited = true
	return client, nil
}

// 另一种正确做法：使用 Once 但在初始化函数内部处理重试
type CorrectInitWithRetry struct {
	once   sync.Once
	client *DatabaseClient
}

func (c *CorrectInitWithRetry) GetClient() (*DatabaseClient, error) {
	var err error
	c.once.Do(func() {
		// 在 Once 内部实现重试逻辑
		c.client, err = c.connectWithRetry()
	})
	return c.client, err
}

func (c *CorrectInitWithRetry) connectWithRetry() (*DatabaseClient, error) {
	// 实现重试逻辑
	for i := 0; i < 3; i++ {
		client, err := connectToDatabase()
		if err == nil {
			return client, nil
		}
		// 等待后重试
		// time.Sleep(time.Second)
	}
	return nil, errors.New("failed to connect after retries")
}

// Once 使用的最佳实践：
// 1. 只用于不需要重试的初始化
// 2. 如果初始化可能失败且需要重试，不要使用 Once
// 3. 或者在 Once 的函数内部实现重试逻辑
// 4. 不要在 Once 的函数中返回错误，因为它会被"缓存"
