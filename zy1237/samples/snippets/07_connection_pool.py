import asyncio


async def aiohttp_without_limit():
    """aiohttp 没有设置连接限制"""
    import aiohttp
    
    # 问题：没有设置连接限制
    connector = aiohttp.TCPConnector()
    session = aiohttp.ClientSession(connector=connector)
    
    return session


async def aiohttp_with_limit():
    """aiohttp 设置了连接限制（正确示例）"""
    import aiohttp
    
    # 正确：设置了连接限制
    connector = aiohttp.TCPConnector(limit=50)
    session = aiohttp.ClientSession(connector=connector)
    
    return session


async def database_pool_without_maxsize():
    """数据库连接池没有设置最大连接数"""
    # 假设的数据库连接池
    # 问题：没有设置 maxsize
    class FakeDBPool:
        def __init__(self):
            # 问题：没有限制连接数
            self.connections = []
    
    pool = FakeDBPool()
    return pool


async def many_concurrent_requests():
    """大量并发请求，可能耗尽连接"""
    import aiohttp
    
    # 问题：没有设置连接限制，并发 1000 个请求
    async with aiohttp.ClientSession() as session:
        tasks = []
        for i in range(1000):
            task = asyncio.create_task(
                session.get(f"https://example.com/api/{i}")
            )
            tasks.append(task)
        
        await asyncio.gather(*tasks, return_exceptions=True)


async def main():
    await aiohttp_without_limit()
    await database_pool_without_maxsize()


if __name__ == "__main__":
    asyncio.run(main())
