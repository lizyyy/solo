import asyncio


async def fetch_data():
    await asyncio.sleep(0.1)
    return {"data": "value"}


def sync_function_with_await():
    """同步函数中使用 await - 语法错误"""
    # 问题：同步函数不能使用 await
    result = await fetch_data()
    return result


async def async_function_missing_await():
    """异步函数中忘记 await"""
    # 问题：没有 await，调用协程但不执行
    fetch_data()
    
    # 问题：没有 await 协程函数调用
    task = asyncio.create_task(fetch_data())
    # 问题：没有 await task


async def another_async_function():
    await asyncio.sleep(0.1)
    return "done"


def sync_caller():
    """同步函数调用异步函数"""
    # 问题：同步函数调用异步函数但没有正确处理
    loop = asyncio.get_event_loop()
    # 这在某些情况下会导致问题
    result = loop.run_until_complete(another_async_function())
    return result


async def main():
    # 问题：调用同步函数，里面有问题
    try:
        sync_function_with_await()
    except SyntaxError:
        pass
    
    await async_function_missing_await()


if __name__ == "__main__":
    asyncio.run(main())
