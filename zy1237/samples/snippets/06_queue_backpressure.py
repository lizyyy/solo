import asyncio


async def producer_fast(queue: asyncio.Queue, count: int = 100):
    """快速的生产者"""
    for i in range(count):
        # 问题：使用 put_nowait，队列满时会抛出异常
        queue.put_nowait(f"item-{i}")
        await asyncio.sleep(0.01)


async def producer_unbounded():
    """无界队列的生产者"""
    # 问题：Queue 没有设置 maxsize，是无界队列
    queue = asyncio.Queue()
    
    # 问题：快速生产，但队列无界
    for i in range(1000):
        await queue.put(f"item-{i}")
    
    return queue


async def producer_with_maxsize_zero():
    """maxsize=0 的队列（无界）"""
    # 问题：maxsize=0 表示无界队列
    queue = asyncio.Queue(maxsize=0)
    
    for i in range(1000):
        await queue.put(f"item-{i}")
    
    return queue


async def consumer_slow(queue: asyncio.Queue):
    """慢速的消费者"""
    while True:
        item = await queue.get()
        await asyncio.sleep(0.1)  # 处理很慢
        queue.task_done()


async def main():
    # 问题 1：无界队列
    queue1 = asyncio.Queue()
    
    # 问题 2：使用 put_nowait
    queue2 = asyncio.Queue(maxsize=10)
    try:
        for i in range(20):
            queue2.put_nowait(f"item-{i}")
    except asyncio.QueueFull:
        pass
    
    # 问题 3：maxsize=0 是无界的
    queue3 = asyncio.Queue(maxsize=0)


async def proper_queue_usage():
    """正确使用队列的示例"""
    # 设置合理的 maxsize
    queue = asyncio.Queue(maxsize=100)
    
    # 使用 await queue.put() 而不是 put_nowait
    await queue.put("item")
    
    # 使用 await queue.get()
    item = await queue.get()
    queue.task_done()


if __name__ == "__main__":
    asyncio.run(main())
