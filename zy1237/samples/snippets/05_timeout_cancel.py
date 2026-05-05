import asyncio


async def long_running_task():
    """长时间运行的任务"""
    await asyncio.sleep(10)
    return "done"


async def task_without_timeout_handling():
    """超时操作没有异常处理"""
    # 问题：使用 wait_for 但没有处理 TimeoutError
    result = await asyncio.wait_for(long_running_task(), timeout=1.0)
    return result


async def task_silencing_cancelled_error():
    """静默捕获 CancelledError"""
    try:
        await long_running_task()
    except asyncio.CancelledError:
        # 问题：捕获了 CancelledError 但没有重新抛出
        print("Task was cancelled, but not re-raising")
        # 这会破坏取消传播


async def task_with_proper_cancel_handling():
    """正确处理取消的示例"""
    try:
        await long_running_task()
    except asyncio.CancelledError:
        print("Task was cancelled, cleaning up...")
        # 清理工作
        raise  # 重新抛出，让调用者知道任务被取消了


async def timeout_without_exception_handling():
    """使用 timeout 上下文管理器但没有异常处理"""
    # 问题：使用 timeout 但没有处理 TimeoutError
    async with asyncio.timeout(1.0):
        await long_running_task()


async def main():
    try:
        await task_without_timeout_handling()
    except asyncio.TimeoutError:
        pass
    
    try:
        await timeout_without_exception_handling()
    except asyncio.TimeoutError:
        pass


if __name__ == "__main__":
    asyncio.run(main())
