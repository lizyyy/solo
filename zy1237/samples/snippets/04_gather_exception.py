import asyncio


async def task_may_fail(task_id: int, should_fail: bool = False):
    """可能失败的任务"""
    await asyncio.sleep(0.1)
    if should_fail:
        raise ValueError(f"Task {task_id} failed!")
    return f"Task {task_id} succeeded"


async def gather_without_return_exceptions():
    """gather 没有设置 return_exceptions"""
    # 问题：没有设置 return_exceptions，一个任务失败会取消其他任务
    results = await asyncio.gather(
        task_may_fail(1),
        task_may_fail(2, should_fail=True),
        task_may_fail(3),
    )
    return results


async def gather_without_exception_handling():
    """gather 没有异常处理"""
    # 问题：gather 可能抛出异常，但没有 try/except
    results = await asyncio.gather(
        task_may_fail(1, should_fail=True),
        task_may_fail(2),
        return_exceptions=True,
    )
    return results


async def gather_with_proper_handling():
    """正确处理 gather 异常的示例"""
    try:
        results = await asyncio.gather(
            task_may_fail(1),
            task_may_fail(2, should_fail=True),
            task_may_fail(3),
            return_exceptions=True,
        )
        
        # 检查结果中的异常
        for i, result in enumerate(results):
            if isinstance(result, Exception):
                print(f"Task {i+1} failed: {result}")
            else:
                print(f"Task {i+1} succeeded: {result}")
                
    except Exception as e:
        print(f"Unexpected error: {e}")


async def main():
    await gather_without_return_exceptions()
    await gather_without_exception_handling()


if __name__ == "__main__":
    asyncio.run(main())
