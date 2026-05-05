package main

import (
	"sync"
)

// BadExample5: Pool 误用
type BadExample5 struct {
	// 问题1：使用 Pool 存储重要数据
	// Pool 中的对象可能被 GC 回收，不应该存储重要数据
	importantData *sync.Pool

	// 问题2：Pool 没有正确的 New 函数
	// Get 可能返回 nil
	bufferPool *sync.Pool
}

func NewBadExample5() *BadExample5 {
	return &BadExample5{
		// 错误：Pool 用于存储重要数据
		importantData: &sync.Pool{
			New: func() interface{} {
				return make(map[string]string)
			},
		},
		// 错误：没有 New 函数
		bufferPool: &sync.Pool{}, // Get 可能返回 nil
	}
}

func (b *BadExample5) StoreImportantData(key, value string) {
	// 问题：将重要数据存储在 Pool 中
	// GC 可能在任何时候回收 Pool 中的对象
	data := b.importantData.Get().(map[string]string)
	data[key] = value
	b.importantData.Put(data) // 错误：这些数据可能被回收！
}

func (b *BadExample5) GetImportantData(key string) string {
	data := b.importantData.Get().(map[string]string)
	// 问题：数据可能已经被 GC 回收
	// 或者这是一个新的空 map
	return data[key]
}

func (b *BadExample5) UseBuffer() {
	// 问题：没有检查 Get 返回的是否为 nil
	buf := b.bufferPool.Get() // 可能返回 nil！
	// 如果 buf 是 nil，下面的操作会 panic
	_ = buf.([]byte) // 可能 panic: interface conversion: interface {} is nil, not []byte
}

func (b *BadExample5) PutBufferWithoutReset(buf []byte) {
	// 问题：放回 Pool 之前没有重置对象
	// 下一个 Get 的调用者会得到带有旧数据的对象
	buf = append(buf, "sensitive data"...) // 添加了敏感数据
	b.bufferPool.Put(buf) // 错误：没有清空数据
}

// 正确做法示例

// CorrectBufferPool 正确使用 Pool 的示例
type CorrectBufferPool struct {
	pool *sync.Pool
}

func NewCorrectBufferPool() *CorrectBufferPool {
	return &CorrectBufferPool{
		pool: &sync.Pool{
			New: func() interface{} {
				// 总是返回非 nil 值
				return make([]byte, 0, 1024)
			},
		},
	}
}

func (c *CorrectBufferPool) GetBuffer() []byte {
	buf := c.pool.Get().([]byte)
	// 重置缓冲区（如果需要）
	return buf[:0] // 重置长度但保留容量
}

func (c *CorrectBufferPool) PutBuffer(buf []byte) {
	// 重置缓冲区后再放回 Pool
	// 这里我们将长度设为 0，容量保留
	// 注意：如果缓冲区包含敏感数据，应该清空它
	for i := range buf {
		buf[i] = 0 // 清空数据
	}
	c.pool.Put(buf[:0])
}

// Pool 使用的最佳实践：
// 1. 只用于临时对象，不用于存储重要数据
// 2. 总是提供 New 函数，确保 Get 不会返回 nil
// 3. 从 Pool 获取对象后，不要假设它的状态
// 4. 放回 Pool 之前，重置或清空对象
// 5. 不要存储指向 Pool 中对象的长期引用
