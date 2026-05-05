import asyncio


async def background_task_1():
    """可能泄漏的后台任务"""
    await asyncio.sleep(10)
    return "task 1 done"


async def background_task_2():
    """另一个可能泄漏的后台任务"""
    await asyncio.sleep(20)
    return "task 2 done"


async def main():
    # 问题 1：create_task 的返回值没有被存储或 await
    asyncio.create_task(background_task_1())
    
    # 问题 2：任务被存储但从未被 await 或取消
    task2 = asyncio.create_task(background_task_2())
    
    # 问题 3：程序提前退出，后台任务被丢弃
    await asyncio.sleep(1)
    
    # task2 从未被 await 或取消


async def main_with_managed_tasks():
    """正确管理任务的示例"""
    task1 = asyncio.create_task(background_task_1())
    task2 = asyncio.create_task(background_task_2())
    
    try:
        await asyncio.gather(task1, task2)
    except Exception as e:
        # 确保取消所有任务
        for task in [task1, task2]:
            if not task.done():
                task.cancel()
        await asyncio.gather(task1, task2, return_exceptions=True)


if __name__ == "__main__":
    asyncio.run(main())
