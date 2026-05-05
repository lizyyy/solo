"""错误示例: StopIteration 处理问题

问题:
1. 在生成器中手动抛出 StopIteration (Python 3.7+ 会变成 RuntimeError)
2. 没有正确处理 StopIteration 异常
3. yield from 中的 StopIteration 处理
"""


def bad_generator(data):
    """错误: 在生成器中手动抛出 StopIteration"""
    for item in data:
        if item is None:
            # 问题1: Python 3.7+ 会将其转换为 RuntimeError
            raise StopIteration("End of data")
        yield item


def bad_yield_from():
    """错误: 没有正确处理 yield from 中的 StopIteration"""
    gen = bad_generator([1, 2, None, 3])
    try:
        # 问题2: yield from 会捕获 StopIteration，但这里手动抛出的有问题
        result = yield from gen
        print(f"Result: {result}")
    except RuntimeError as e:
        print(f"RuntimeError: {e}")


def bad_next_handling():
    """错误: 没有正确处理 next() 的 StopIteration"""
    items = iter([1, 2, 3])
    while True:
        try:
            item = next(items)
            print(item)
        except StopIteration:
            # 问题3: 继续调用已耗尽的迭代器
            item = next(items)  # 再次抛出 StopIteration
