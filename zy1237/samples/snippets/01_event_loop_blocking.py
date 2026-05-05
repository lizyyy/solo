import asyncio
import time
import requests


def blocking_network_call():
    """同步网络调用 - 阻塞事件循环"""
    response = requests.get("https://example.com")
    return response.text


def blocking_file_read():
    """同步文件读取 - 阻塞事件循环"""
    with open("/tmp/test.txt", "r") as f:
        return f.read()


def blocking_sleep():
    """使用 time.sleep - 阻塞事件循环"""
    time.sleep(5)
    return "slept"


async def async_function_using_blocking_calls():
    """异步函数中调用阻塞代码"""
    # 问题：在异步函数中使用同步阻塞调用
    result1 = blocking_network_call()
    
    # 问题：使用 time.sleep 而不是 asyncio.sleep
    blocking_sleep()
    
    return result1


async def main():
    task1 = asyncio.create_task(async_function_using_blocking_calls())
    task2 = asyncio.create_task(asyncio.sleep(1))
    
    await asyncio.gather(task1, task2)


if __name__ == "__main__":
    asyncio.run(main())
